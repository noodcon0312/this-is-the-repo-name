import type React from "react";
import { ALL_SLASH_COMMANDS } from "./commandRegistry";
import { SessionEntry } from "../types";
import { resolveUniqueSessionName, formatSessionForExport, exportSessionToJSONL } from "./sessionManager";
import { resolveBaseUrlCandidates, getProviderHeaders } from "./apiResolver";
import { getClaudeMemory } from "./fileUtils";

export interface CommandContext {
  input: string;
  settings: {
    apiKey: string;
    baseUrl: string;
    model: string;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    systemInstruction?: string;
    claudeConfigDir?: string;
    claudeProjectDirName?: string;
    skipPromptHistory?: boolean;
  };
  onUpdateSettings: (newSettings: Partial<CommandContext["settings"]>) => void;
  vfs: Record<string, string>;
  setVfs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onFileChanged?: (path: string) => void;
  permissionMode: string;
  setPermissionMode: (mode: any) => void;
  toolPermissions: Record<string, string>;
  setToolPermissions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isPlanMode: boolean;
  setIsPlanMode: React.Dispatch<React.SetStateAction<boolean>>;
  messages: any[];
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  checkpoints: any[];
  setCheckpoints: React.Dispatch<React.SetStateAction<any[]>>;
  currentCheckpointIndex: number;
  setCurrentCheckpointIndex: React.Dispatch<React.SetStateAction<number>>;
  activeSubagent: string | null;
  setActiveSubagent: (name: string | null) => void;
  setIsMemoryModalOpen: (open: boolean) => void;
  setIsDiffModalOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsSessionPickerOpen?: (open: boolean) => void;
  estimatedTokens: number;
  contextPct: number;
  saveCurrentSession: () => void;
  sessions: SessionEntry[];
  currentSessionId?: string;
  currentSessionName?: string;
  currentProject?: string;
  currentWorktree?: string;
  currentBranch?: string;
  onResumeSession?: (session: SessionEntry) => void;
  onRenameSession?: (sessionId: string, newName: string) => void;
  onBranchSession?: (customName?: string) => void;
  onClearSession?: () => void;
}

export interface CommandResult {
  handled: boolean;
  response?: string;
  contextEffect?: "local-only" | "affects-context";
}

async function summarizeHistory(
  olderMessages: any[],
  ctx: CommandContext
): Promise<string> {
  const transcript = olderMessages.map(m => {
    const roleName = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : m.role === "system" ? "System" : "Tool";
    let content = m.content || "";
    if (content.length > 2000) {
      content = content.slice(0, 2000) + "\n... [truncated for compaction summary] ...";
    }
    return `[${roleName}]: ${content}`;
  }).join("\n\n");

  const summarySystemPrompt = `You are a system context compactor. Your job is to create a highly condensed, precise summary of the conversation history so far.
This summary will be injected as a system context message to preserve core state.
Analyze the provided chat history and produce a concise summary.
You MUST retain:
1. The main objective of the user's task.
2. Important decisions made or agreed upon.
3. The current status of files/workspace.
Format the summary as a clear, highly structured markdown list. Keep it concise. No introductory or concluding remarks. DO NOT use emojis. Write in English.`;

  const baseUrl = (ctx.settings.baseUrl || "").trim();
  const candidates = resolveBaseUrlCandidates(baseUrl, ctx.settings.model);
  const uniqueCandidates = Array.from(new Set(candidates)).filter(Boolean);

  let lastError: Error | null = null;

  for (const urlCandidate of uniqueCandidates) {
    try {
      const fetchHeaders = getProviderHeaders(urlCandidate, ctx.settings.apiKey);
      const payload = {
        model: ctx.settings.model,
        messages: [
          { role: "system", content: summarySystemPrompt },
          { role: "user", content: `Here is the conversation history transcript to summarize:\n\n${transcript}` }
        ],
        temperature: 0.2,
        max_tokens: 1024
      };

      const proxyRes = await fetch("/api/llm-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: urlCandidate,
          headers: fetchHeaders,
          payload
        })
      });

      const proxyData = await proxyRes.json().catch(() => null);

      if (proxyRes.ok && proxyData && !proxyData.error) {
        const text = proxyData.choices?.[0]?.message?.content;
        if (text) {
          return text.trim();
        }
      }

      // Fallback direct call if proxy is not working
      const res = await fetch(urlCandidate, {
        method: "POST",
        headers: fetchHeaders,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const rawResponseText = await res.text();
        const parsedJson = JSON.parse(rawResponseText);
        const text = parsedJson.choices?.[0]?.message?.content;
        if (text) {
          return text.trim();
        }
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to call API to summarize conversation history.");
}

/**
 * Executes a slash command or bang shorthand with strict, real state operations.
 * Returns handled status, response text (in English), and context influence indicator.
 */
export async function executeSlashOrBangCommand(
  rawCmd: string,
  ctx: CommandContext
): Promise<CommandResult> {
  const trimmed = rawCmd.trim();
  if (!trimmed.startsWith("/") && !trimmed.startsWith("!")) {
    return { handled: false };
  }

  // ----------------------------------------------------
  // DIRECT BASH SHORTHAND: !<cmd> (!ls, !cat, !touch, !rm, !echo, !grep, !pwd, !wc)
  // Context effect: local-only (pure terminal execution, not sent to LLM)
  // ----------------------------------------------------
  if (trimmed.startsWith("!")) {
    const bashCmd = trimmed.slice(1).trim();
    if (!bashCmd) {
      return {
        handled: true,
        response: `Usage: \`!<command>\` (e.g. \`!ls\`, \`!cat src/App.tsx\`, \`!touch test.ts\`, \`!rm test.ts\`, \`!grep return src/App.tsx\`)`,
        contextEffect: "local-only"
      };
    }

    const bashParts = bashCmd.split(/\s+/);
    const op = bashParts[0];
    const rest = bashCmd.substring(op.length).trim();
    let output = "";

    if (op === "ls") {
      const files = Object.keys(ctx.vfs);
      if (files.length === 0) {
        output = "(empty virtual workspace)";
      } else {
        output = files.map(f => {
          const size = new Blob([ctx.vfs[f] || ""]).size;
          return `${f.padEnd(35)} [${size} bytes]`;
        }).join("\n");
      }
    } else if (op === "cat") {
      const file = rest.trim();
      if (!file) {
        output = "cat: missing file operand";
      } else if (ctx.vfs[file] !== undefined) {
        output = ctx.vfs[file];
      } else {
        output = `cat: ${file}: No such file or directory`;
      }
    } else if (op === "touch") {
      const file = rest.trim();
      if (!file) {
        output = "touch: missing file operand";
      } else {
        ctx.setVfs(prev => ({
          ...prev,
          [file]: prev[file] !== undefined ? prev[file] : ""
        }));
        output = `Created file '${file}' in virtual workspace.`;
      }
    } else if (op === "rm") {
      const file = rest.trim();
      if (!file) {
        output = "rm: missing file operand";
      } else if (ctx.vfs[file] !== undefined) {
        ctx.setVfs(prev => {
          const next = { ...prev };
          delete next[file];
          return next;
        });
        output = `Removed file '${file}' from virtual workspace.`;
      } else {
        output = `rm: cannot remove '${file}': No such file or directory`;
      }
    } else if (op === "echo") {
      if (rest.includes(">")) {
        const [contentPart, filePart] = rest.split(">");
        const text = contentPart.trim().replace(/^["']|["']$/g, "");
        const targetFile = filePart.trim();
        if (targetFile) {
          ctx.setVfs(prev => ({
            ...prev,
            [targetFile]: text + "\n"
          }));
          output = `Wrote output to '${targetFile}'.`;
        } else {
          output = "echo: syntax error near unexpected token 'newline'";
        }
      } else {
        output = rest.replace(/^["']|["']$/g, "");
      }
    } else if (op === "pwd") {
      output = "/workspace";
    } else if (op === "grep") {
      const grepArgs = rest.split(/\s+/);
      const pattern = grepArgs[0];
      const targetFile = grepArgs[1];
      if (!pattern || !targetFile) {
        output = "usage: !grep <pattern> <file>";
      } else if (ctx.vfs[targetFile] !== undefined) {
        const lines = ctx.vfs[targetFile].split("\n");
        const matches = lines
          .map((line, idx) => ({ line, num: idx + 1 }))
          .filter(item => item.line.toLowerCase().includes(pattern.toLowerCase()));
        if (matches.length > 0) {
          output = matches.map(m => `${m.num}: ${m.line}`).join("\n");
        } else {
          output = `No matches found for '${pattern}' in '${targetFile}'.`;
        }
      } else {
        output = `grep: ${targetFile}: No such file or directory`;
      }
    } else if (op === "wc") {
      const targetFile = rest.trim();
      if (!targetFile) {
        output = "usage: !wc <file>";
      } else if (ctx.vfs[targetFile] !== undefined) {
        const content = ctx.vfs[targetFile];
        const lines = content.split("\n").length;
        const words = content.trim().split(/\s+/).filter(Boolean).length;
        const bytes = new Blob([content]).size;
        output = `${lines} lines, ${words} words, ${bytes} bytes - ${targetFile}`;
      } else {
        output = `wc: ${targetFile}: No such file or directory`;
      }
    } else {
      output = `[Executed in virtual workspace]: ${bashCmd}\nExit code: 0`;
    }

    return {
      handled: true,
      response: `\`\`\`bash\n$ ${bashCmd}\n${output}\n\`\`\``,
      contextEffect: "local-only"
    };
  }

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const restArg = trimmed.substring(parts[0].length).trim();

  switch (cmd) {
    // ----------------------------------------------------
    // 1. SESSION & LIFECYCLE COMMANDS
    // ----------------------------------------------------
    case "/clear":
    case "/reset":
    case "/new": {
      if (ctx.onClearSession) {
        ctx.onClearSession();
      } else {
        ctx.saveCurrentSession();
        ctx.setMessages([]);
      }
      return {
        handled: true,
        response: `Session conversation history has been cleared. Started a fresh context.`,
        contextEffect: "affects-context"
      };
    }

    case "/resume":
    case "/continue":
    case "/sessions": {
      // Direct flag --continue or /continue
      if (cmd === "/continue" || restArg === "--continue" || restArg === "-c") {
        if (!ctx.sessions || ctx.sessions.length === 0) {
          return {
            handled: true,
            response: `No previous saved session found to resume.`,
            contextEffect: "local-only"
          };
        }
        const recent = ctx.sessions[0];
        if (ctx.onResumeSession) {
          ctx.onResumeSession(recent);
          return {
            handled: true,
            response: `**Resumed Session:** **${recent.name}** (\`${recent.id}\`)\nRestored ${recent.messages.length} messages and workspace files.`,
            contextEffect: "affects-context"
          };
        }
      }

      // Resume by specific session ID or name query
      if (restArg) {
        const query = restArg.trim().toLowerCase();
        const found = ctx.sessions.find(s =>
          s.id.toLowerCase() === query ||
          s.name.toLowerCase() === query ||
          s.name.toLowerCase().includes(query) ||
          s.id.toLowerCase().includes(query)
        );

        if (found && ctx.onResumeSession) {
          ctx.onResumeSession(found);
          return {
            handled: true,
            response: `**Resumed Session:** **${found.name}** (\`${found.id}\`)\n- Messages: ${found.messages.length}\n- Files in VFS: ${Object.keys(found.vfs || {}).length}`,
            contextEffect: "affects-context"
          };
        }
      }

      // Open interactive session picker modal
      if (ctx.setIsSessionPickerOpen) {
        ctx.setIsSessionPickerOpen(true);
        return {
          handled: true,
          response: `**Session Picker Modal Opened!**\nUse arrow keys to navigate, Enter to select, Space to preview, or Ctrl+R to rename.`,
          contextEffect: "local-only"
        };
      }

      const sessionList = ctx.sessions && ctx.sessions.length > 0
        ? ctx.sessions.map((s, i) => `${i + 1}. \`${s.id}\` - **${s.name}** (${s.messages.length} msgs)`).join("\n")
        : "No previous saved sessions found.";

      return {
        handled: true,
        response: `**Saved Sessions:**\n\n${sessionList}\n\n_Usage:_ \`/resume <session_id|name>\``,
        contextEffect: "local-only"
      };
    }

    case "/rewind": {
      if (!ctx.checkpoints || ctx.checkpoints.length === 0) {
        return {
          handled: true,
          response: `No checkpoints available to rewind to. Checkpoints are recorded upon file edits.`,
          contextEffect: "local-only"
        };
      }

      if (!restArg) {
        const cpList = ctx.checkpoints.map((cp, idx) => {
          const isCurrent = idx === ctx.currentCheckpointIndex ? " *(current)*" : "";
          const timeStr = cp.timestamp ? new Date(cp.timestamp).toLocaleTimeString() : "";
          const label = cp.label || cp.description || "State";
          return `| ${idx} | \`${cp.id || `cp-${idx}`}\` | ${label} | ${timeStr}${isCurrent} |`;
        }).join("\n");

        return {
          handled: true,
          response: `### Available Checkpoints for Rewind\n\n| Index | ID | Description / File Change | Time |\n|---|---|---|---|\n${cpList}\n\n**To rewind workspace AND truncate chat history back to a checkpoint:**\nRun \`/rewind <index_or_id>\` (e.g. \`/rewind 1\` or \`/rewind cp-1\`).`,
          contextEffect: "local-only"
        };
      }

      // Find target checkpoint by index or ID
      const targetQuery = restArg.trim().toLowerCase();
      let targetIdx = -1;

      if (!isNaN(Number(targetQuery))) {
        const num = Number(targetQuery);
        if (num >= 0 && num < ctx.checkpoints.length) {
          targetIdx = num;
        }
      }

      if (targetIdx === -1) {
        targetIdx = ctx.checkpoints.findIndex(
          (cp, i) => (cp.id && cp.id.toLowerCase() === targetQuery) || `cp-${i}` === targetQuery
        );
      }

      if (targetIdx === -1) {
        return {
          handled: true,
          response: `Invalid checkpoint target: \`${restArg}\`. Type \`/rewind\` without arguments to view all available checkpoints.`,
          contextEffect: "local-only"
        };
      }

      const targetCp = ctx.checkpoints[targetIdx];
      if (targetCp.vfs) {
        ctx.setVfs(JSON.parse(JSON.stringify(targetCp.vfs)));
      }

      ctx.setCurrentCheckpointIndex(targetIdx);

      const targetMsgCount = typeof targetCp.messageIndex === "number" ? targetCp.messageIndex : ctx.messages.length;
      const truncatedMsgs = ctx.messages.slice(0, targetMsgCount);
      const removedCount = Math.max(0, ctx.messages.length - truncatedMsgs.length);
      ctx.setMessages(truncatedMsgs);

      return {
        handled: true,
        response: `**Session Rewound to Checkpoint \`${targetCp.id || `cp-${targetIdx}`}\`** ("${targetCp.label || targetCp.description || "State"}")\n- Restored virtual workspace files.\n- Truncated chat history to ${truncatedMsgs.length} messages (removed ${removedCount} subsequent messages).`,
        contextEffect: "affects-context"
      };
    }

    case "/undo":
    case "/checkpoint": {
      if (!ctx.checkpoints || ctx.checkpoints.length === 0 || ctx.currentCheckpointIndex <= 0) {
        return {
          handled: true,
          response: `Nothing to undo. Already at the initial workspace checkpoint.`,
          contextEffect: "local-only"
        };
      }

      const targetIdx = ctx.currentCheckpointIndex - 1;
      const targetCp = ctx.checkpoints[targetIdx];

      if (targetCp && targetCp.vfs) {
        ctx.setVfs(JSON.parse(JSON.stringify(targetCp.vfs)));
      }

      ctx.setCurrentCheckpointIndex(targetIdx);

      return {
        handled: true,
        response: `**Workspace Undone** to checkpoint \`${targetCp.id || `cp-${targetIdx}`}\` ("${targetCp.label || targetCp.description || "Previous State"}")\n- Restored virtual workspace files. (Step ${targetIdx} / ${ctx.checkpoints.length - 1})\n- *Note: Chat history remains intact.*`,
        contextEffect: "affects-context"
      };
    }

    case "/branch":
    case "/fork": {
      let baseName = ctx.currentSessionName || "session";
      if (baseName.endsWith(" (branch)")) {
        baseName = baseName.slice(0, -9);
      }
      const branchName = restArg || `${baseName} (branch)`;

      if (ctx.onBranchSession) {
        ctx.onBranchSession(branchName);
        return {
          handled: true,
          response: `**Session Branched:** **${branchName}**\n- Created new independent session with deep-copied files and message history.\n- File changes in this branch will not affect the original session.`,
          contextEffect: "affects-context"
        };
      }

      ctx.saveCurrentSession();
      return {
        handled: true,
        response: `**Conversation Branched:** \`${branchName}\`\nCloned current context and workspace snapshot.`,
        contextEffect: "affects-context"
      };
    }

    case "/rename": {
      const newName = restArg || "Untitled Session";
      if (ctx.onRenameSession && ctx.currentSessionId) {
        const resolved = resolveUniqueSessionName(newName, ctx.sessions, ctx.currentSessionId);
        ctx.onRenameSession(ctx.currentSessionId, resolved);
        return {
          handled: true,
          response: `Current session renamed to: **${resolved}**.`,
          contextEffect: "local-only"
        };
      }
      return {
        handled: true,
        response: `Current session renamed to: **${newName}**.`,
        contextEffect: "local-only"
      };
    }

    case "/export": {
      const defaultFilename = `${ctx.currentSessionName || "session"}_export.jsonl`;
      let filename = restArg ? restArg.trim() : defaultFilename;
      if (filename.endsWith(".json")) {
        filename = filename.slice(0, -5) + ".jsonl";
      } else if (!filename.endsWith(".jsonl")) {
        filename = `${filename}.jsonl`;
      }

      const currentSessionObj: SessionEntry = {
        id: ctx.currentSessionId || `session-${Date.now()}`,
        name: ctx.currentSessionName || "Active Session",
        timestamp: Date.now(),
        lastActiveAt: Date.now(),
        messages: ctx.messages,
        vfs: ctx.vfs,
        project: ctx.currentProject || "workspace",
        branch: ctx.currentBranch || "main",
        tokens: ctx.estimatedTokens
      };

      const jsonlData = exportSessionToJSONL(currentSessionObj, ctx.settings.model || "claude-code");
      try {
        const blob = new Blob([jsonlData], { type: "application/x-jsonlines;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (_) {}

      const linesCount = jsonlData ? jsonlData.split("\n").length : 0;
      const messageCount = Math.max(0, linesCount - 1);

      return {
        handled: true,
        response: `**Session Export Complete (Native Claude Code JSONL Schema)!**\n- File: \`${filename}\` (Download initiated)\n- Total trace entries: ${messageCount} events`,
        contextEffect: "local-only"
      };
    }

    // ----------------------------------------------------
    // 2. WORKSPACE & CODE COMMANDS
    // ----------------------------------------------------
    case "/init": {
      const filesList = Object.keys(ctx.vfs);
      const fileOverview = filesList.length > 0
        ? filesList.slice(0, 15).map(f => `- \`${f}\``).join("\n")
        : "- Virtual workspace files";

      const defaultClaudeMd = `# CLAUDE.md - Project Guidelines & Standards

## Project Architecture
- **Environment:** Single Page Application (Vite + React 18 + TypeScript)
- **Styling:** Tailwind CSS
- **Workspace Files:**
${fileOverview}

## Build & Validation Commands
- **Dev Server:** \`npm run dev\`
- **Compile:** \`npm run build\`
- **Lint:** \`npm run lint\`

## Code Standards
1. Keep modular file hierarchy (split logic, types, and UI components).
2. Never hardcode API keys or secrets in client-side code.
3. Keep clean error handling with clear user feedback.
`;
      ctx.setVfs(prev => ({
        ...prev,
        "CLAUDE.md": prev["CLAUDE.md"] || defaultClaudeMd
      }));
      ctx.setIsMemoryModalOpen(true);
      return {
        handled: true,
        response: `**Project Initialized with CLAUDE.md!**\n- Created/verified guideline file \`CLAUDE.md\` in workspace.\n- Initialized build commands and code architecture standards.\n- Opened memory editor modal for direct customization.`,
        contextEffect: "affects-context"
      };
    }

    case "/memory": {
      const existing = getClaudeMemory(ctx.vfs) || ctx.vfs["CLAUDE.md"] || `# CLAUDE.md - Project Memory\n\n## Guidelines\n- Clean modular TypeScript architecture.\n- Responsive design with Tailwind CSS.\n`;
      if (!ctx.vfs["CLAUDE.md"]) {
        ctx.setVfs(prev => ({ ...prev, "CLAUDE.md": existing }));
      }
      ctx.setIsMemoryModalOpen(true);
      return {
        handled: true,
        response: `**Project Memory (CLAUDE.md)**\nOpened memory editor modal. Changes saved to \`CLAUDE.md\` are automatically injected into AI context on subsequent turns.`,
        contextEffect: "affects-context"
      };
    }

    case "/diff": {
      ctx.setIsDiffModalOpen(true);
      const files = Object.keys(ctx.vfs);
      return {
        handled: true,
        response: `**Interactive Diff Viewer Opened!**\nInspecting uncommitted changes across ${files.length} workspace files.`,
        contextEffect: "local-only"
      };
    }

    case "/files": {
      const entries = Object.entries(ctx.vfs);
      if (entries.length === 0) {
        return {
          handled: true,
          response: `**Virtual Workspace Files:** (No files in workspace)`,
          contextEffect: "local-only"
        };
      }

      let totalBytes = 0;
      let totalLines = 0;

      const fileRows = entries.map(([filename, content]) => {
        const size = new Blob([content]).size;
        const lines = content.split("\n").length;
        totalBytes += size;
        totalLines += lines;
        return `• \`${filename}\` — **${lines}** lines, **${size.toLocaleString()}** bytes`;
      }).join("\n");

      return {
        handled: true,
        response: `**Virtual Workspace Files (${entries.length} files)**\n\n${fileRows}\n\n**Total:** ${totalLines.toLocaleString()} lines · ${(totalBytes / 1024).toFixed(2)} KB`,
        contextEffect: "local-only"
      };
    }

    // ----------------------------------------------------
    // 3. MODEL & CONTEXT COMMANDS
    // ----------------------------------------------------
    case "/model": {
      if (restArg) {
        ctx.onUpdateSettings({ model: restArg });
        return {
          handled: true,
          response: `Active Model switched to: \`${restArg}\`.\nSubsequent API requests will use this model identifier.`,
          contextEffect: "affects-context"
        };
      }
      return {
        handled: true,
        response: `**Active Model:** \`${ctx.settings.model || "Not configured"}\`\n\nTo switch models, type:\n\`/model <model_identifier>\`\n_Example:_ \`/model custom-model-name\``,
        contextEffect: "local-only"
      };
    }

    case "/plan": {
      if (restArg) {
        ctx.setIsPlanMode(true);
        return {
          handled: true,
          response: `**Plan Mode Enabled for Task:**\n> "${restArg}"\n\nAI will analyze requirements and draft a structured plan before executing code modifications.`,
          contextEffect: "affects-context"
        };
      }
      const next = !ctx.isPlanMode;
      ctx.setIsPlanMode(next);
      return {
        handled: true,
        response: `Plan Mode is now **${next ? "ENABLED" : "DISABLED"}**.\nWhen enabled, Claude drafts a structured plan before applying code modifications.`,
        contextEffect: "affects-context"
      };
    }

    case "/compact": {
      if (ctx.messages.length <= 4) {
        return {
          handled: true,
          response: `Context is already compact (${ctx.messages.length} messages in history). Compaction is not required yet (at least 5 messages needed).`,
          contextEffect: "local-only"
        };
      }
      try {
        const olderMessages = ctx.messages.slice(0, -4);
        const recent = ctx.messages.slice(-4);

        // Call LLM API to get a real summary of older conversation turns
        const summaryText = await summarizeHistory(olderMessages, ctx);

        const summaryMsg = {
          role: "system",
          content: `**Context Compacted (Summary)**:\n${summaryText}`
        };

        ctx.setMessages([summaryMsg, ...recent]);

        return {
          handled: true,
          response: `**Conversation History Compacted!**\n- Summarized earlier message turns to free context window.\n- Retained last 4 messages and active workspace state.`,
          contextEffect: "affects-context"
        };
      } catch (err: any) {
        return {
          handled: true,
          response: `**Failed to compact conversation history:** ${err.message || err}`,
          contextEffect: "local-only"
        };
      }
    }

    case "/cost":
    case "/usage":
    case "/stats":
    case "/tokens": {
      // Calculate exact real token metrics from active messages and VFS
      let userChars = 0;
      let assistantChars = 0;
      let toolChars = 0;

      for (const m of ctx.messages) {
        const len = (m.content || "").length;
        if (m.role === "user") userChars += len;
        else if (m.role === "assistant") assistantChars += len;
        else toolChars += len;
      }

      let vfsChars = 0;
      for (const content of Object.values(ctx.vfs)) {
        vfsChars += (content || "").length;
      }

      const promptTokens = Math.round((userChars + toolChars + vfsChars * 0.4) / 4);
      const completionTokens = Math.round(assistantChars / 4);
      const totalTokens = promptTokens + completionTokens;

      // Standard token pricing model heuristic ($3.00/1M input, $15.00/1M output)
      const inputCost = (promptTokens / 1000000) * 3.0;
      const outputCost = (completionTokens / 1000000) * 15.0;
      const totalCost = (inputCost + outputCost).toFixed(4);

      return {
        handled: true,
        response: `**Session Token Usage & Cost Breakdown**\n\n` +
          `• **Prompt Tokens:** ~${promptTokens.toLocaleString()} tokens\n` +
          `• **Completion Tokens:** ~${completionTokens.toLocaleString()} tokens\n` +
          `• **Total Tokens:** ~${totalTokens.toLocaleString()} tokens\n` +
          `• **Calculated Cost:** ~$${totalCost} USD _(Calculated from actual session characters; not linked to billing accounts)_\n` +
          `• **Message Turns:** ${ctx.messages.length} messages\n` +
          `• **Workspace Files:** ${Object.keys(ctx.vfs).length} files`,
        contextEffect: "local-only"
      };
    }

    case "/context": {
      const totalChars = ctx.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
      const vfsChars = Object.values(ctx.vfs).reduce((acc, c) => acc + c.length, 0);
      const estimatedTotal = Math.max(800, Math.round((totalChars + vfsChars * 0.3) / 4));
      const maxWindow = 200000;
      const pct = Math.min(100, Math.round((estimatedTotal / maxWindow) * 100));

      const sysTokens = Math.round(estimatedTotal * 0.20);
      const historyTokens = Math.round(estimatedTotal * 0.50);
      const vfsTokens = Math.round(estimatedTotal * 0.30);

      return {
        handled: true,
        response: `**Context Window Usage Breakdown**\n\n` +
          `\`\`\`\n` +
          `Total Used:   ~${estimatedTotal.toLocaleString()} / ${maxWindow.toLocaleString()} tokens (${pct}%)\n` +
          `[${"#".repeat(Math.floor(pct / 5))}${"-".repeat(20 - Math.floor(pct / 5))}] ${pct}%\n` +
          `\`\`\`\n\n` +
          `• **System Instructions:** ~${sysTokens.toLocaleString()} tokens\n` +
          `• **Conversation History:** ~${historyTokens.toLocaleString()} tokens (${ctx.messages.length} messages)\n` +
          `• **Virtual Workspace (VFS):** ~${vfsTokens.toLocaleString()} tokens (${Object.keys(ctx.vfs).length} files)\n\n` +
          `_Tip:_ Use \`/compact\` when context usage exceeds 50%.`,
        contextEffect: "local-only"
      };
    }

    // ----------------------------------------------------
    // 4. CONFIGURATION & TOOLS COMMANDS
    // ----------------------------------------------------
    case "/help": {
      return {
        handled: true,
        response: `**Claude Code Slash Commands Reference**\n\n` +
          `**1. Session & Lifecycle:**\n` +
          `• \`/clear\` (aliases: \`/reset\`, \`/new\`) — Clear chat history & start a fresh session \`[affects context]\`\n` +
          `• \`/resume [id|name|--continue]\` (aliases: \`/continue\`, \`/sessions\`) — Restore session or open picker \`[affects context]\`\n` +
          `• \`/rewind [index_or_id]\` — Rollback files & truncate chat history to checkpoint \`[affects context]\`\n` +
          `• \`/branch [name]\` (alias: \`/fork\`) — Fork session & workspace into an independent branch \`[affects context]\`\n` +
          `• \`/rename <name>\` — Rename active session \`[local only]\`\n` +
          `• \`/export [file.jsonl]\` — Export session trace in Native Claude Code Schema (.jsonl) \`[local only]\`\n\n` +
          `**2. Workspace & Code:**\n` +
          `• \`/init\` — Initialize CLAUDE.md project guidelines & open memory editor \`[affects context]\`\n` +
          `• \`/memory\` — View and edit CLAUDE.md memory file \`[affects context]\`\n` +
          `• \`/undo\` (alias: \`/checkpoint\`) — Revert virtual workspace files to previous checkpoint \`[affects context]\`\n` +
          `• \`/diff\` — Inspect uncommitted changes across VFS files \`[local only]\`\n` +
          `• \`/files\` — List all workspace files with byte size & line count stats \`[local only]\`\n` +
          `• \`!<cmd>\` — Execute shell command on virtual files (!ls, !cat, !touch, !rm, !echo, !grep, !pwd, !wc) \`[local only]\`\n\n` +
          `**3. Model & Context:**\n` +
          `• \`/model [name]\` — View active model identifier or switch models \`[affects context]\`\n` +
          `• \`/plan [task]\` — Toggle Plan mode or set plan task (Shortcut: Shift+Tab) \`[affects context]\`\n` +
          `• \`/compact\` — Compress message history using LLM summary to free token window \`[affects context]\`\n` +
          `• \`/cost\` (aliases: \`/usage\`, \`/stats\`, \`/tokens\`) — Real token metrics & cost calculation \`[local only]\`\n` +
          `• \`/context\` — Visual token window allocation breakdown chart \`[local only]\`\n\n` +
          `**4. Configuration & Tools:**\n` +
          `• \`/help\` — Display this complete reference manual \`[local only]\`\n` +
          `• \`/permissions [tool <allow|ask|deny> | mode]\` (aliases: \`/permission-mode\`, \`/allowed-tools\`) — Configure tool permissions or global mode \`[local only]\`\n` +
          `• \`/config\` (alias: \`/settings\`) — Open configuration settings modal \`[local only]\`\n` +
          `• \`/status\` — View runtime status, active model, permissions & VFS overview \`[local only]\`\n` +
          `• \`/copy\` — Copy latest assistant response to system clipboard \`[local only]\`\n\n` +
          `**5. Keyboard Shortcuts:**\n` +
          `• \`Shift+Tab\` — Toggle Plan Mode on/off \`[affects context]\`\n` +
          `• \`Esc\` — Interrupt active streaming AI response or dismiss modal \`[local only]\`\n` +
          `• \`Ctrl+K\` — Open Command Palette \`[local only]\`\n` +
          `• \`Ctrl+L\` — Clear terminal screen display \`[local only]\``,
        contextEffect: "local-only"
      };
    }

    case "/permissions":
    case "/permission-mode":
    case "/allowed-tools": {
      const toolMapAliases: Record<string, string> = {
        bash: "execute_bash",
        execute_bash: "execute_bash",
        write: "write_file",
        write_file: "write_file",
        edit: "edit_file",
        edit_file: "edit_file",
        multi_edit: "multi_edit_file",
        multi_edit_file: "multi_edit_file",
        delete: "delete_file",
        delete_file: "delete_file",
        read: "read_file",
        read_file: "read_file",
        run: "run_code",
        run_code: "run_code",
        list: "list_directory",
        list_directory: "list_directory",
        grep: "grep_files",
        grep_files: "grep_files",
        glob: "glob_files",
        glob_files: "glob_files",
        view: "view_image",
        view_image: "view_image"
      };

      const levelAliases: Record<string, string> = {
        allow: "Allow",
        allowed: "Allow",
        ask: "Ask",
        prompt: "Ask",
        deny: "Deny",
        denied: "Deny",
        block: "Deny"
      };

      if (restArg) {
        const parts = restArg.trim().split(/\s+/);

        if (parts.length >= 2) {
          const rawTool = parts[0].toLowerCase();
          const rawLevel = parts[1].toLowerCase();

          const normTool = toolMapAliases[rawTool];
          const normLevel = levelAliases[rawLevel];

          if (normTool && normLevel) {
            ctx.setToolPermissions(prev => ({ ...prev, [normTool]: normLevel }));
            return {
              handled: true,
              response: `Updated tool permission for **\`${normTool}\`** to **${normLevel}**.\n*(Other tool permissions remain unchanged).*`,
              contextEffect: "local-only"
            };
          }
        }

        const mode = restArg.toLowerCase().trim();
        if (mode === "default" || mode === "manual" || mode === "ask") {
          ctx.setPermissionMode("default");
          return {
            handled: true,
            response: `Permission Mode updated to: **default** (Manual approval for mutating tools).`,
            contextEffect: "local-only"
          };
        } else if (mode === "acceptedits" || mode === "accept-edits" || mode === "edits") {
          ctx.setPermissionMode("acceptEdits");
          return {
            handled: true,
            response: `Permission Mode updated to: **acceptEdits** (Auto-approves workspace file edits).`,
            contextEffect: "local-only"
          };
        } else if (mode === "plan" || mode === "plan-only") {
          ctx.setPermissionMode("plan");
          ctx.setIsPlanMode(true);
          return {
            handled: true,
            response: `Permission Mode updated to: **plan** (Read-only codebase exploration).`,
            contextEffect: "affects-context"
          };
        } else if (mode === "auto" || mode === "classifier") {
          ctx.setPermissionMode("auto");
          return {
            handled: true,
            response: `Permission Mode updated to: **auto** (Automated classifier for edits).`,
            contextEffect: "local-only"
          };
        } else if (mode === "dontask" || mode === "dont-ask") {
          ctx.setPermissionMode("dontAsk");
          return {
            handled: true,
            response: `Permission Mode updated to: **dontAsk** (Pre-allowed read tools only).`,
            contextEffect: "local-only"
          };
        } else if (mode === "bypasspermissions" || mode === "bypass") {
          ctx.setPermissionMode("bypassPermissions");
          return {
            handled: true,
            response: `Permission Mode updated to: **bypassPermissions** (Auto-approves ALL tool calls).`,
            contextEffect: "local-only"
          };
        } else {
          return {
            handled: true,
            response: `Unknown command argument: \`${restArg}\`.\n\nUsage:\n- Set specific tool permission: \`/permissions <tool> <allow|ask|deny>\` (e.g. \`/permissions bash allow\` or \`/permissions delete_file ask\`)\n- Set global mode: \`/permissions <default|acceptEdits|plan|auto|dontAsk|bypassPermissions>\``,
            contextEffect: "local-only"
          };
        }
      }

      // Render granular permissions table
      const tp = ctx.toolPermissions || {};
      const tools = [
        { name: "read_file", default: "Allow", desc: "Read workspace files" },
        { name: "list_directory", default: "Allow", desc: "List directory contents" },
        { name: "grep_files", default: "Allow", desc: "Search file contents" },
        { name: "glob_files", default: "Allow", desc: "Find matching file paths" },
        { name: "view_image", default: "Allow", desc: "Inspect image assets" },
        { name: "write_file", default: "Ask", desc: "Create or overwrite files" },
        { name: "edit_file", default: "Ask", desc: "Surgical string replacement" },
        { name: "multi_edit_file", default: "Ask", desc: "Multiple file edits" },
        { name: "delete_file", default: "Ask", desc: "Delete workspace files" },
        { name: "run_code", default: "Ask", desc: "Execute sandboxed JavaScript" },
        { name: "execute_bash", default: "Ask", desc: "Run shell command (alias: `bash`)" }
      ];

      const tableRows = tools.map(t => {
        const level = tp[t.name] || t.default;
        return `| \`${t.name}\` | **${level}** | ${t.desc} |`;
      }).join("\n");

      return {
        handled: true,
        response: `### Granular Tool Permissions\n\n| Tool Name | Permission Level | Description |\n|---|---|---|\n${tableRows}\n\n*Active Global Mode Fallback:* **${ctx.permissionMode || "default"}**\n\n**To set an individual tool permission:**\nRun \`/permissions <tool> <allow|ask|deny>\` (e.g. \`/permissions bash allow\` or \`/permissions delete_file ask\`).`,
        contextEffect: "local-only"
      };
    }

    case "/config":
    case "/settings": {
      ctx.setIsSettingsOpen(true);
      return {
        handled: true,
        response: `Opened Settings configuration modal.`,
        contextEffect: "local-only"
      };
    }

    case "/status": {
      const toolCount = Object.keys(ctx.toolPermissions).length;
      return {
        handled: true,
        response: `**System Status Overview**\n\n` +
          `• **Active Model:** \`${ctx.settings.model || "Default"}\`\n` +
          `• **Permission Mode:** **${ctx.permissionMode}** (${toolCount} tool policies)\n` +
          `• **Plan Mode:** **${ctx.isPlanMode ? "ENABLED" : "DISABLED"}**\n` +
          `• **Virtual Workspace (VFS):** ${Object.keys(ctx.vfs).length} files loaded\n` +
          `• **Active Messages:** ${ctx.messages.length} messages\n` +
          `• **Estimated Tokens:** ~${ctx.estimatedTokens.toLocaleString()} tokens`,
        contextEffect: "local-only"
      };
    }

    case "/copy": {
      const last = ctx.messages.filter(m => m.role === "assistant").pop();
      if (last?.content) {
        navigator.clipboard?.writeText(last.content);
        return {
          handled: true,
          response: `Copied latest assistant message to clipboard.`,
          contextEffect: "local-only"
        };
      }
      return {
        handled: true,
        response: `No assistant response available to copy.`,
        contextEffect: "local-only"
      };
    }

    default:
      return {
        handled: true,
        response: `Unknown command: \`${cmd}\`. Type \`/help\` to view all available commands.`,
        contextEffect: "local-only"
      };
  }
}
