export interface SlashCommandItem {
  cmd: string;
  aliases?: string[];
  desc: string;
  category: "Session & Lifecycle" | "Workspace & Code" | "Model & Context" | "Configuration & Tools" | "Keybindings & Shortcuts";
  usage?: string;
  contextEffect: "local-only" | "affects-context";
}

/**
 * Standardized, 100% functional command registry for Claude Code Web Edition.
 * Every command listed here is backed by real application state logic (no simulation).
 * Output strings are strictly in English.
 */
export const ALL_SLASH_COMMANDS: SlashCommandItem[] = [
  // 1. Session & Lifecycle
  {
    cmd: "/clear",
    aliases: ["/reset", "/new"],
    desc: "Clear active conversation history and start a fresh session",
    category: "Session & Lifecycle",
    usage: "/clear",
    contextEffect: "affects-context"
  },
  {
    cmd: "/resume",
    aliases: ["/continue", "/sessions"],
    desc: "Open session picker or restore previous session by ID/name",
    category: "Session & Lifecycle",
    usage: "/resume [session_id|--continue]",
    contextEffect: "affects-context"
  },
  {
    cmd: "/rewind",
    desc: "Rollback virtual workspace files and truncate chat history back to target checkpoint",
    category: "Session & Lifecycle",
    usage: "/rewind [index_or_id]",
    contextEffect: "affects-context"
  },
  {
    cmd: "/branch",
    aliases: ["/fork"],
    desc: "Fork current session, messages, and VFS snapshot into an independent branch session",
    category: "Session & Lifecycle",
    usage: "/branch [branch_name]",
    contextEffect: "affects-context"
  },
  {
    cmd: "/rename",
    desc: "Rename the current session in local storage",
    category: "Session & Lifecycle",
    usage: "/rename <new_name>",
    contextEffect: "local-only"
  },
  {
    cmd: "/export",
    desc: "Export session trace in Native Claude Code JSONL schema (.jsonl)",
    category: "Session & Lifecycle",
    usage: "/export [filename.jsonl]",
    contextEffect: "local-only"
  },

  // 2. Workspace & Code
  {
    cmd: "/init",
    desc: "Initialize CLAUDE.md project guidelines and open memory editor",
    category: "Workspace & Code",
    usage: "/init",
    contextEffect: "affects-context"
  },
  {
    cmd: "/memory",
    desc: "View and edit project memory (CLAUDE.md) loaded into AI context",
    category: "Workspace & Code",
    usage: "/memory",
    contextEffect: "affects-context"
  },
  {
    cmd: "/undo",
    aliases: ["/checkpoint"],
    desc: "Revert virtual workspace files to the latest checkpoint state",
    category: "Workspace & Code",
    usage: "/undo",
    contextEffect: "affects-context"
  },
  {
    cmd: "/diff",
    desc: "Inspect uncommitted code changes in virtual workspace vs baseline",
    category: "Workspace & Code",
    usage: "/diff",
    contextEffect: "local-only"
  },
  {
    cmd: "/files",
    desc: "List all files in virtual workspace with byte sizes and line counts",
    category: "Workspace & Code",
    usage: "/files",
    contextEffect: "local-only"
  },
  {
    cmd: "!<cmd>",
    desc: "Execute shell command on virtual files (!ls, !cat, !touch, !rm, !echo, !grep, !pwd)",
    category: "Workspace & Code",
    usage: "!<command> (e.g. !ls, !cat App.tsx, !touch test.ts)",
    contextEffect: "local-only"
  },

  // 3. Model & Context
  {
    cmd: "/model",
    desc: "View active model identifier or switch to any custom model name",
    category: "Model & Context",
    usage: "/model [model_identifier]",
    contextEffect: "affects-context"
  },
  {
    cmd: "/plan",
    desc: "Toggle Plan Mode to require structured plan before executing edits",
    category: "Model & Context",
    usage: "/plan [task_description]",
    contextEffect: "affects-context"
  },
  {
    cmd: "/compact",
    desc: "Summarize earlier message history to reduce active token consumption",
    category: "Model & Context",
    usage: "/compact",
    contextEffect: "affects-context"
  },
  {
    cmd: "/cost",
    aliases: ["/usage", "/stats", "/tokens"],
    desc: "Calculate exact token usage from active messages and estimate cost",
    category: "Model & Context",
    usage: "/cost",
    contextEffect: "local-only"
  },
  {
    cmd: "/context",
    desc: "Display visual token breakdown chart for system, chat, and VFS",
    category: "Model & Context",
    usage: "/context",
    contextEffect: "local-only"
  },

  // 4. Configuration & Tools
  {
    cmd: "/help",
    desc: "Display categorized list of commands with context indicators",
    category: "Configuration & Tools",
    usage: "/help",
    contextEffect: "local-only"
  },
  {
    cmd: "/permissions",
    aliases: ["/permission-mode", "/allowed-tools"],
    desc: "Configure granular tool policies or global permission modes (default, acceptEdits, plan, auto, dontAsk, bypassPermissions)",
    category: "Configuration & Tools",
    usage: "/permissions [tool <allow|ask|deny> | mode]",
    contextEffect: "local-only"
  },
  {
    cmd: "/config",
    aliases: ["/settings"],
    desc: "Open configuration settings modal for API key, Base URL, and params",
    category: "Configuration & Tools",
    usage: "/config",
    contextEffect: "local-only"
  },
  {
    cmd: "/status",
    desc: "Display system overview, active model, permissions, and VFS summary",
    category: "Configuration & Tools",
    usage: "/status",
    contextEffect: "local-only"
  },
  {
    cmd: "/copy",
    desc: "Copy the latest assistant response to the system clipboard",
    category: "Configuration & Tools",
    usage: "/copy",
    contextEffect: "local-only"
  },

  // 5. Keybindings & Shortcuts
  {
    cmd: "Shift+Tab",
    desc: "Toggle Plan Mode on or off",
    category: "Keybindings & Shortcuts",
    usage: "Shift+Tab",
    contextEffect: "affects-context"
  },
  {
    cmd: "Esc",
    desc: "Interrupt active streaming AI response or dismiss active modal",
    category: "Keybindings & Shortcuts",
    usage: "Esc",
    contextEffect: "local-only"
  }
];
