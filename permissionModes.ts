import { PermissionMode } from "../types";

export interface PermissionModeConfig {
  id: PermissionMode;
  name: string;
  cliFlag?: string;
  badge: string;
  color: string;
  description: string;
  ruleSummary: string;
}

export const PERMISSION_MODES: PermissionModeConfig[] = [
  {
    id: "default",
    name: "Manual Approval (default)",
    cliFlag: "--permission-mode default",
    badge: "DEFAULT",
    color: "#D97757",
    description: "Stops and prompts before every file edit, shell command execution, or network action.",
    ruleSummary: "Ask before all mutating actions. Suitable for sensitive tasks."
  },
  {
    id: "acceptEdits",
    name: "Accept File Edits (acceptEdits)",
    cliFlag: "--permission-mode acceptEdits",
    badge: "ACCEPT_EDITS",
    color: "#D97757",
    description: "Auto-approves creating/editing files and standard file system commands (mkdir, touch, rm, mv, cp, sed) in workspace.",
    ruleSummary: "Auto-approve all file system modifications inside the workspace."
  },
  {
    id: "plan",
    name: "Plan-Only Mode (plan)",
    cliFlag: "--permission-mode plan",
    badge: "PLAN_ONLY",
    color: "#D97757",
    description: "Read-only codebase exploration to formulate a structured plan. Blocks all modifications until plan approval.",
    ruleSummary: "Read-only access. Locks all modifying tools and shell writes."
  },
  {
    id: "auto",
    name: "Automated Classifier (auto)",
    cliFlag: "--permission-mode auto",
    badge: "AUTO_CLASSIFIER",
    color: "#D97757",
    description: "Uses automated classification rules to approve routine safe actions, blocking destructive/sensitive commands.",
    ruleSummary: "Auto-approve safe edits, but strictly block destructive commands, force pushes & credentials."
  },
  {
    id: "dontAsk",
    name: "Pre-allowed Tools Only (dontAsk)",
    cliFlag: "--permission-mode dontAsk",
    badge: "DONT_ASK",
    color: "#D97757",
    description: "Silently executes pre-allowed tools in configuration and automatically rejects all other unapproved tool calls.",
    ruleSummary: "Executes allowed tools automatically; rejects non-whitelisted actions without prompting."
  },
  {
    id: "bypassPermissions",
    name: "Bypass All Permissions (bypassPermissions)",
    cliFlag: "--permission-mode bypassPermissions / --dangerously-skip-permissions",
    badge: "BYPASS_ALL",
    color: "#D97757",
    description: "Automatically approves all actions without prompting. Recommended strictly in isolated sandbox containers.",
    ruleSummary: "Bypasses all safety checks and interactive approval dialogs."
  }
];

export const PERMISSION_MODE_CYCLE: PermissionMode[] = [
  "default",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions"
];

export function getNextPermissionMode(current: PermissionMode): PermissionMode {
  const idx = PERMISSION_MODE_CYCLE.indexOf(current);
  if (idx === -1) return "default";
  return PERMISSION_MODE_CYCLE[(idx + 1) % PERMISSION_MODE_CYCLE.length];
}

export function getPermissionModeConfig(mode: PermissionMode): PermissionModeConfig {
  const found = PERMISSION_MODES.find(m => m.id.toLowerCase() === (mode || "").toLowerCase());
  return found || PERMISSION_MODES[0];
}

export interface ToolPermissionEvaluation {
  allowed: boolean;
  needsPrompt: boolean;
  reason: string;
}

/**
 * Evaluates whether a tool call should be allowed, prompted, or blocked
 * according to the active Permission Mode.
 */
export function evaluateToolPermission(
  toolName: string,
  args: any,
  mode: PermissionMode,
  toolPermissionsMap: Record<string, string> = {}
): ToolPermissionEvaluation {
  const normTool = toolName === "bash" ? "execute_bash" : toolName;

  // 1. Check tool-specific permission directly if defined in toolPermissionsMap
  const specificPerm = toolPermissionsMap[normTool] || toolPermissionsMap[toolName];
  if (specificPerm) {
    const p = specificPerm.toString().toLowerCase().trim();
    if (p === "allow") {
      return {
        allowed: true,
        needsPrompt: false,
        reason: `Tool '${normTool}' is explicitly set to Allow.`
      };
    }
    if (p === "deny") {
      return {
        allowed: false,
        needsPrompt: false,
        reason: `Tool '${normTool}' is explicitly set to Deny.`
      };
    }
    if (p === "ask") {
      return {
        allowed: false,
        needsPrompt: true,
        reason: `Tool '${normTool}' is set to Ask (requires user approval).`
      };
    }
  }

  // 2. Evaluate based on active global PermissionMode if not specifically overridden
  const normalizedMode = (mode || "default").toLowerCase();

  switch (normalizedMode) {
    case "bypasspermissions":
    case "bypass":
    case "allow":
      return {
        allowed: true,
        needsPrompt: false,
        reason: "BypassPermissions mode automatically authorizes all actions."
      };

    case "plan":
      return {
        allowed: false,
        needsPrompt: false,
        reason: `Plan Mode is active (read-only). '${normTool}' cannot modify files or execute code until Plan Mode is exited.`
      };

    case "acceptedits": {
      const isFsMutation = ["write_file", "edit_file", "multi_edit_file", "delete_file"].includes(normTool);
      if (isFsMutation) {
        return {
          allowed: true,
          needsPrompt: false,
          reason: "AcceptEdits mode automatically approves workspace file modifications."
        };
      }
      if (normTool === "execute_bash") {
        const cmd = (args?.command || "").trim().toLowerCase();
        const safeFsCommands = ["mkdir", "touch", "rm", "mv", "cp", "sed", "ls", "cat", "echo", "pwd", "grep", "wc"];
        const isSafeFsCmd = safeFsCommands.some(c => cmd.startsWith(c + " ") || cmd === c);
        if (isSafeFsCmd) {
          return {
            allowed: true,
            needsPrompt: false,
            reason: "AcceptEdits mode auto-approves standard file system shell commands."
          };
        }
      }
      return {
        allowed: false,
        needsPrompt: true,
        reason: `Action '${normTool}' requires interactive confirmation under AcceptEdits mode.`
      };
    }

    case "auto": {
      if (normTool === "execute_bash") {
        const cmd = (args?.command || "").trim().toLowerCase();
        const dangerousPatterns = ["rm -rf /", ":(){ :|:& };:", "git push --force", "chmod 777"];
        if (dangerousPatterns.some(p => cmd.includes(p))) {
          return {
            allowed: false,
            needsPrompt: false,
            reason: `Auto Classifier blocked high-risk shell command: '${cmd}'`
          };
        }
      }
      const isFsMutation = ["write_file", "edit_file", "multi_edit_file", "delete_file"].includes(normTool);
      if (isFsMutation) {
        return {
          allowed: true,
          needsPrompt: false,
          reason: "Auto Classifier approved standard file mutation."
        };
      }
      return {
        allowed: false,
        needsPrompt: true,
        reason: `Auto Classifier requested user confirmation for '${normTool}'.`
      };
    }

    case "dontask": {
      const isReadOnly = ["read_file", "view_image", "glob_files", "grep_files", "list_directory", "search_web", "read_url", "file_stats"].includes(normTool);
      if (isReadOnly) {
        return {
          allowed: true,
          needsPrompt: false,
          reason: `Tool '${normTool}' is pre-allowed in DontAsk mode.`
        };
      }
      return {
        allowed: false,
        needsPrompt: false,
        reason: `DontAsk mode rejected tool '${normTool}' because it is not pre-allowed.`
      };
    }

    case "default":
    case "manual":
    case "ask":
    default: {
      const isReadOnlyTool = ["read_file", "view_image", "glob_files", "grep_files", "list_directory", "search_web", "read_url", "file_stats"].includes(normTool);
      if (isReadOnlyTool) {
        return {
          allowed: true,
          needsPrompt: false,
          reason: `Read-only tool '${normTool}' is allowed by default.`
        };
      }
      return {
        allowed: false,
        needsPrompt: true,
        reason: `Manual mode requires explicit confirmation for '${normTool}'.`
      };
    }
  }
}
