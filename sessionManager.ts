import { SessionEntry, VFS, Message, PermissionMode, SessionStorageConfig } from "../types";

export const DEFAULT_CONFIG: SessionStorageConfig = {
  configDir: "~/.claude",
  projectDirName: "workspace",
  skipPromptHistory: false,
};

export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 7);
  return `session-${timestamp}-${rand}`;
}

export function generateDefaultSessionName(
  folderName: string = "workspace",
  firstPrompt?: string
): { name: string; isCustomName: boolean } {
  if (firstPrompt && firstPrompt.trim().length > 0) {
    const clean = firstPrompt.trim().replace(/^[\/!]/, "").slice(0, 32);
    return { name: clean, isCustomName: false };
  }
  const hexSuffix = Math.floor(Math.random() * 0xfff).toString(16).padStart(2, "0");
  return { name: `${folderName}-${hexSuffix}`, isCustomName: false };
}

export function resolveUniqueSessionName(
  name: string,
  existingSessions: SessionEntry[],
  currentSessionId?: string
): string {
  const trimmed = name.trim();
  const duplicate = existingSessions.some(
    s => s.id !== currentSessionId && s.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (!duplicate) return trimmed;

  const hexSuffix = Math.floor(Math.random() * 0xff).toString(16);
  return `${trimmed}-${hexSuffix}`;
}

export function createNewSession(options: {
  name?: string;
  isCustomName?: boolean;
  project?: string;
  worktree?: string;
  branch?: string;
  prNumber?: string;
  prUrl?: string;
  vfs?: VFS;
  messages?: Message[];
  permissionMode?: PermissionMode;
  toolPermissions?: Record<string, string>;
  activeSubagent?: string | null;
  parentSessionId?: string;
}): SessionEntry {
  const id = generateSessionId();
  const folder = options.project || "workspace";
  const def = generateDefaultSessionName(folder);
  const name = options.name?.trim() || def.name;

  return {
    id,
    timestamp: Date.now(),
    lastActiveAt: Date.now(),
    name,
    isCustomName: options.isCustomName ?? (!!options.name),
    vfs: options.vfs ? JSON.parse(JSON.stringify(options.vfs)) : {},
    messages: options.messages ? JSON.parse(JSON.stringify(options.messages)) : [],
    project: options.project || "workspace",
    worktree: options.worktree || "main",
    branch: options.branch || "main",
    prNumber: options.prNumber,
    prUrl: options.prUrl,
    tokens: 0,
    permissionMode: options.permissionMode || "Ask",
    toolPermissions: options.toolPermissions ? { ...options.toolPermissions } : undefined,
    activeSubagent: options.activeSubagent || null,
    parentSessionId: options.parentSessionId,
    isArchived: false,
    neverPromptCompact: false
  };
}

export function branchSession(
  sourceSession: SessionEntry,
  customBranchName?: string,
  currentVfs?: VFS,
  currentMessages?: Message[]
): SessionEntry {
  const id = generateSessionId();
  let baseName = sourceSession.name || "workspace";
  if (baseName.endsWith(" (branch)")) {
    baseName = baseName.slice(0, -9);
  }
  const name = customBranchName?.trim() || `${baseName} (branch)`;

  // Strict deep copying of all state
  const deepVfs = currentVfs
    ? JSON.parse(JSON.stringify(currentVfs))
    : JSON.parse(JSON.stringify(sourceSession.vfs || {}));

  const deepMessages = currentMessages
    ? JSON.parse(JSON.stringify(currentMessages))
    : JSON.parse(JSON.stringify(sourceSession.messages || []));

  return {
    id,
    timestamp: Date.now(),
    lastActiveAt: Date.now(),
    name,
    isCustomName: true,
    vfs: deepVfs,
    messages: deepMessages,
    project: sourceSession.project || "workspace",
    worktree: sourceSession.worktree || "main",
    branch: sourceSession.branch || "main",
    prNumber: sourceSession.prNumber,
    prUrl: sourceSession.prUrl,
    tokens: sourceSession.tokens,
    permissionMode: sourceSession.permissionMode || "Ask",
    toolPermissions: sourceSession.toolPermissions ? JSON.parse(JSON.stringify(sourceSession.toolPermissions)) : undefined,
    activeSubagent: sourceSession.activeSubagent || null,
    parentSessionId: sourceSession.id,
    isArchived: false,
    neverPromptCompact: sourceSession.neverPromptCompact
  };
}

export interface SessionSearchFilters {
  query?: string;
  allProjects?: boolean;
  allWorktrees?: boolean;
  currentBranchOnly?: boolean;
  currentBranch?: string;
  currentProject?: string;
  currentWorktree?: string;
  prFilter?: string;
}

export function filterSessions(
  sessions: SessionEntry[],
  filters: SessionSearchFilters
): SessionEntry[] {
  let result = [...sessions];

  // Project scope
  if (!filters.allProjects && filters.currentProject) {
    result = result.filter(
      s => !s.project || s.project.toLowerCase() === filters.currentProject?.toLowerCase()
    );
  }

  // Worktree scope
  if (!filters.allWorktrees && filters.currentWorktree) {
    result = result.filter(
      s => !s.worktree || s.worktree.toLowerCase() === filters.currentWorktree?.toLowerCase()
    );
  }

  // Branch scope
  if (filters.currentBranchOnly && filters.currentBranch) {
    result = result.filter(
      s => s.branch && s.branch.toLowerCase() === filters.currentBranch?.toLowerCase()
    );
  }

  // PR filter
  if (filters.prFilter && filters.prFilter.trim()) {
    const rawPr = filters.prFilter.trim().replace(/^#/, "");
    result = result.filter(s => {
      if (s.prNumber && s.prNumber.replace(/^#/, "") === rawPr) return true;
      if (s.prUrl && s.prUrl.includes(`/pull/${rawPr}`)) return true;
      return false;
    });
  }

  // Text query
  if (filters.query && filters.query.trim()) {
    const q = filters.query.trim().toLowerCase();

    // Check if query is PR link or #number
    const prMatch = q.match(/(?:pull\/|#)(\d+)/);
    if (prMatch) {
      const prNum = prMatch[1];
      result = result.filter(s => 
        (s.prNumber && s.prNumber.includes(prNum)) ||
        (s.prUrl && s.prUrl.includes(prNum)) ||
        s.name.toLowerCase().includes(q)
      );
      return result;
    }

    result = result.filter(s => {
      if (s.name.toLowerCase().includes(q)) return true;
      if (s.id.toLowerCase().includes(q)) return true;
      if (s.project && s.project.toLowerCase().includes(q)) return true;
      if (s.branch && s.branch.toLowerCase().includes(q)) return true;
      if (s.prNumber && s.prNumber.toLowerCase().includes(q)) return true;
      // Search inside messages content
      const msgMatch = s.messages.some(
        m => m.content && m.content.toLowerCase().includes(q)
      );
      return msgMatch;
    });
  }

  // Sort by last active / timestamp descending
  return result.sort((a, b) => (b.lastActiveAt || b.timestamp) - (a.lastActiveAt || a.timestamp));
}

export function shouldPromptCompactionOnResume(session: SessionEntry): boolean {
  if (session.neverPromptCompact) return false;
  if (!session.messages || session.messages.length < 6) return false;

  const now = Date.now();
  const lastActive = session.lastActiveAt || session.timestamp;
  const elapsedMs = now - lastActive;
  const isOlderThanOneHour = elapsedMs > 3600 * 1000;

  // Approximate tokens or message count
  const estimatedTokens = session.tokens || (session.messages.length * 350);
  const isLargeTokens = estimatedTokens > 100000 || session.messages.length >= 10;

  return isOlderThanOneHour && isLargeTokens;
}

export function formatSessionForExport(session: SessionEntry): { messages: Array<{ role: "user" | "assistant"; content: string }> } {
  const formattedMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const m of session.messages || []) {
    if (m.role === "user") {
      formattedMessages.push({
        role: "user",
        content: m.content || ""
      });
    } else if (m.role === "assistant") {
      const thinkTag = `<think>${m.reasoning || ""}</think>`;
      let bodyText = m.content || "";

      // Append tool calls / commands executed by AI if present
      if (m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
        const toolCallsStr = m.tool_calls.map((tc: any) => {
          const fnName = tc.function?.name || tc.name || "tool";
          const args = tc.function?.arguments || tc.input || tc.arguments || {};
          const argsFormatted = typeof args === "string" ? args : JSON.stringify(args, null, 2);
          return `<tool_call name="${fnName}">\n${argsFormatted}\n</tool_call>`;
        }).join("\n\n");

        bodyText = bodyText ? `${bodyText}\n\n${toolCallsStr}` : toolCallsStr;
      }

      const fullContent = bodyText ? `${thinkTag}\n${bodyText}` : thinkTag;

      formattedMessages.push({
        role: "assistant",
        content: fullContent
      });
    } else if (m.role === "tool") {
      const toolName = m.name || "tool";
      const resultText = m.content || "";
      formattedMessages.push({
        role: "user",
        content: `<tool_response name="${toolName}">\n${resultText}\n</tool_response>`
      });
    } else if (m.role === "system") {
      formattedMessages.push({
        role: "user",
        content: `[System]: ${m.content || ""}`
      });
    }
  }

  return { messages: formattedMessages };
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function mapToolName(name: string): string {
  if (!name) return "Unknown";
  switch (name.toLowerCase()) {
    case "run_code":
    case "run_command":
    case "bash": return "Bash";
    case "write_file": return "Write";
    case "edit_file":
    case "multi_edit_file":
    case "multi_edit": return "Edit";
    case "read_file":
    case "view_file": return "Read";
    case "view_image": return "ViewImage";
    case "grep_files": return "Grep";
    case "glob":
    case "glob_files": return "Glob";
    case "list_directory":
    case "list_dir": return "LS";
    case "delete_file": return "Delete_file";
    default: return name.charAt(0).toUpperCase() + name.slice(1);
  }
}

export function exportSessionToJSONL(session: SessionEntry, modelName: string = "claude-code"): string {
  const resolvedModelName = (modelName && modelName.trim()) ? modelName.trim() : "claude-code";
  const lines: string[] = [];
  const sessionId = session.id || `session-${Date.now()}`;
  const now = new Date().toISOString();
  let parentUuid: string | null = null;
  let currentPromptId = generateUUID();
  let lastPromptContent = "";

  const generateMsgId = () => `msg_${Math.random().toString(36).substring(2, 12)}`;
  const generateReqId = () => `req_${Math.random().toString(36).substring(2, 12)}`;
  const generateTooluId = () => `toolu_${Math.random().toString(36).substring(2, 12)}`;

  const cwd = "/workspace";

  const messageLines: any[] = [];
  
  const addLine = (obj: any) => {
    messageLines.push(obj);
    parentUuid = obj.uuid;
  };

  const getBaseFields = (uuid: string) => ({
    parentUuid,
    isSidechain: false,
    uuid,
    timestamp: now,
    userType: "external",
    entrypoint: "cli",
    cwd,
    sessionId,
    version: "2.1.175",
    gitBranch: "HEAD"
  });

  const toolCallMapping: Record<string, { tooluId: string, assistantUuid: string }> = {};
  const pendingToolCalls: string[] = [];

  for (const m of session.messages || []) {
    if (!m || m.isLocal) continue;

    if (m.role === "user" || m.role === "system") {
      const currentUuid = generateUUID();
      currentPromptId = generateUUID();
      const textContent = m.role === "system" ? `[System]: ${m.content || ""}` : (m.content || "");
      lastPromptContent = textContent;

      addLine({
        ...getBaseFields(currentUuid),
        promptId: currentPromptId,
        type: "user",
        message: {
          role: "user",
          content: textContent
        },
        permissionMode: "bypassPermissions",
        promptSource: "typed"
      });
    } else if (m.role === "assistant") {
      const hasTools = m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0;
      const msgId = generateMsgId();
      const reqId = generateReqId();

      // Claude Code logs text and tool uses as separate entries for the same msgId
      if (m.content) {
        const currentUuid = generateUUID();
        addLine({
          ...getBaseFields(currentUuid),
          message: {
            model: resolvedModelName,
            id: msgId,
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: m.content }],
            stop_reason: hasTools ? null : "end_turn",
            stop_sequence: null,
            stop_details: null,
            usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
            diagnostics: null
          },
          requestId: reqId,
          type: "assistant"
        });
      }

      if (hasTools) {
        for (const tc of m.tool_calls!) {
          const internalId = tc.id || tc.tool_call_id || (tc as any).toolCallId || `tc-${Date.now()}-${Math.random()}`;
          const tooluId = generateTooluId();
          
          const fnName = tc.function?.name || tc.name || "tool";
          let rawArgs = tc.function?.arguments ?? tc.arguments ?? tc.input ?? {};
          let argsObj = {};

          if (typeof rawArgs === "string") {
             try {
               argsObj = JSON.parse(rawArgs);
             } catch (_) {
               // keep empty
             }
          } else if (typeof rawArgs === "object") {
             argsObj = rawArgs;
          }

          const currentUuid = generateUUID();
          
          toolCallMapping[internalId] = {
            tooluId,
            assistantUuid: currentUuid
          };
          pendingToolCalls.push(internalId);

          addLine({
            ...getBaseFields(currentUuid),
            message: {
              model: resolvedModelName,
              id: msgId,
              type: "message",
              role: "assistant",
              content: [{
                type: "tool_use",
                id: tooluId,
                name: mapToolName(fnName),
                input: argsObj,
                caller: { type: "direct" }
              }],
              stop_reason: "tool_use",
              stop_sequence: null,
              stop_details: null,
              usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
              diagnostics: null
            },
            requestId: reqId,
            type: "assistant"
          });
        }
      }

      if (!m.content && !hasTools) {
         const currentUuid = generateUUID();
         addLine({
          ...getBaseFields(currentUuid),
          message: {
            model: resolvedModelName,
            id: msgId,
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "" }],
            stop_reason: "end_turn",
            stop_sequence: null,
            stop_details: null,
            usage: { input_tokens: 0, output_tokens: 0 },
            diagnostics: null
          },
          requestId: reqId,
          type: "assistant"
        });
      }

    } else if (m.role === "tool") {
      const currentUuid = generateUUID();
      let internalId = m.tool_call_id || (m as any).toolCallId;
      if (!internalId && pendingToolCalls.length > 0) {
        internalId = pendingToolCalls.shift();
      }

      const mapping = toolCallMapping[internalId!] || { tooluId: generateTooluId(), assistantUuid: parentUuid };
      
      addLine({
        ...getBaseFields(currentUuid),
        promptId: currentPromptId,
        type: "user",
        message: {
          role: "user",
          content: [
            {
              tool_use_id: mapping.tooluId,
              type: "tool_result",
              content: m.content || "",
              is_error: false
            }
          ]
        },
        toolUseResult: {
          stdout: m.content || "",
          stderr: "",
          interrupted: false,
          isImage: false,
          noOutputExpected: false
        },
        sourceToolAssistantUUID: mapping.assistantUuid
      });
    }
  }

  const finalMeta = [];
  
  if (parentUuid) {
    finalMeta.push(JSON.stringify({
      type: "last-prompt",
      lastPrompt: lastPromptContent,
      leafUuid: parentUuid,
      sessionId
    }));
  }
  
  finalMeta.push(JSON.stringify({
    type: "ai-title",
    aiTitle: session.name || "Claude Code Export",
    sessionId
  }));
  finalMeta.push(JSON.stringify({
    type: "mode",
    mode: "normal",
    sessionId
  }));
  finalMeta.push(JSON.stringify({
    type: "permission-mode",
    permissionMode: "bypassPermissions",
    sessionId
  }));

  const messageStrs = messageLines.map(obj => JSON.stringify(obj));

  // Meta lines at start, followed by message history, then repeating meta lines at end just to be safe (matching streaming behavior)
  return [...finalMeta, ...messageStrs, ...finalMeta].join("\n");
}
export function exportAllSessionsToJSONL(sessions: SessionEntry[], modelName?: string): string {
  return sessions.map(s => exportSessionToJSONL(s, modelName || "claude-code")).join("\n");
}

export function getSessionStoragePath(
  session: SessionEntry,
  configDir: string = "~/.claude",
  projectDirName?: string
): string {
  const project = projectDirName || session.project || "workspace";
  return `${configDir}/projects/${project}/${session.id}.jsonl`;
}

export function syncSessionsToVfs(
  sessions: SessionEntry[],
  vfs: VFS,
  configDir: string = "~/.claude",
  projectDirName: string = "workspace",
  modelName?: string
): VFS {
  const updatedVfs = { ...vfs };
  const resolvedModel = (modelName && modelName.trim()) ? modelName.trim() : "claude-code";
  for (const session of sessions) {
    const path = getSessionStoragePath(session, configDir, projectDirName);
    updatedVfs[path] = exportSessionToJSONL(session, resolvedModel);
  }
  return updatedVfs;
}
