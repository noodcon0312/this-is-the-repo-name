export type Settings = {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  baseUrl: string;
  apiKey: string;
  model: string;
  systemInstruction: string;
  claudeConfigDir?: string;
  claudeProjectDirName?: string;
  skipPromptHistory?: boolean;
  apiProtocol?: "auto" | "openai-compatible" | "anthropic" | "custom";
};

export type SourceCategory = string;
export type VFS = Record<string, string>;

export type Message = {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  reasoning?: string;
  tokens?: { input: number; output: number };
  diffInfo?: any;
  isLocal?: boolean;
};

export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "plan"
  | "auto"
  | "dontAsk"
  | "bypassPermissions"
  | "Ask"
  | "Allow"
  | "Deny";

export type SessionEntry = {
  id: string;
  timestamp: number;
  lastActiveAt?: number;
  name: string;
  isCustomName?: boolean;
  vfs: VFS;
  messages: Message[];
  project?: string;
  worktree?: string;
  branch?: string;
  prNumber?: string;
  prUrl?: string;
  tokens?: number;
  permissionMode?: PermissionMode;
  toolPermissions?: Record<string, string>;
  activeSubagent?: string | null;
  parentSessionId?: string;
  isArchived?: boolean;
  neverPromptCompact?: boolean;
};

export type SessionStorageConfig = {
  configDir: string;
  projectDirName: string;
  skipPromptHistory: boolean;
};

