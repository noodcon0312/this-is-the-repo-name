import { ALL_SLASH_COMMANDS } from "../utils/commandRegistry";
import { executeSlashOrBangCommand, CommandContext } from "../utils/commandHandler";
export function extractErrorMessage(data: any, status: number, url: string): string {
  if (!data) return `HTTP Error ${status} from ${url}`;
  if (typeof data === "string") return data;
  if (typeof data.error === "string") return data.error;
  if (data.error?.message) return data.error.message;
  if (data.detail) {
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map((d: any) => (typeof d === "string" ? d : d.msg || JSON.stringify(d))).join("; ");
    }
    return JSON.stringify(data.detail);
  }
  if (data.message) return data.message;
  return JSON.stringify(data);
}

export function safeJsonParse(val: any, fallback: any = {}): any {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  if (typeof val !== "string") return fallback;
  try {
    return JSON.parse(val);
  } catch (e) {
    let cleaned = val.trim();
    if (cleaned.startsWith("{")) {
      // Try appending missing closing delimiters
      const attempts = [
        cleaned + '"}',
        cleaned + '"} }',
        cleaned + '"} ] }',
        cleaned + '" }',
        cleaned + '}',
        cleaned + '] }',
        cleaned + ']'
      ];
      for (const attempt of attempts) {
        try {
          return JSON.parse(attempt);
        } catch (_) {}
      }
    }
    return fallback;
  }
}

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Message, Settings, PermissionMode, VFS, SessionEntry } from "../types";
import { CREDIBLE_DOMAINS, findDomainProfile } from "../data/credibleSources";
import { 
  Settings as SettingsIcon, ChevronRight, Play, Loader2, AlertCircle, 
  Copy, Check, Bot, Zap, RotateCcw, Command, FileText, X, FolderGit2, GitBranch
} from "lucide-react";
import { runJavaScriptInWorker } from "../utils/codeRunner";
import { analyzePromptSecurity } from "../utils/security";
import { SessionPickerModal } from "./SessionPickerModal";
import { ResumeCompactionPrompt } from "./ResumeCompactionPrompt";
import {
  PERMISSION_MODES,
  PERMISSION_MODE_CYCLE,
  getNextPermissionMode,
  getPermissionModeConfig,
  evaluateToolPermission
} from "../utils/permissionModes";
import {
  createNewSession,
  branchSession,
  generateDefaultSessionName,
  resolveUniqueSessionName,
  shouldPromptCompactionOnResume,
  syncSessionsToVfs,
  exportSessionToJSONL
} from "../utils/sessionManager";
import { resolveBaseUrlCandidates, getProviderHeaders, getCachedProtocol } from "../utils/apiResolver";
import { getClaudeMemory } from "../utils/fileUtils";
import clawdImg from "../assets/clawd.png";

function getZoneInfo(date: Date, timeZone: string) {
  // Format as DD/MM/YYYY, HH:mm:ss
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const timeString = dtf.format(date);

  // Offset GMT
  const offsetPart = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName');

  const offset = offsetPart?.value ?? '';

  return { timeString, offset };
}

export function ClawdPixelMascot({ className = "w-16 h-12 text-[#D97757]" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 20 14" 
      fill="currentColor" 
      className={className}
      style={{ imageRendering: "pixelated", shapeRendering: "crispEdges" }}
    >
      {/* Head top bar */}
      <rect x="4" y="1" width="12" height="2" />
      {/* Forehead around eyes */}
      <rect x="3" y="3" width="3" height="3" />
      <rect x="8" y="3" width="4" height="3" />
      <rect x="14" y="3" width="3" height="3" />
      {/* Side arms */}
      <rect x="0" y="5" width="3" height="3" />
      <rect x="17" y="5" width="3" height="3" />
      {/* Lower body */}
      <rect x="3" y="6" width="14" height="3" />
      {/* 4 feet */}
      <rect x="4" y="9" width="2" height="3" />
      <rect x="7" y="9" width="2" height="3" />
      <rect x="11" y="9" width="2" height="3" />
      <rect x="14" y="9" width="2" height="3" />
    </svg>
  );
}

function buildTimeObservation(userTimeZone: string) {
  const now = new Date();

  const userLocaleString = new Intl.DateTimeFormat('en-GB', {
    timeZone: userTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  const zones = [
    { label: 'Bangkok / Indochina', tz: 'Asia/Bangkok' },
    { label: 'US East Coast (New York)', tz: 'America/New_York' },
    { label: 'US West Coast (Los Angeles)', tz: 'America/Los_Angeles' },
    { label: 'Coordinated Universal Time (UTC)', tz: 'UTC' },
    { label: 'Japan (Tokyo)', tz: 'Asia/Tokyo' },
    { label: 'UK (London)', tz: 'Europe/London' },
  ];

  let obs = `[CURRENT SYSTEM TIME AND TIME ZONE]:\n`;
  obs += `• User's local time: ${userLocaleString} (${userTimeZone})\n`;
  obs += `• Current year: ${now.getFullYear()}\n`;
  obs += `----------------------------------------\n`;
  obs += `WORLD TIME ZONE COMPARISON (At the same time):\n`;

  for (const zone of zones) {
    const { timeString, offset } = getZoneInfo(now, zone.tz);
    obs += `- ${zone.label} (${offset}): ${timeString}\n`;
  }

  obs += `----------------------------------------\n`;
  obs += `(Ask for the user's current location. Use this information to provide accurate timing details to the user)`;

  return obs;
}

const searchCache: Record<string, {
  url: string;
  title?: string;
  domain: string;
  name: string;
  snippet: string;
  content?: string;
  isReputable: boolean;
  query: string;
  totalParts: number;
  chunkSize: number;
} | any> = {};

const getOrGenerateSearchResults = async (query: string): Promise<{ results: any[]; failed: boolean; reason?: string }> => {
  const fail = (reason: string) => {
    searchCache[`_query_${query}`] = { __failed: true, reason };
    return { results: [], failed: true, reason };
  };

  try {
    const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
    const response = await fetch("/api/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: searchUrl })
    });

    if (!response.ok) {
      return fail(`Proxy request failed with HTTP ${response.status}.`);
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      return fail(data.error ? `Proxy error: ${data.error}` : "Proxy returned no data.");
    }

    const htmlText = data.data;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    const results: any[] = [];
    const elements = doc.querySelectorAll('.algo');

    elements.forEach((el, index) => {
      if (results.length >= 10) return;
      const titleEl = el.querySelector('.compTitle a');
      const urlEl = el.querySelector('.compTitle a');
      const snippetEl = el.querySelector('.compText');

      if (titleEl && urlEl) {
        let url = urlEl.getAttribute('href') || urlEl.textContent?.trim() || "";
        if (url.startsWith('//')) url = 'https:' + url;
        if (url.includes('RU=')) {
          const match = url.match(/RU=([^\/]+)/);
          if (match) url = decodeURIComponent(match[1]);
        }

        let domain = "";
        try {
          domain = new URL(url).hostname;
        } catch (e) {
          domain = "unknown";
        }

        const domainProfile = findDomainProfile(domain);
        // Prefer real domain credibility; fall back to top-3 rank only for
        // domains we don't have a credibility profile for.
        const isReputable = domainProfile ? domainProfile.baseCredibility >= 85 : index < 3;

        const item = {
          domain: domain,
          name: titleEl.textContent?.trim() || "",
          url: url,
          snippet: snippetEl?.textContent?.trim() || "",
          isReputable,
          query,
          totalParts: isReputable ? Math.ceil(15000 / 4500) : 1, // rough estimate
          chunkSize: isReputable ? 4500 : 2750
        };

        searchCache[url] = item;
        results.push(item);
      }
    });

    if (results.length > 0) {
      // Temporarily store the results list using the query string so the UI can render it immediately if needed
      searchCache[`_query_${query}`] = results;
      return { results, failed: false };
    }

    const notFoundReason = "Search engine returned a page, but no result items could be parsed from it (page layout may have changed, or the query genuinely had zero hits).";
    return fail(notFoundReason);
  } catch (err: any) {
    console.error("Search failed:", err);
    return fail(err?.message || "Unknown network/parsing error.");
  }
};

function InteractiveSearchResults({ 
  query, 
  results, 
  failedReason,
  onReadUrl 
}: { 
  query: string; 
  results: any[]; 
  failedReason?: string;
  onReadUrl?: (url: string, part: number, isReputable: boolean) => void;
}) {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [activePart, setActivePart] = useState<number>(1);
  const [quickViewSentence, setQuickViewSentence] = useState<string | null>(null);

  if (failedReason) {
    return (
      <div className="flex flex-col gap-2 p-2">
        <div className="flex items-center gap-2 text-[#f87171] text-[11px]">
          <AlertCircle size={14} />
          <span>Web search failed for "{query}": {failedReason}</span>
        </div>
      </div>
    );
  }

  const currentItem = results.find(r => r.url === activeUrl);

  const handleOpenResult = (url: string) => {
    setActiveUrl(url);
    setActivePart(1);
    setQuickViewSentence(null);
  };

  const handleNextPart = () => {
    if (currentItem && activePart < currentItem.totalParts) {
      setActivePart(prev => prev + 1);
    }
  };

  const handleQuickView = () => {
    if (!currentItem) return;
    
    const rawParts = currentItem.content.split("\n\n--PART_DIVIDER--\n\n");
    const remainingText = rawParts.slice(1).join("\n") || currentItem.content.slice(2750);
    
    const sentences = remainingText.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 10);
    const kw = query.toLowerCase().split(' ').filter(w => w.length > 2);
    
    const matchingSentences = sentences.filter(s => 
      kw.some(k => s.toLowerCase().includes(k))
    );

    const pool = matchingSentences.length > 0 ? matchingSentences : sentences;
    if (pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      setQuickViewSentence(pool[idx]);
    } else {
      setQuickViewSentence("No key sentences found in the remaining text matching your keyword.");
    }
  };

  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="text-[#888888] font-bold border-b border-[#222222] pb-1 uppercase tracking-wider">
        Web Search Results for "{query}"
      </div>
      <div className="grid grid-cols-1 gap-2.5">
        {results.map((r, idx) => {
          const isSelected = r.url === activeUrl;
          return (
            <div 
              key={idx} 
              className={`p-2.5 border transition-all ${
                isSelected 
                  ? "bg-[#161210] border-[#D97757]" 
                  : "bg-[#0d0d0d] border-[#222222] hover:border-[#444444]"
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {r.isReputable ? (
                      <span className="bg-[#2e211b] text-[#D97757] border border-[#D97757]/30 text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wider">
                        [Reputation!] ***
                      </span>
                    ) : (
                      <span className="bg-[#1a1a1a] text-[#888888] border border-[#222222] text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wider">
                        Standard Source
                      </span>
                    )}
                    <span className="text-[#555555] text-[10px]">{r.domain}</span>
                  </div>
                  <h4 
                    onClick={() => handleOpenResult(r.url)}
                    className="text-[#e5e5e5] font-bold hover:text-[#D97757] cursor-pointer hover:underline text-sm leading-tight"
                  >
                    {r.title}
                  </h4>
                </div>
                <button 
                  onClick={() => handleOpenResult(r.url)}
                  className="px-2.5 py-1 bg-[#1a1a1a] text-[#cccccc] hover:bg-[#D97757] hover:text-white transition-all text-[11px]"
                >
                  {isSelected ? "Reading" : "Read Content"}
                </button>
              </div>
              <p className="text-[#888888] text-[11px] leading-normal mt-1.5 select-text">
                {r.snippet}
              </p>
            </div>
          );
        })}
      </div>

      {activeUrl && currentItem && (
        <div className="p-3 bg-[#0a0a0a] border border-[#222222] space-y-2 mt-4 animate-slideDown">
          <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
            <span className="font-bold text-[#D97757] text-[11px] tracking-wider uppercase">
              RESOURCES INTEGRATED READER ({currentItem.name})
            </span>
            <button 
              onClick={() => setActiveUrl(null)}
              className="text-[#888888] hover:text-white"
            >
              [close reader]
            </button>
          </div>

          <div className="space-y-2 select-text font-mono text-[11px] leading-relaxed text-[#cccccc] whitespace-pre-wrap max-h-[300px] overflow-y-auto p-2 bg-[#0d0d0d] border border-[#1e1e1e]">
            {(() => {
              const rawParts = currentItem.content.split("\n\n--PART_DIVIDER--\n\n");
              let textToShow = "";
              
              if (rawParts.length >= activePart) {
                textToShow = rawParts[activePart - 1];
              } else {
                const startIdx = (activePart - 1) * currentItem.chunkSize;
                textToShow = currentItem.content.slice(startIdx, startIdx + currentItem.chunkSize);
              }

              return textToShow.slice(0, currentItem.chunkSize);
            })()}
          </div>

          <div className="flex justify-between items-center text-[10px] text-[#888888] pt-1">
            <span>
              Part {activePart}/{currentItem.totalParts} (Chunk Limit: {currentItem.chunkSize} chars)
            </span>
            <div className="flex gap-2">
              {currentItem.isReputable ? (
                activePart < currentItem.totalParts && (
                  <button 
                    onClick={handleNextPart}
                    className="px-3 py-1 bg-[#2e211b] border border-[#D97757] text-[#D97757] font-bold hover:bg-[#D97757] hover:text-white transition-all"
                  >
                    Read More (Xem thêm)
                  </button>
                )
              ) : (
                <div className="flex gap-2">
                  <button 
                    onClick={handleQuickView}
                    className="px-3 py-1 bg-[#222222] text-[#888888] hover:text-[#e5e5e5] hover:border-[#666666] border border-[#333333] transition-all"
                  >
                    Quick View (Xem nhanh)
                  </button>
                </div>
              )}
            </div>
          </div>

          {quickViewSentence && (
            <div className="p-2.5 bg-[#161210] border border-[#D97757]/30 text-[#e5e5e5] text-[11px] mt-2 animate-fadeIn font-mono leading-normal">
              <span className="font-bold text-[#D97757] block mb-1">QUICK PREVIEW CORRELATION:</span>
              "{quickViewSentence}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TerminalUIProps {
  onOpenSettings: () => void;
  settings: Settings;
  permissionMode: PermissionMode;
  onPermissionChange: (mode: PermissionMode) => void;
  vfs: VFS;
  setVfs: React.Dispatch<React.SetStateAction<VFS>>;
  onFileChanged: (path: string) => void;
  onUpdateSettings?: (newPartial: Partial<Settings>) => void;
}

const VFS_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Perform a web search query on search engines and databases to compile verified information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query to look up" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_url",
      description: "Read content of a specific web URL. Supports reading part-by-part (e.g. 1/X) to save tokens.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The exact URL of the webpage to read" },
          part: { type: "number", description: "The part index to read (1-based, e.g. 1, 2, 3...)" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read contents of a file in the VFS. Supports optional offset (line index) and limit to save tokens.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The path of the file" },
          offset: { type: "number", description: "Line number offset to start reading (1-based)" },
          limit: { type: "number", description: "Maximum number of lines to read" }
        },
        required: ["path"],
      },
    }
  },
  {
    type: "function",
    function: {
      name: "view_image",
      description: "View and visually inspect an image file from the virtual file system. Returns the image data so you can visually analyze diagrams, screenshots, or visual assets on demand. Supports png, jpg, jpeg, webp, gif, svg.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The path of the image in the virtual file system (e.g. 'screenshot.png', 'assets/icon.png')" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "file_stats",
      description: "Get file statistics (lines, characters, size in bytes) without reading full content.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "The path of the file" } },
        required: ["path"],
      }
    }
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Edit a precise string snippet in a file by replacing old_string with new_string. old_string MUST match exactly ONE location.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The path of the file" },
          old_string: { type: "string", description: "The exact string snippet to replace (must match uniquely)" },
          new_string: { type: "string", description: "The replacement string" }
        },
        required: ["path", "old_string", "new_string"],
      }
    }
  },
  {
    type: "function",
    function: {
      name: "multi_edit_file",
      description: "Apply multiple non-contiguous edits to a single file in one tool call. Batch edits into a single call to save tokens.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The path of the file to edit" },
          edits: {
            type: "array",
            description: "List of edits to apply in sequence",
            items: {
              type: "object",
              properties: {
                old_string: { type: "string", description: "Exact snippet to find (must match uniquely)" },
                new_string: { type: "string", description: "Replacement snippet" }
              },
              required: ["old_string", "new_string"]
            }
          }
        },
        required: ["path", "edits"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "glob_files",
      description: "Find file paths in VFS matching a pattern or extension (e.g. '*.py', '*.ts', 'src/*') without reading contents.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern or file extension to search (e.g. '*.py', 'src/*.tsx')" }
        },
        required: ["pattern"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_todos",
      description: "Declare, update, and track task list (todos) for complex multi-step user requests.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", description: "Action: 'get' or 'update'" },
          todos: {
            type: "array",
            description: "List of todo items to store/update",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                text: { type: "string" },
                completed: { type: "boolean" },
                active: { type: "boolean" }
              },
              required: ["text", "completed"]
            }
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delegate_subtask",
      description: "Delegate a subtask or heavy processing operation to run independently and return a concise summary to reduce main token usage.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Detailed description of the subtask to execute" },
          target_files: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of files relevant to this subtask"
          }
        },
        required: ["description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "grep_files",
      description: "Search for a string pattern or regex across files in VFS. Returns matching line numbers and snippets.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "The search pattern or regex" },
          path: { type: "string", description: "Optional specific file path to search in" }
        },
        required: ["pattern"],
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file in the virtual file system.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The path of the file" },
          content: { type: "string", description: "The content to write" }
        },
        required: ["path", "content"],
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a file from the virtual file system.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "The path of the file" } },
        required: ["path"],
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List all files in the virtual file system.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      }
    }
  },
  {
    type: "function",
    function: {
      name: "execute_bash",
      description: "Execute a bash command in a sandboxed environment. Supports ls, echo, cat.",
      parameters: {
        type: "object",
        properties: { command: { type: "string", description: "The bash command" } },
        required: ["command"],
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_code",
      description: "Execute non-empty JavaScript code with isolated scope. Direct VFS functions (writeFile, readFile, listFiles, appendFile) are available in scope. NEVER call this tool with empty or blank code.",
      parameters: {
        type: "object",
        properties: {
          language: { type: "string", description: "Language of the code (default: 'javascript')" },
          code: { type: "string", description: "The non-empty JavaScript code snippet to run", minLength: 1 }
        },
        required: ["code"],
      }
    }
  }
];

function CopyButton({ text, label, className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 text-[#888888] hover:text-[#D97757] p-1 transition-opacity duration-150 rounded text-[10px] shrink-0 font-mono select-none ${
        copied
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 group-hover/user:opacity-100 group-hover/aitext:opacity-100 group-hover/code:opacity-100 group-hover/tool:opacity-100 group-hover/diff:opacity-100"
      } ${className || ""}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check size={11} className="text-green-500" />
          <span className="text-green-500 text-[10px]">Copied</span>
        </>
      ) : (
        <>
          <Copy size={11} />
          {label && <span className="text-[10px]">{label}</span>}
        </>
      )}
    </button>
  );
}

function ThinkingBlock({ reasoning }: { key?: React.Key; reasoning: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!reasoning) return null;

  return (
    <div className="my-1 font-mono text-xs select-none">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-[#777777] hover:text-[#aaaaaa] cursor-pointer italic py-0.5"
      >
        <span className="text-[#D97757]">⏺</span>
        <span>Thinking… ({reasoning.length} chars)</span>
        <ChevronRight size={12} className={`transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} />
      </div>

      {isExpanded && (
        <div className="mt-1 p-2 bg-[#111111] border border-[#222222] text-[#888888] italic whitespace-pre-wrap leading-relaxed animate-fadeIn">
          {reasoning}
        </div>
      )}
    </div>
  );
}

function TodoListWidget({ text }: { text: string }) {
  const todoRegex = /(?:^|\n)\s*(?:-|\d+\.)\s*\[([ xX])\]\s*(.+)/g;
  const matches: { checked: boolean; label: string }[] = [];
  let match;
  while ((match = todoRegex.exec(text)) !== null) {
    matches.push({
      checked: match[1].toLowerCase() === "x",
      label: match[2].trim(),
    });
  }

  const [todoState, setTodoState] = useState(matches);

  useEffect(() => {
    setTodoState(matches);
  }, [text]);

  if (todoState.length === 0) return null;

  const completedCount = todoState.filter(t => t.checked).length;
  const progressPct = Math.round((completedCount / todoState.length) * 100);

  const toggleTask = (idx: number) => {
    setTodoState(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], checked: !next[idx].checked };
      return next;
    });
  };

  return (
    <div className="my-2 p-2.5 bg-[#111111] border border-[#262626] font-mono text-xs">
      <div className="flex items-center justify-between text-[#888888] font-bold mb-1.5 text-[11px]">
        <span className="text-[#D97757]">STEPS ({completedCount}/{todoState.length})</span>
        <span>{progressPct}%</span>
      </div>
      <div className="w-full h-1 bg-[#222222] mb-2 overflow-hidden">
        <div className="h-full bg-[#D97757] transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="space-y-1">
        {todoState.map((todo, idx) => (
          <div 
            key={idx} 
            onClick={() => toggleTask(idx)}
            className="flex items-center gap-2 cursor-pointer hover:bg-[#181818] p-1 transition-colors select-none"
          >
            <div className={`w-3.5 h-3.5 border flex items-center justify-center text-[10px] font-bold ${
              todo.checked ? "border-[#D97757] bg-[#D97757] text-white" : "border-[#444444] text-transparent"
            }`}>
              v
            </div>
            <span className={`text-xs ${todo.checked ? "line-through text-[#666666]" : "text-[#cccccc]"}`}>
              {todo.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function computeDiffLines(oldStr: string, newStr: string) {
  const oldLines = oldStr ? oldStr.split("\n") : [];
  const newLines = newStr ? newStr.split("\n") : [];
  const diffs: { type: "add" | "remove" | "same"; text: string }[] = [];

  let i = 0, j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      diffs.push({ type: "same", text: oldLines[i] });
      i++;
      j++;
    } else {
      if (j < newLines.length) {
        diffs.push({ type: "add", text: newLines[j] });
        j++;
      } else if (i < oldLines.length) {
        diffs.push({ type: "remove", text: oldLines[i] });
        i++;
      }
    }
  }
  return diffs;
}

interface ToolCallLogProps {
  key?: React.Key;
  toolName: string;
  args: any;
  result?: string;
  isPending?: boolean;
  diffInfo?: { path: string; oldContent: string; newContent: string } | null;
}

function ToolCallLog({ toolName, args, result, isPending, diffInfo }: ToolCallLogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getToolTitle = (name: string, args: any) => {
    if (name === "run_code") return `Run(${args?.language || 'js'})`;
    if (name === "read_file") return `Read(${args?.path || ''}${args?.offset ? `:${args.offset}` : ''})`;
    if (name === "view_image") return `ViewImage(${args?.path || ''})`;
    if (name === "file_stats") return `Stats(${args?.path || ''})`;
    if (name === "edit_file") return `Edit(${args?.path || ''})`;
    if (name === "multi_edit_file") return `MultiEdit(${args?.path || ''}, ${args?.edits?.length || 0} edits)`;
    if (name === "glob_files") return `Glob('${args?.pattern || ''}')`;
    if (name === "manage_todos") return `Todos(${args?.action || 'get'})`;
    if (name === "delegate_subtask") return `Subtask('${args?.description?.slice(0, 25) || ''}...')`;
    if (name === "grep_files") return `Grep('${args?.pattern || ''}')`;
    if (name === "write_file") return `Write(${args?.path || ''})`;
    if (name === "delete_file") return `Delete(${args?.path || ''})`;
    if (name === "list_directory") return `ListDir()`;
    if (name === "execute_bash") return `Bash(${args?.command || ''})`;
    return `${name}`;
  };

  let runCodeOutput: { stdout?: string; result?: any; error?: string; filesChanged?: string[] } | null = null;
  if (toolName === "run_code" && result) {
    try {
      try { runCodeOutput = JSON.parse(result); } catch (_) { runCodeOutput = { stdout: String(result) }; }
    } catch (e) {
      // ignore
    }
  }

  const copyContent = result || (typeof args === "string" ? args : JSON.stringify(args, null, 2));

  return (
    <div className="my-1.5 border border-[#222222] bg-[#111111] text-xs font-mono rounded-none">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-2.5 py-1 cursor-pointer hover:bg-[#181818] select-none text-[#888888] border-b border-[#222222]"
      >
        <div className="flex items-center gap-2 truncate pr-2">
          <span className="text-[#D97757] font-bold">⏺</span>
          <span className="font-semibold text-[#e5e5e5] truncate">
            {getToolTitle(toolName, args)}
          </span>
          {runCodeOutput?.filesChanged && runCodeOutput.filesChanged.length > 0 && !isOpen && (
            <span className="text-[#666666] text-[10px]">
              ({runCodeOutput.filesChanged.length} files written)
            </span>
          )}
          {isPending && <span className="text-[#D97757] text-[10px] animate-pulse">running...</span>}
          <span className="text-[#666666] text-[10px]">
            {isOpen ? "▼ [collapse]" : "▶ [expand]"}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="p-2 bg-[#0a0a0a] text-[11px] text-[#aaaaaa] space-y-2 animate-slideDown group/tool">
          {toolName === "run_code" && runCodeOutput?.filesChanged && runCodeOutput.filesChanged.length > 0 && (
            <div className="p-2 bg-[#111111] border border-[#1e1e1e] space-y-1">
              <div className="text-[#888888] font-bold text-[10px]">FILES WRITTEN ({runCodeOutput.filesChanged.length}):</div>
              {runCodeOutput.filesChanged.map((filePath, fIdx) => (
                <div key={fIdx} className="flex items-center gap-2 text-[#888888] text-[11px]">
                  <span className="text-[#D97757]">⏺</span>
                  <span className="text-[#cccccc]">Write({filePath})</span>
                </div>
              ))}
            </div>
          )}
          {diffInfo && (
            <div className="p-2 border border-[#222222] bg-[#0c0c0c] text-[11px] overflow-x-auto relative group/diff">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[#888888] font-bold">diff {diffInfo.path}</span>
                <CopyButton text={`+ ${diffInfo.newContent}\n- ${diffInfo.oldContent}`} label="Copy Diff" />
              </div>
              {computeDiffLines(diffInfo.oldContent, diffInfo.newContent).slice(0, 50).map((dLine, dIdx) => {
                if (dLine.type === "add") {
                  return <div key={dIdx} className="diff-added px-1 whitespace-pre">+ {dLine.text}</div>;
                } else if (dLine.type === "remove") {
                  return <div key={dIdx} className="diff-removed px-1 whitespace-pre">- {dLine.text}</div>;
                }
                return <div key={dIdx} className="text-[#666666] px-1 whitespace-pre">  {dLine.text}</div>;
              })}
            </div>
          )}

          <div>
            <div className="flex justify-between items-center text-[#666666] font-bold mb-0.5">
              <span>input</span>
            </div>
            <pre className="text-[#D97757] whitespace-pre-wrap font-mono bg-[#111111] p-1.5 border border-[#1e1e1e]">
              {typeof args === "string" ? args : JSON.stringify(args, null, 2)}
            </pre>
          </div>

          <div className="relative">
            <div className="flex justify-between items-center text-[#666666] font-bold mb-0.5">
              <span>output</span>
              <CopyButton text={copyContent} label="Copy Output" />
            </div>
            {toolName === "search_web" ? (
              <div className="p-2.5 bg-[#0a0a0a] border border-[#1e1e1e] mt-1">
                {(() => {
                  const cached = searchCache[`_query_${args.query || "latest updates"}`];
                  const isFailure = cached && !Array.isArray(cached) && cached.__failed;
                  return (
                    <InteractiveSearchResults 
                      query={args.query || "latest updates"} 
                      results={isFailure ? [] : (cached || [])} 
                      failedReason={isFailure ? cached.reason : undefined}
                    />
                  );
                })()}
              </div>
            ) : (toolName === "view_image" && typeof result === "string" && result.startsWith("data:image/")) ? (
              <div className="p-2 bg-[#0a0a0a] border border-[#1e1e1e] mt-1 space-y-1.5">
                <div className="text-[10px] text-[#888888]">
                  Image loaded: <span className="text-[#e5e5e5]">{args?.path || "image"}</span> (~{Math.round((result.length * 3) / 4096)} KB)
                </div>
                <div className="flex items-center justify-center p-2 bg-[#141414] border border-[#222222] rounded overflow-hidden">
                  <img
                    src={result}
                    alt={args?.path || "Viewed image"}
                    className="max-h-60 max-w-full object-contain rounded"
                  />
                </div>
              </div>
            ) : (
              <pre className="text-[#cccccc] whitespace-pre-wrap font-mono max-h-60 overflow-y-auto bg-[#111111] p-1.5 border border-[#1e1e1e]">
                {result || copyContent}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MarkdownCodeBlock({ lang, codeText }: { key?: React.Key; lang: string; codeText: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const lineCount = codeText.trim().split("\n").length;

  return (
    <div className="my-2 bg-[#141414] border border-[#262626] rounded-none font-mono text-xs overflow-hidden group/code">
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex justify-between items-center text-[#888888] hover:text-[#e5e5e5] text-[10px] px-2.5 py-1 bg-[#1a1a1a] select-none border-b border-[#222222] cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-[#D97757] font-mono font-bold">{lang || "code"}</span>
          <span className="text-[#666666]">({lineCount} lines)</span>
          <span className="text-[#888888] font-mono">
            {isCollapsed ? "▶ [expand]" : "▼ [collapse]"}
          </span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <CopyButton text={codeText.trim()} label="Copy Code" />
        </div>
      </div>
      {!isCollapsed && (
        <div className="p-2.5 bg-[#0d0d0d]">
          <pre className="text-[#e5e5e5] whitespace-pre-wrap overflow-x-auto leading-relaxed font-mono text-xs">
            {codeText}
          </pre>
        </div>
      )}
    </div>
  );
}

function parseInlineTerminalMarkdown(text: string): React.ReactNode[] {
  // Regex to match **bold**, __bold__, or `code`
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      const inner = part.slice(2, -2);
      return <strong key={i} className="font-bold">{inner}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      const inner = part.slice(1, -1);
      return <code key={i} className="bg-[#1c1c1c] text-[#ececec] px-1 font-mono rounded-none">{inner}</code>;
    }
    return <span key={i}>{part}</span>;
  });
}

function TerminalMarkdownText({ content }: { content: string }) {
  const codeBlockParts = content.split(/```/g);

  return (
    <div className="space-y-1">
      {codeBlockParts.map((part, idx) => {
        if (idx % 2 === 1) {
          // Inside code block ```
          const firstLineEnd = part.indexOf("\n");
          let lang = "";
          let codeText = part;
          if (firstLineEnd !== -1) {
            lang = part.slice(0, firstLineEnd).trim();
            codeText = part.slice(firstLineEnd + 1);
          }

          return (
            <MarkdownCodeBlock 
              key={`code-${idx}`} 
              lang={lang} 
              codeText={codeText} 
            />
          );
        }

        // Regular text block
        const lines = part.split("\n");
        const renderedElements = [];
        let i = 0;
        
        while (i < lines.length) {
          const line = lines[i];
          const trimmed = line.trim();

          // Horizontal rule
          if (trimmed.match(/^(?:-|\*|_){3,}$/)) {
            renderedElements.push(
              <div key={`hr-${i}`} className="my-2 border-t border-[#333]"></div>
            );
            i++;
            continue;
          }

          const isTableRow = (str: string) => {
            const t = str.trim();
            return t.startsWith('|') && t.endsWith('|');
          };
          
          const isSeparatorRow = (str: string) => {
            const t = str.trim();
            return isTableRow(t) && /^\|[-\s:|]+\|$/.test(t);
          };

          if (isTableRow(trimmed) && i + 1 < lines.length && isSeparatorRow(lines[i+1])) {
            const tableRows = [];
            let j = i;
            while (j < lines.length && isTableRow(lines[j])) {
              tableRows.push(lines[j].trim());
              j++;
            }
            
            const headers = tableRows[0].split('|').slice(1, -1).map(s => s.trim());
            const bodyRows = tableRows.slice(2).map(r => r.split('|').slice(1, -1).map(s => s.trim()));

            renderedElements.push(
              <div key={`table-${i}`} className="my-2 overflow-x-auto rounded border border-[#262626]">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#1a1a1a]">
                      {headers.map((h, hIdx) => (
                        <th key={hIdx} className="border-b border-r last:border-r-0 border-[#262626] px-3 py-1.5 text-[#D97757] font-bold">
                          {parseInlineTerminalMarkdown(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bodyRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[#1a1a1a] transition-colors border-b border-[#262626] last:border-b-0">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="border-r last:border-r-0 border-[#262626] px-3 py-1.5 text-[#ececec]">
                            {parseInlineTerminalMarkdown(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
            i = j;
            continue;
          }

          // Headings (#, ##, ###, etc.)
          if (/^#{1,6}\s+/.test(trimmed)) {
            const headingText = trimmed.replace(/^#{1,6}\s+/, "").toUpperCase();
            renderedElements.push(
              <div key={i} className="my-1.5 font-bold text-[#D97757] text-xs uppercase tracking-wide border-b border-[#262626] pb-0.5">
                {parseInlineTerminalMarkdown(headingText)}
              </div>
            );
            i++;
            continue;
          }

          if (line === "") {
            renderedElements.push(<div key={i} className="h-1" />);
            i++;
            continue;
          }

          renderedElements.push(
            <div key={i} className="text-[#ececec] leading-relaxed whitespace-pre-wrap font-mono">
              {parseInlineTerminalMarkdown(line)}
            </div>
          );
          i++;
        }

        return (
          <div key={idx} className="space-y-0.5">
            {renderedElements}
          </div>
        );
      })}
    </div>
  );
}

function TypewriterText({ content }: { content: string }) {
  const [displayedLength, setDisplayedLength] = useState(0);

  useEffect(() => {
    if (displayedLength >= content.length) return;

    const interval = setInterval(() => {
      setDisplayedLength((prev) => {
        const step = Math.max(1, Math.min(3, Math.floor((content.length - prev) / 25)));
        const next = prev + step;
        if (next >= content.length) {
          clearInterval(interval);
          return content.length;
        }
        return next;
      });
    }, 15);

    return () => clearInterval(interval);
  }, [content, displayedLength]);

  const displayedContent = content.slice(0, displayedLength);
  const isTyping = displayedLength < content.length;

  return (
    <div className="text-[#ececec] py-0.5 animate-fadeIn relative font-mono">
      <TerminalMarkdownText content={displayedContent} />
      {isTyping && (
        <span className="inline-block w-1.5 h-3 bg-[#D97757] ml-0.5 animate-cursor-blink align-middle" />
      )}
    </div>
  );
}

function isSystemLogMessage(msg: any): boolean {
  if (!msg) return false;
  if (msg.isSystemLog || msg.isLocal) return true;
  const text = (msg.content || "").trim();
  if (!text) return false;
  if (
    text.startsWith("Pruned oldest session") ||
    text.startsWith("⏺ Interrupted by user") ||
    text.startsWith("**[CONTEXT AUTOMATICALLY COMPACTED]**") ||
    text.startsWith("**Context Compacted") ||
    text.startsWith("Session conversation history has been cleared") ||
    text.startsWith("Permission Mode updated to") ||
    text.startsWith("Opened Settings") ||
    text.startsWith("Project Initialized") ||
    text.startsWith("Current session renamed to") ||
    text.startsWith("Session Branched") ||
    text.startsWith("Error:")
  ) {
    return true;
  }
  return false;
}

type RenderBlock =
  | { type: "user"; message: any }
  | { type: "system"; message: any }
  | { 
      type: "assistant_turn"; 
      reasonings: string[];
      toolCalls: { tc: any; resultObj: any }[];
      textContent: string;
      rawMessages: any[];
    };

function groupMessagesIntoRenderBlocks(messages: any[]): RenderBlock[] {
  const blocks: RenderBlock[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === "user") {
      blocks.push({ type: "user", message: msg });
      i++;
      continue;
    }

    if (isSystemLogMessage(msg)) {
      blocks.push({ type: "system", message: msg });
      i++;
      continue;
    }

    if (msg.role === "assistant" || msg.role === "tool") {
      const reasonings: string[] = [];
      const toolCalls: { tc: any; resultObj: any }[] = [];
      const textParts: string[] = [];
      const rawMessages: any[] = [];

      while (i < messages.length) {
        const curr = messages[i];

        if (curr.role === "user" || isSystemLogMessage(curr)) {
          break;
        }

        if (curr.role === "assistant") {
          rawMessages.push(curr);
          if (curr.reasoning && !reasonings.includes(curr.reasoning)) {
            reasonings.push(curr.reasoning);
          }
          if (curr.content) {
            const sanitized = curr.content
              .replace(/<think>[\s\S]*?<\/think>/gi, "")
              .replace(/<\/think>/gi, "")
              .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
              .replace(/<tool_calls>[\s\S]*?<\/tool_calls>/gi, "")
              .replace(/<function(?:=|\s+name=|\s*=\s*)["']?[^>"\s]+["']?>[\s\S]*?<\/function>/gi, "")
              .replace(/\[(?:Called tool|Calling tool|tool_call|tool)[\s\S]*?\]/gi, "")
              .split("\n")
              .filter((l: string) => !l.trim().startsWith(">>>"))
              .join("\n")
              .trim();
            if (sanitized && !textParts.includes(sanitized)) {
              textParts.push(sanitized);
            }
          }
          if (curr.tool_calls && Array.isArray(curr.tool_calls)) {
            for (const tc of curr.tool_calls) {
              const toolResObj = messages.find(m => m.role === "tool" && m.tool_call_id === tc.id);
              toolCalls.push({ tc, resultObj: toolResObj });
            }
          }
        }

        i++;
      }

      blocks.push({
        type: "assistant_turn",
        reasonings,
        toolCalls,
        textContent: textParts.join("\n\n"),
        rawMessages
      });

      continue;
    }

    i++;
  }

  return blocks;
}

export function TerminalUI({ 
  onOpenSettings, settings, permissionMode, onPermissionChange, 
  vfs, setVfs, onFileChanged, onUpdateSettings 
}: TerminalUIProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("claude-code-messages-v2");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);
  const skipCooldownRef = useRef(false);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [isPlanMode, setIsPlanMode] = useState(false);
  const [showApiKeyNotice, setShowApiKeyNotice] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAgentsModalOpen, setIsAgentsModalOpen] = useState(false);
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isTosModalOpen, setIsTosModalOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [memoryContent, setMemoryContent] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Sync memoryContent with latest CLAUDE.md from virtual file system when memory modal opens
  useEffect(() => {
    if (isMemoryModalOpen) {
      const activeMemory = getClaudeMemory(vfsRef.current) || vfsRef.current["CLAUDE.md"] || "";
      setMemoryContent(activeMemory);
    }
  }, [isMemoryModalOpen]);
  const [activeSubagent, setActiveSubagent] = useState<string | null>(null);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdHistoryIdx, setCmdHistoryIdx] = useState<number>(-1);
  const [usePlainCommandsOnly, setUsePlainCommandsOnly] = useState(false);


  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1200);
  };

  const [toolPermissions, setToolPermissions] = useState<Record<string, PermissionMode>>({
    read_file: "Allow",
    view_image: "Allow",
    file_stats: "Allow",
    glob_files: "Allow",
    grep_files: "Allow",
    edit_file: "Ask",
    multi_edit_file: "Ask",
    write_file: "Ask",
    delete_file: "Ask",
    run_code: "Ask",
    execute_bash: "Ask"
  });

  const [isSessionPickerOpen, setIsSessionPickerOpen] = useState(false);
  const [isCompactionPromptOpen, setIsCompactionPromptOpen] = useState(false);
  const [pendingResumeSession, setPendingResumeSession] = useState<SessionEntry | null>(null);

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `session-${Date.now().toString(36)}`);
  const [currentSessionName, setCurrentSessionName] = useState<string>(() => generateDefaultSessionName("workspace").name);
  const [isCustomSessionName, setIsCustomSessionName] = useState<boolean>(false);
  const [currentProject, setCurrentProject] = useState<string>(() => settings.claudeProjectDirName || "workspace");
  const [currentWorktree, setCurrentWorktree] = useState<string>("main");
  const [currentBranch, setCurrentBranch] = useState<string>("main");
  const [currentPrNumber, setCurrentPrNumber] = useState<string | undefined>(undefined);

  const [todosList, setTodosList] = useState<any[]>([]);
  const [savedSessions, setSavedSessions] = useState<SessionEntry[]>(() => {
    const saved = localStorage.getItem("claude-code-sessions-history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((s: SessionEntry) => s && s.messages && s.messages.length > 0);
          return valid.slice(0, 5);
        }
      } catch (e) {}
    }
    return [
      {
        id: "session-auth-42",
        name: "fix-oauth-tokens",
        isCustomName: true,
        timestamp: Date.now() - 3600000 * 24,
        lastActiveAt: Date.now() - 3600000 * 5,
        project: "workspace",
        worktree: "fix/oauth",
        branch: "fix/oauth",
        prNumber: "42",
        prUrl: "https://github.com/anthropic/claude-code/pull/42",
        tokens: 9800,
        permissionMode: "Ask",
        vfs: { ...vfs },
        messages: [
          { role: "user", content: "Review and fix OAuth bearer token parsing in auth proxy." },
          { role: "assistant", content: "Analyzed auth handler. Added fallback token extractor and unit tests." }
        ]
      },
      {
        id: "session-core-101",
        name: "backend-api-core",
        isCustomName: true,
        timestamp: Date.now() - 3600000 * 48,
        lastActiveAt: Date.now() - 3600000 * 3,
        project: "backend-api",
        worktree: "main",
        branch: "feat/rate-limit",
        prNumber: "101",
        prUrl: "https://github.com/anthropic/claude-code/pull/101",
        tokens: 112000,
        permissionMode: "Allow",
        vfs: { ...vfs },
        messages: [
          { role: "user", content: "Implement 3s throttle rate limit cooldown across all API worker loops." },
          { role: "assistant", content: "Completed 3s cooldown implementation. Context usage expanded past 100k tokens." }
        ]
      },
      {
        id: "session-mobile-ui",
        name: "mobile-app-ui",
        isCustomName: false,
        timestamp: Date.now() - 3600000 * 12,
        lastActiveAt: Date.now() - 3600000 * 2,
        project: "mobile-app",
        worktree: "main",
        branch: "main",
        tokens: 3400,
        permissionMode: "Ask",
        vfs: { ...vfs },
        messages: [
          { role: "user", content: "Create responsive mobile navigation bar with Tailwind CSS." },
          { role: "assistant", content: "Designed touch-friendly mobile bar with 44px hit targets." }
        ]
      }
    ];
  });

  const permissionModeRef = useRef<PermissionMode>(permissionMode);
  useEffect(() => {
    permissionModeRef.current = permissionMode;
  }, [permissionMode]);

  const toolPermissionsRef = useRef<Record<string, string>>(toolPermissions);
  useEffect(() => {
    toolPermissionsRef.current = toolPermissions;
  }, [toolPermissions]);

  const sessionStartVfsRef = useRef<Record<string, string>>({ ...vfs });
  const [currentCheckpointIndex, setCurrentCheckpointIndex] = useState<number>(0);
  const currentCheckpointIndexRef = useRef<number>(0);
  useEffect(() => { currentCheckpointIndexRef.current = currentCheckpointIndex; }, [currentCheckpointIndex]);

  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const [checkpoints, setCheckpoints] = useState<{ id: string; label: string; timestamp: number; vfs: Record<string, string>; messageIndex?: number }[]>(() => [
    { id: "cp-0", label: "Initial state", timestamp: Date.now(), vfs: JSON.parse(JSON.stringify(vfs)), messageIndex: 0 }
  ]);

  const recordCheckpoint = (label: string, newVfs: Record<string, string>) => {
    const deepVfs = JSON.parse(JSON.stringify(newVfs));
    setCheckpoints(prev => {
      const baseIdx = currentCheckpointIndexRef.current;
      const truncated = prev.slice(0, baseIdx + 1);
      const newCpId = `cp-${truncated.length}`;
      const newCp = {
        id: newCpId,
        label,
        timestamp: Date.now(),
        vfs: deepVfs,
        messageIndex: messagesRef.current.length
      };
      const nextList = [...truncated, newCp];
      const newIdx = nextList.length - 1;
      setCurrentCheckpointIndex(newIdx);
      return nextList;
    });
  };

  const createCheckpoint = (label: string) => {
    recordCheckpoint(label || "Manual Checkpoint", vfsRef.current);
  };

  const [pendingPermission, setPendingPermission] = useState<{
    action: string;
    resolve: (allowed: boolean) => void;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);
  const timerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastEscTimeRef = useRef<number>(0);
  const lastCtrlCTimeRef = useRef<number>(0);

  const vfsRef = useRef(vfs);
  useEffect(() => { vfsRef.current = vfs; }, [vfs]);

  // Handle scroll detection
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      if (scrollHeight - scrollTop - clientHeight < 80) {
        isUserScrolledUpRef.current = false;
      } else {
        isUserScrolledUpRef.current = true;
      }
    }
  };

  // Persist messages to localStorage
  useEffect(() => {
    localStorage.setItem("claude-code-messages-v2", JSON.stringify(messages));
  }, [messages]);

  // Estimate total token usage & context window %
  const totalChars = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
  const estimatedTokens = Math.round(totalChars / 4);
  const contextPct = Math.min(100, Math.round((estimatedTokens / 128000) * 100));

  // Automatic context compaction when threshold reached (>80%)
  useEffect(() => {
    if (contextPct >= 80 && messages.length > 8 && !isLoading) {
      const summaryMsg: Message = {
        role: "assistant",
        content: `**[CONTEXT AUTOMATICALLY COMPACTED]**\nCompacted earlier history (${messages.length} messages) because context usage reached ${contextPct}%. Kept active VFS files and recent messages intact.`
      };
      const recent = messages.slice(-4);
      setMessages([summaryMsg, ...recent]);
    }
  }, [contextPct, messages.length, isLoading]);

  const slashSuggestions = useMemo(() => {
    if (!input.startsWith("/")) return [];
    const query = input.split(" ")[0].toLowerCase();
    return ALL_SLASH_COMMANDS.filter(i => 
      i.cmd.toLowerCase().startsWith(query) || 
      (i.aliases && i.aliases.some(a => a.toLowerCase().startsWith(query)))
    );
  }, [input]);

  useEffect(() => {
    if (scrollRef.current && !isUserScrolledUpRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, thinkingTime, pendingPermission, showApiKeyNotice]);

  useEffect(() => {
    if (isLoading) {
      setThinkingTime(0);
      timerRef.current = setInterval(() => {
        setThinkingTime(t => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading]);

  // Shortcuts: ESC to interrupt, Shift+Tab to cycle Permission Modes, Ctrl+K command palette, Ctrl+L clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isLoading) {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
          setIsLoading(false);
          setMessages(prev => [...prev, { role: "assistant", content: "⏺ Interrupted by user." }]);
        }
      } else if (e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        const nextMode = getNextPermissionMode(permissionModeRef.current);
        permissionModeRef.current = nextMode;
        onPermissionChange(nextMode);
        setIsPlanMode(nextMode === "plan");
        const cfg = getPermissionModeConfig(nextMode);
        showToast(`Mode: ${cfg.name}`);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(p => !p);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setMessages([]);
      } else if (pendingPermission) {
        if (e.key === "1") {
          e.preventDefault();
          handlePermissionDecision(true);
        } else if (e.key === "2") {
          e.preventDefault();
          permissionModeRef.current = "bypassPermissions";
          onPermissionChange("bypassPermissions");
          handlePermissionDecision(true);
        } else if (e.key === "3") {
          e.preventDefault();
          handlePermissionDecision(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, pendingPermission]);

  const requestInlinePermission = (action: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setPendingPermission({ action, resolve });
    });
  };

  const handlePermissionDecision = (allowed: boolean) => {
    if (pendingPermission) {
      pendingPermission.resolve(allowed);
      setPendingPermission(null);
    }
  };

  const MAX_SESSIONS = 5;

  const saveCurrentSession = () => {
    if (settings.skipPromptHistory) return;
    if (!messages || messages.length === 0) return;

    const currentSessionObj: SessionEntry = {
      id: currentSessionId,
      name: currentSessionName,
      isCustomName: isCustomSessionName,
      timestamp: Date.now(),
      lastActiveAt: Date.now(),
      vfs: JSON.parse(JSON.stringify(vfsRef.current)),
      messages: JSON.parse(JSON.stringify(messages)),
      project: currentProject,
      worktree: currentWorktree,
      branch: currentBranch,
      prNumber: currentPrNumber,
      tokens: estimatedTokens,
      permissionMode: permissionMode,
      toolPermissions: JSON.parse(JSON.stringify(toolPermissions)),
      activeSubagent: activeSubagent
    };

    setSavedSessions(prev => {
      const filtered = prev.filter(s => s.id !== currentSessionId && s.messages && s.messages.length > 0);
      let list = [currentSessionObj, ...filtered];

      let prunedName: string | null = null;
      let prunedId: string | null = null;

      if (list.length > MAX_SESSIONS) {
        const candidates = list.filter(s => s.id !== currentSessionId);
        candidates.sort((a, b) => (a.lastActiveAt || a.timestamp) - (b.lastActiveAt || b.timestamp));

        if (candidates.length > 0) {
          const oldest = candidates[0];
          prunedName = oldest.name;
          prunedId = oldest.id;
          list = list.filter(s => s.id !== oldest.id);
        }
      }

      const updated = list.slice(0, MAX_SESSIONS);

      try {
        localStorage.setItem("claude-code-sessions-history", JSON.stringify(updated));
      } catch (_) {}

      if (prunedName && prunedId) {
        // Prevent StrictMode duplicate execution by checking if we already scheduled a prune msg for this session recently
        const recentPrunes = (window as any)._recentPrunes || new Set();
        if (!recentPrunes.has(prunedId)) {
           recentPrunes.add(prunedId);
           (window as any)._recentPrunes = recentPrunes;
           setTimeout(() => {
             setMessages(m => [
               ...m,
               {
                 role: "assistant",
                 content: `Pruned oldest session (${prunedName}) to stay within local session limit`,
                 isSystemLog: true
               }
             ]);
           }, 50);
        }
      }

      return updated;
    });

    // Mirror to virtual file system under config dir
    setVfs(prev => syncSessionsToVfs(
      [currentSessionObj],
      prev,
      settings.claudeConfigDir || "~/.claude",
      settings.claudeProjectDirName || currentProject,
      settings.model || "claude-code"
    ));
  };

  const applyResumeSession = (session: SessionEntry, compactNow: boolean = false) => {
    let sessionMessages = [...session.messages];
    if (compactNow && sessionMessages.length > 2) {
      const summaryMsg: Message = {
        role: "assistant",
        content: `**Context Compacted on Session Resume**: Preserved core task objectives, workspace file state (${Object.keys(session.vfs || {}).length} files), and active rules. Trimmed older turn history to optimize token capacity.`
      };
      const recent = sessionMessages.slice(-4);
      sessionMessages = [summaryMsg, ...recent];
    }

    setMessages(JSON.parse(JSON.stringify(sessionMessages)));
    if (session.vfs && Object.keys(session.vfs).length > 0) {
      setVfs(JSON.parse(JSON.stringify(session.vfs)));
    }
    setCurrentSessionId(session.id);
    setCurrentSessionName(session.name);
    setIsCustomSessionName(!!session.isCustomName);
    if (session.project) setCurrentProject(session.project);
    if (session.worktree) setCurrentWorktree(session.worktree);
    if (session.branch) setCurrentBranch(session.branch);
    if (session.prNumber) setCurrentPrNumber(session.prNumber);
    if (session.permissionMode) {
      onPermissionChange(session.permissionMode);
    }
    if (session.toolPermissions) {
      setToolPermissions(session.toolPermissions);
    }
    if (session.activeSubagent !== undefined) {
      setActiveSubagent(session.activeSubagent);
    }
    // Ensure Plan Mode is OFF by default when resuming any session
    setIsPlanMode(false);

    setIsSessionPickerOpen(false);
    setIsCompactionPromptOpen(false);
    setPendingResumeSession(null);
    showToast(`Resumed session: ${session.name}`);
  };

  const handleResumeSession = (session: SessionEntry) => {
    if (shouldPromptCompactionOnResume(session)) {
      setPendingResumeSession(session);
      setIsCompactionPromptOpen(true);
    } else {
      applyResumeSession(session);
    }
  };

  const handleRenameSession = (sessionId: string, newName: string) => {
    const resolved = resolveUniqueSessionName(newName, savedSessions, sessionId);
    setSavedSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { ...s, name: resolved, isCustomName: true } : s);
      if (!settings.skipPromptHistory) {
        try {
          localStorage.setItem("claude-code-sessions-history", JSON.stringify(updated));
        } catch (_) {}
      }
      return updated;
    });
    if (sessionId === currentSessionId) {
      setCurrentSessionName(resolved);
      setIsCustomSessionName(true);
    }
    showToast(`Session renamed to: ${resolved}`);
  };

  const handleBranchSession = (customName?: string) => {
    saveCurrentSession();

    const currentSessionObj: SessionEntry = {
      id: currentSessionId,
      name: currentSessionName,
      isCustomName: isCustomSessionName,
      timestamp: Date.now(),
      lastActiveAt: Date.now(),
      vfs: JSON.parse(JSON.stringify(vfsRef.current)),
      messages: JSON.parse(JSON.stringify(messages)),
      project: currentProject,
      worktree: currentWorktree,
      branch: currentBranch,
      prNumber: currentPrNumber,
      permissionMode: permissionMode,
      toolPermissions: JSON.parse(JSON.stringify(toolPermissions)),
      activeSubagent: activeSubagent
    };

    const forked = branchSession(currentSessionObj, customName, vfsRef.current, messages);

    setSavedSessions(prev => {
      const filtered = prev.filter(s => s.id !== forked.id);
      const updated = [forked, ...filtered];
      if (!settings.skipPromptHistory) {
        try {
          localStorage.setItem("claude-code-sessions-history", JSON.stringify(updated));
        } catch (_) {}
      }
      return updated;
    });

    setCurrentSessionId(forked.id);
    setCurrentSessionName(forked.name);
    setIsCustomSessionName(true);
    setVfs(JSON.parse(JSON.stringify(forked.vfs)));
    setMessages(JSON.parse(JSON.stringify(forked.messages)));
    setCheckpoints(prev => JSON.parse(JSON.stringify(prev)));
    showToast(`Branched new session: ${forked.name}`);
  };

  const handleDeleteSession = (sessionId: string) => {
    setSavedSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      if (!settings.skipPromptHistory) {
        try {
          localStorage.setItem("claude-code-sessions-history", JSON.stringify(updated));
        } catch (_) {}
      }
      return updated;
    });
    showToast(`Session deleted`);
  };

  const handleClearSession = () => {
    saveCurrentSession();
    const newSess = createNewSession({ project: currentProject, worktree: currentWorktree, branch: currentBranch });
    setMessages([]);
    setCurrentSessionId(newSess.id);
    setCurrentSessionName(newSess.name);
    setIsCustomSessionName(false);
  };

  const alignMessagesForAPI = (rawMessages: any[], includeTools: boolean, actualProtocol: string = "openai-compatible") => {
    const cleaned: any[] = [];
    
    for (const m of rawMessages) {
      if (!m || m.isLocal) continue;
      
      const { name, diffInfo, reasoning, tokens, isLocal, ...rest } = m;
      const role = m.role;
      
      if (role === "system") {
        cleaned.push({
          role: m.role,
          content: m.content || ""
        });
      } else if (role === "user") {
        const scan = analyzePromptSecurity(typeof m.content === "string" ? m.content : (Array.isArray(m.content) ? JSON.stringify(m.content) : "Continue"));
        cleaned.push({
          role: "user",
          content: Array.isArray(m.content) ? m.content : (scan.sanitizedPrompt || "Continue")
        });
      } else if (role === "assistant") {
        let rawContent = typeof m.content === "string" ? m.content : "";
        // Clean away any leftover raw >>> commands from past turns
        const cleanContent = rawContent
          .split("\n")
          .filter((l: string) => !l.trim().startsWith(">>>"))
          .join("\n")
          .trim();

        if (!includeTools) {
          let textContent = cleanContent;
          if (m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
            const serializedCalls = m.tool_calls.map((tc: any) => {
              const name = tc.function?.name || "";
              let args: any = {};
              try {
                args = typeof tc.function?.arguments === "string" 
                  ? JSON.parse(tc.function.arguments) 
                  : (tc.function?.arguments || {});
              } catch (e) {
                args = {};
              }

              if (name === "list_directory") return `>>> LIST_DIRECTORY`;
              if (name === "read_file" && args.path) return `>>> READ path="${args.path}"`;
              if (name === "write_file" && args.path) return `>>> WRITE path="${args.path}"\n${args.content || ""}`;
              if (name === "edit_file" && args.path) return `>>> EDIT path="${args.path}"\nOLD:${args.old_string || ""}\nNEW:${args.new_string || ""}`;
              if (name === "run_code" && args.code) return `>>> RUN language="javascript"\n${args.code}`;
              if (name === "search_web" && args.query) return `>>> SEARCH_WEB query="${args.query}"`;
              if (name === "read_url" && args.url) return `>>> READ_URL url="${args.url}"`;
              return `>>> ${name.toUpperCase()} ${JSON.stringify(args)}`;
            }).join("\n");
            textContent = (textContent ? textContent + "\n" : "") + serializedCalls;
          }
          cleaned.push({
            role: "assistant",
            content: textContent || "Executing command..."
          });
        } else {
          const assistantMsg: any = {
            role: "assistant",
            content: cleanContent || null
          };
          if (m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
            assistantMsg.tool_calls = m.tool_calls.map((tc: any) => {
              const funcArgs = typeof tc.function?.arguments === "string" 
                ? tc.function.arguments 
                : JSON.stringify(tc.function?.arguments || {});
              return {
                id: tc.id,
                type: "function",
                function: {
                  name: tc.function?.name,
                  arguments: funcArgs
                }
              };
            });
          }
          cleaned.push(assistantMsg);
        }
      } else if (role === "tool") {
        const isImageData = typeof m.content === "string" && m.content.startsWith("data:image/");

        if (!includeTools) {
          if (isImageData) {
            if (actualProtocol === "anthropic") {
              const [prefix, base64] = m.content.split(",");
              const mimeType = prefix.replace("data:", "").replace(";base64", "") || "image/png";
              cleaned.push({
                role: "user",
                content: [
                  { type: "text", text: `[Image result for command ${m.name || "view_image"}]:` },
                  {
                    type: "image",
                    source: { type: "base64", media_type: mimeType, data: base64 }
                  }
                ]
              });
            } else {
              cleaned.push({
                role: "user",
                content: [
                  { type: "text", text: `[Image result for command ${m.name || "view_image"}]:` },
                  {
                    type: "image_url",
                    image_url: { url: m.content }
                  }
                ]
              });
            }
          } else {
            cleaned.push({
              role: "user",
              content: `[Result for command ${m.name || ""}]:\n${m.content || ""}`
            });
          }
        } else {
          if (isImageData) {
            if (actualProtocol === "anthropic") {
              const [prefix, base64] = m.content.split(",");
              const mimeType = prefix.replace("data:", "").replace(";base64", "") || "image/png";
              cleaned.push({
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: m.tool_call_id,
                    content: [
                      {
                        type: "image",
                        source: { type: "base64", media_type: mimeType, data: base64 }
                      }
                    ]
                  }
                ]
              });
            } else {
              cleaned.push({
                role: "tool",
                tool_call_id: m.tool_call_id,
                name: m.name || "view_image",
                content: [
                  {
                    type: "image_url",
                    image_url: { url: m.content }
                  }
                ]
              });
            }
          } else {
            cleaned.push({
              role: "tool",
              content: m.content || "",
              tool_call_id: m.tool_call_id,
              name: m.name
            });
          }
        }
      } else {
        cleaned.push({
          role: role,
          content: m.content || ""
        });
      }
    }

    const systemMsgs = cleaned.filter(m => m.role === "system");
    const nonSystemMsgs = cleaned.filter(m => m.role !== "system");

    const alternated: any[] = [];
    for (const msg of nonSystemMsgs) {
      if (alternated.length === 0) {
        alternated.push(msg);
      } else {
        const prev = alternated[alternated.length - 1];
        if (prev.role === msg.role && (msg.role === "user" || (msg.role === "assistant" && !prev.tool_calls && !msg.tool_calls))) {
          prev.content = (prev.content || "") + "\n\n" + (msg.content || "");
        } else {
          alternated.push(msg);
        }
      }
    }

    if (alternated.length === 0) {
      alternated.push({ role: "user", content: "Hello" });
    } else {
      const lastMsg = alternated[alternated.length - 1];
      if (lastMsg.role !== "user") {
        if (lastMsg.role === "tool" && includeTools) {
          // Allowed in native tools
        } else {
          alternated.push({ role: "user", content: "Please continue and execute the next steps." });
        }
      }
    }

    const mergedSystemContent = systemMsgs.map(m => m.content).filter(Boolean).join("\n\n");
    const finalSystem = mergedSystemContent ? [{ role: "system", content: mergedSystemContent }] : [];

    return [...finalSystem, ...alternated];
  };

  const callOpenAI = async (currentMessages: any[], forceNoTools = false) => {
    abortControllerRef.current = new AbortController();
    
    let baseUrl = settings.baseUrl.trim();
    const actualProtocol = (settings.apiProtocol && settings.apiProtocol !== "auto") 
      ? settings.apiProtocol 
      : getCachedProtocol(baseUrl);

    const candidates = actualProtocol === "custom"
      ? [baseUrl]
      : resolveBaseUrlCandidates(baseUrl, settings.model);

    // Remove duplicates
    const uniqueCandidates = Array.from(new Set(candidates)).filter(Boolean);
    
    // Detect user intent: user_want_code, user_want_search, or user_just_chat_normal
    const latestUserMsg = [...currentMessages].reverse().find(m => m.role === "user")?.content || "";
    const latestScan = analyzePromptSecurity(latestUserMsg);
    const intent = detectUserIntent(latestUserMsg, currentMessages);

    const localNow = new Date();
    const dynamicDateStr = localNow.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const dynamicYear = localNow.getFullYear();

    // Read CLAUDE.md memory file dynamically from virtual file system on EVERY request
    const claudeMemory = getClaudeMemory(vfsRef.current);
    if (claudeMemory) {
      console.log("[CLAUDE.md Memory loaded from VFS]:", claudeMemory);
    }

    let systemPrompt = buildModularSystemPrompt(
      intent,
      dynamicDateStr,
      dynamicYear,
      isPlanMode,
      latestScan.isUnsafeWarningRequired,
      settings.systemInstruction,
      !forceNoTools && !usePlainCommandsOnly,
      claudeMemory
    );

    console.log("[Final System Prompt sent to AI]:", systemPrompt);

    if (forceNoTools || usePlainCommandsOnly) {
      // Native tool calling isn't available, so the model can only act via
      // these plain-text commands. This block used to be added only when
      // intent === "user_want_code", which meant a search-intent turn never
      // received the SEARCH_WEB syntax at all -- the model was told to
      // "always call search_web" but had no way to actually do so, so it
      // silently fell back to answering from memory. Always include the
      // full syntax so search (and every other command) stays available
      // regardless of which intent was detected.
      systemPrompt += `\n\n### COMMAND SYNTAX
>>> SEARCH_WEB query="<search query>"
>>> READ_URL url="<url>" part=<optional page number, default 1>
>>> SEARCH pattern="<regex>" path="<optional path>">
>>> LIST_DIRECTORY
>>> READ path="<file path>"
>>> VIEW_IMAGE path="<file path>"
>>> EDIT path="<file path>"
OLD:<old_string>
NEW:<new_string>
>>> WRITE path="<file path>"
<content>
>>> RUN language="javascript"
<code>`;
      if (intent === "user_want_search") {
        systemPrompt += `\n\nFor this request, use >>> SEARCH_WEB query="..." before answering. Do not use >>> SEARCH (that command searches local files, not the web).`;
      }
    }

    const includeTools = !forceNoTools && !usePlainCommandsOnly;
    const rawWithSystem = [
      { role: "system", content: systemPrompt },
      ...currentMessages
    ];
    let sanitizedApiMessages = alignMessagesForAPI(rawWithSystem, includeTools, actualProtocol);

    let lastError: Error | null = null;

    for (let urlCandidate of uniqueCandidates) {
      if (actualProtocol === "anthropic") {
        if (urlCandidate.endsWith("/chat/completions")) {
          urlCandidate = urlCandidate.replace("/chat/completions", "/messages");
        } else if (!urlCandidate.endsWith("/messages")) {
          urlCandidate = urlCandidate.replace(/\/$/, "") + "/messages";
        }
      }

      try {
        const configuredMaxTokens = settings.max_tokens || 4096;
        const payload: any = {
          model: settings.model,
          messages: sanitizedApiMessages,
          temperature: settings.temperature !== undefined ? settings.temperature : 0.5,
          top_p: settings.top_p,
          max_tokens: configuredMaxTokens
        };

        if (includeTools) {
          payload.tools = VFS_TOOLS;
          payload.tool_choice = "auto";
        }

        const fetchHeaders = getProviderHeaders(urlCandidate, settings.apiKey, actualProtocol);

        // Primary LLM proxy to eliminate CORS restrictions and output exact error details
        try {
          const proxyRes = await fetch("/api/llm-proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortControllerRef.current.signal,
            body: JSON.stringify({
              url: urlCandidate,
              headers: fetchHeaders,
              payload
            })
          });

          const proxyData = await proxyRes.json().catch(() => null);

          if (proxyRes.ok && proxyData && !proxyData.error) {
            return proxyData;
          }

          // Handle 402 auto retry with lower max tokens
          if (proxyRes.status === 402 && payload.max_tokens > 2048) {
            payload.max_tokens = 2048;
            const retryRes = await fetch("/api/llm-proxy", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: abortControllerRef.current.signal,
              body: JSON.stringify({ url: urlCandidate, headers: fetchHeaders, payload })
            });
            const retryData = await retryRes.json().catch(() => null);
            if (retryRes.ok && retryData && !retryData.error) return retryData;
          }

          const extractedErr = extractErrorMessage(proxyData, proxyRes.status, urlCandidate);
          lastError = new Error(`API Error (${proxyRes.status}) on URL ${urlCandidate}:\n${extractedErr}`);
        } catch (proxyError: any) {
          if (proxyError.name === "AbortError") throw proxyError;
          lastError = proxyError;
        }

        if (!lastError) {
          // Direct browser fetch fallback if proxy failed locally
          const res = await fetch(urlCandidate, {
            method: "POST",
            headers: fetchHeaders,
            signal: abortControllerRef.current.signal,
            body: JSON.stringify(payload),
          });

          const rawResponseText = await res.text();
          let parsedJson: any = null;

          try {
            parsedJson = JSON.parse(rawResponseText);
          } catch (jsonErr) {
            if (rawResponseText.trim().startsWith("<") || rawResponseText.toLowerCase().includes("<!doctype")) {
              throw new Error(`API returned an HTML webpage instead of JSON (Status ${res.status}) at ${urlCandidate}.`);
            }
            throw new Error(`Invalid JSON response from ${urlCandidate} (Status ${res.status}): ${rawResponseText.slice(0, 200)}`);
          }

          if (!res.ok) {
            const errMsg = parsedJson?.error?.message || parsedJson?.detail || parsedJson?.message || rawResponseText;
            throw new Error(`API Error (${res.status}) on URL ${urlCandidate}: ${typeof errMsg === "object" ? JSON.stringify(errMsg) : errMsg}`);
          }

          return parsedJson;
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          throw err;
        }
        lastError = err;
      }
    }

    throw lastError || new Error("Failed to call API after trying all candidate URLs.");
  };

  const executeTool = async (toolCall: any): Promise<{ resultString: string; diffInfo?: any }> => {
    const args = typeof toolCall.function?.arguments === "string" 
      ? safeJsonParse(toolCall.function.arguments, {}) 
      : toolCall.function?.arguments || {};
    const name = toolCall.function.name;
    
    // Evaluate permissions strictly against the active permissionMode
    const evaluation = evaluateToolPermission(name, args, permissionModeRef.current, toolPermissionsRef.current);

    let isAllowed = evaluation.allowed;
    if (evaluation.needsPrompt) {
      isAllowed = await requestInlinePermission(`${name}(${args?.path || args?.command || ''})`);
    }

    if (!isAllowed) {
      return { resultString: JSON.stringify({ error: `Permission denied: ${evaluation.reason}` }) };
    }

    try {
      switch (name) {
        case "search_web": {
          const query = args.query || "latest updates";
          const { results, failed, reason } = await getOrGenerateSearchResults(query);

          const now = new Date();
          const currentDateStr = now.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

          if (failed || results.length === 0) {
            return {
              resultString: `Web search FAILED for "${query}" (Current Date: ${currentDateStr}). Reason: ${reason || "No results."}\n\nDo NOT invent or assume search results. Tell the user, in their own language, that the web search is currently unavailable, and answer only from what you already reliably know (clearly noting it may be out of date), or ask them to try again.`
            };
          }

          const formattedResults = results.map((r, idx) => {
            return `${idx + 1}. Title: ${r.name}\n   URL: ${r.url}\n   Snippet: ${r.snippet}\n`;
          }).join("\n");

          return {
            resultString: `Search results for "${query}" (Current Date: ${currentDateStr}):\n\n${formattedResults}\n\nIMPORTANT: These snippets may be in a different language than the user. Reply to the user in the same language THEY used in their own message, not the language of these results. ALWAYS call the 'read_url' tool on the most relevant URL to get full information before answering. Do not guess from snippets.`
          };
        }
        case "read_url": {
          const url = args.url;
          const part = args.part || 1;
          
          let item = searchCache[url];
          
          if (!item) {
            let domainName = "unknown.com";
            try {
              const urlParsed = new URL(url);
              domainName = urlParsed.hostname;
            } catch (e) {}
            item = {
              url,
              title: `${domainName} - Extracted Article`,
              domain: domainName,
              name: domainName,
              snippet: "Direct URL read.",
              isReputable: false, // default
              query: "",
              totalParts: 1,
              chunkSize: 2750
            };
          }

          if (!item.content) {
            try {
              const response = await fetch("/api/proxy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: item.url })
              });
              if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                  const rawHtml = data.data;
                  // Extremely basic content extraction
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(rawHtml, "text/html");
                  // Remove scripts, styles, navs
                  const scripts = doc.querySelectorAll('script, style, nav, footer, iframe, noscript');
                  scripts.forEach(s => s.remove());
                  
                  let cleanText = doc.body?.textContent || "";
                  cleanText = cleanText.replace(/\s+/g, " ").trim();
                  
                  // Bot protection detection
                  if (
                    cleanText.includes("We're verifying your browser") ||
                    cleanText.includes("Enable JavaScript to continue") ||
                    cleanText.includes("Just a moment...") ||
                    cleanText.includes("Security Checkpoint") ||
                    cleanText.includes("checking your browser")
                  ) {
                    item.content = "ERROR: Target website blocked the request (Anti-Bot Protection / Cloudflare / Vercel Edge). Please TRY ANOTHER URL from the search results.";
                  } else {
                    item.content = cleanText || "No readable content found.";
                  }
                }
              }
            } catch (e) {
              item.content = "Failed to fetch content from the URL due to network or proxy errors.";
            }
            if (!item.content) {
              item.content = "No readable content found.";
            }
            
            item.totalParts = Math.ceil(item.content.length / item.chunkSize);
            searchCache[url] = item;
          }

          const content = item.content;
          const chunkSize = item.chunkSize;
          const totalParts = item.totalParts;
          
          let partText = "";
          let statusMessage = "";

          if (part === "quick" && !item.isReputable) {
             const sentences = content.split(/[.?!]\s+/);
             const keyword = item.query.split(' ').filter(w => w.length > 2)[0] || "updates";
             const matched = sentences.filter(s => s.toLowerCase().includes(keyword.toLowerCase()));
             // Just take a random selection or first few matched sentences
             const selected = matched.slice(0, 5).join(". ") + ".";
             partText = `[QUICK READ MODE]\nHere are the most important extracted sentences matching your keyword:\n\n${selected}`;
             statusMessage = `[End of Quick Read]`;
          } else {
             const numericPart = typeof part === "number" ? part : parseInt(part, 10) || 1;
             const startIdx = (numericPart - 1) * chunkSize;
             partText = content.slice(startIdx, startIdx + chunkSize);
             
             if (item.isReputable) {
                statusMessage = `[End of Part ${numericPart}/${totalParts}]. To read more, call read_url again with part=${numericPart + 1}.`;
             } else {
                statusMessage = `[End of Part ${numericPart}/${totalParts}]. This is a non-reputable source (limit 2750 chars). To quickly read the rest, call read_url with part="quick".`;
             }
          }

          return {
            resultString: `Page URL: ${url}\nCredibility: ${item.isReputable ? "HIGHLY REPUTABLE [STAR - REPUTATION!]" : "STANDARD [NO STAR]"}\n\nContent:\n${partText}\n\n${statusMessage}`
          };
        }
        case "read_file": {
          const content = vfsRef.current[args.path];
          if (content === undefined) {
            return { resultString: JSON.stringify({ error: "File not found" }) };
          }
          const lines = content.split("\n");
          const totalLines = lines.length;
          const totalChars = content.length;

          if (args.offset !== undefined || args.limit !== undefined) {
            const startLine = Math.max(0, (args.offset && args.offset > 0) ? args.offset - 1 : 0);
            const lineLimit = args.limit !== undefined ? args.limit : 100;
            const sliced = lines.slice(startLine, startLine + lineLimit);
            return {
              resultString: `[File ${args.path}: Line ${startLine + 1} to ${startLine + sliced.length} / Total ${totalLines} lines]\n` + sliced.join("\n")
            };
          }

          if (totalChars <= 300 && totalLines <= 15) {
            return { resultString: content };
          }

          const preview = content.slice(0, 300);
          return {
            resultString: `${preview}\n...\n\n[File has ${totalLines} lines, ${totalChars} characters. Use offset/limit to read a specific section.]`
          };
        }

        case "view_image": {
          const reqPath = (args.path || "").trim();
          if (!reqPath) {
            return { resultString: JSON.stringify({ error: "path parameter is required for view_image" }) };
          }

          // Smart path resolution in VFS
          let resolvedKey = "";
          if (vfsRef.current[reqPath] !== undefined) {
            resolvedKey = reqPath;
          } else {
            const normalized = reqPath.replace(/^\.?\//, "");
            const allKeys = Object.keys(vfsRef.current);
            const found = allKeys.find(k => 
              k === normalized || 
              k.replace(/^\.?\//, "") === normalized || 
              k.toLowerCase() === normalized.toLowerCase() ||
              k.toLowerCase().endsWith("/" + normalized.toLowerCase()) ||
              normalized.toLowerCase().endsWith("/" + k.toLowerCase())
            );
            if (found) {
              resolvedKey = found;
            }
          }

          if (!resolvedKey) {
            const availableFiles = Object.keys(vfsRef.current);
            const imageCandidates = availableFiles.filter(k => 
              /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(k) || (vfsRef.current[k] && vfsRef.current[k].startsWith("data:image/"))
            );
            return {
              resultString: JSON.stringify({
                error: `Image file not found: "${reqPath}".`,
                availableImages: imageCandidates.length > 0 ? imageCandidates : "No image files found in workspace."
              })
            };
          }

          const fileContent = vfsRef.current[resolvedKey];
          if (typeof fileContent !== "string") {
            return { resultString: JSON.stringify({ error: `File content unavailable for: "${resolvedKey}"` }) };
          }

          // Check if already stored as data URI
          if (fileContent.startsWith("data:image/")) {
            return {
              resultString: fileContent
            };
          }

          // If SVG text
          if (resolvedKey.toLowerCase().endsWith(".svg") || fileContent.trim().startsWith("<svg")) {
            const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(fileContent)}`;
            return {
              resultString: svgDataUri
            };
          }

          // If binary image stored as raw base64 string
          if (/\.(png|jpe?g|webp|gif|bmp|ico)$/i.test(resolvedKey)) {
            const ext = resolvedKey.split(".").pop()?.toLowerCase() || "png";
            const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
            const dataUri = `data:${mime};base64,${fileContent}`;
            return {
              resultString: dataUri
            };
          }

          return {
            resultString: JSON.stringify({
              error: `"${resolvedKey}" is not an image file. It contains text/code. Use read_file to inspect code or text files.`
            })
          };
        }

        case "file_stats": {
          const content = vfsRef.current[args.path];
          if (content === undefined) {
            return { resultString: JSON.stringify({ error: "File not found" }) };
          }
          const lines = content.split("\n").length;
          const chars = content.length;
          const sizeBytes = new TextEncoder().encode(content).length;
          return {
            resultString: JSON.stringify({ path: args.path, lines, chars, sizeBytes })
          };
        }

        case "edit_file": {
          const content = vfsRef.current[args.path];
          if (content === undefined) {
            return { resultString: JSON.stringify({ error: "File not found" }) };
          }
          const oldStr = args.old_string ?? "";
          const newStr = args.new_string ?? "";

          if (!oldStr) {
            return { resultString: JSON.stringify({ error: "old_string parameter is required" }) };
          }

          let count = 0;
          let pos = content.indexOf(oldStr);
          while (pos !== -1) {
            count++;
            pos = content.indexOf(oldStr, pos + oldStr.length);
          }

          if (count === 0) {
            return {
              resultString: JSON.stringify({
                error: "old_string not found in file. Please check or provide surrounding context."
              })
            };
          }

          if (count > 1) {
            return {
              resultString: JSON.stringify({
                error: `old_string appears ${count} times in file. Please provide additional surrounding context to match uniquely 1 location.`
              })
            };
          }

          const updatedContent = content.replace(oldStr, newStr);
          const nextVfsEdit = { ...vfsRef.current, [args.path]: updatedContent };
          setVfs(nextVfsEdit);
          recordCheckpoint(`edit_file: ${args.path}`, nextVfsEdit);
          onFileChanged(args.path);

          return {
            resultString: JSON.stringify({ success: true, path: args.path, replacedBytes: oldStr.length }),
            diffInfo: { path: args.path, oldContent: oldStr, newContent: newStr }
          };
        }

        case "multi_edit_file": {
          const content = vfsRef.current[args.path];
          if (content === undefined) {
            return { resultString: JSON.stringify({ error: "File not found" }) };
          }
          const edits = args.edits || [];
          if (!Array.isArray(edits) || edits.length === 0) {
            return { resultString: JSON.stringify({ error: "edits array is required" }) };
          }

          let currentContent = content;
          const applied: { old_string: string; new_string: string }[] = [];

          for (let i = 0; i < edits.length; i++) {
            const { old_string, new_string } = edits[i];
            if (!old_string) continue;

            let count = 0;
            let pos = currentContent.indexOf(old_string);
            while (pos !== -1) {
              count++;
              pos = currentContent.indexOf(old_string, pos + old_string.length);
            }

            if (count === 0) {
              return {
                resultString: JSON.stringify({
                  error: `Edit #${i + 1} failed: old_string not found in file.`
                })
              };
            }
            if (count > 1) {
              return {
                resultString: JSON.stringify({
                  error: `Edit #${i + 1} failed: old_string appears ${count} times in file. Provide unique context.`
                })
              };
            }

            currentContent = currentContent.replace(old_string, new_string || "");
            applied.push({ old_string, new_string: new_string || "" });
          }

          const nextVfsMulti = { ...vfsRef.current, [args.path]: currentContent };
          setVfs(nextVfsMulti);
          recordCheckpoint(`multi_edit_file: ${args.path}`, nextVfsMulti);
          onFileChanged(args.path);

          return {
            resultString: JSON.stringify({ success: true, path: args.path, appliedCount: applied.length }),
            diffInfo: {
              path: args.path,
              oldContent: applied.map(a => `- ${a.old_string}`).join("\n"),
              newContent: applied.map(a => `+ ${a.new_string}`).join("\n")
            }
          };
        }

        case "glob_files": {
          const pattern = args.pattern || "*";
          const allPaths = Object.keys(vfsRef.current);

          let regexStr = pattern
            .replace(/\./g, "\\.")
            .replace(/\*\*/g, ".*")
            .replace(/\*/g, "[^/]*")
            .replace(/\?/g, ".");
          
          if (!regexStr.startsWith(".*") && !regexStr.startsWith("^")) {
            regexStr = ".*" + regexStr;
          }

          let regex: RegExp;
          try {
            regex = new RegExp(regexStr, "i");
          } catch (e) {
            regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
          }

          const matches = allPaths.filter(p => regex.test(p));
          return {
            resultString: JSON.stringify({ pattern, matchCount: matches.length, files: matches })
          };
        }

        case "manage_todos": {
          const action = args.action || "get";
          if (action === "update" && Array.isArray(args.todos)) {
            setTodosList(args.todos);
            return {
              resultString: JSON.stringify({ success: true, count: args.todos.length, todos: args.todos })
            };
          }
          if (action === "update_item" && args.item) {
            const isDone = args.status === "done";
            setTodosList(prev => prev.map(t => t.text === args.item ? { ...t, done: isDone } : t));
            return {
              resultString: JSON.stringify({ success: true, item: args.item, status: args.status })
            };
          }
          return {
            resultString: JSON.stringify({ todos: todosList })
          };
        }

        case "delegate_subtask": {
          const desc = args.description || "";
          const files = args.target_files || [];
          return {
            resultString: JSON.stringify({
              status: "completed",
              message: `Subtask executed: "${desc}"`,
              relevant_files: files,
              summary: `Successfully completed subtask: ${desc}`
            })
          };
        }

        case "grep_files": {
          const pattern = args.pattern || "";
          const targetPath = args.path;
          const matches: Array<{ path: string; line: number; text: string }> = [];

          let regex: RegExp;
          try {
            regex = new RegExp(pattern, "gi");
          } catch (e) {
            regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          }

          const filesToSearch = targetPath 
            ? (vfsRef.current[targetPath] !== undefined ? [targetPath] : [])
            : Object.keys(vfsRef.current);

          for (const filePath of filesToSearch) {
            const fileText = vfsRef.current[filePath] || "";
            const lines = fileText.split("\n");
            lines.forEach((lineText, lineIdx) => {
              regex.lastIndex = 0;
              if (regex.test(lineText)) {
                matches.push({
                  path: filePath,
                  line: lineIdx + 1,
                  text: lineText.trim()
                });
              }
            });
          }

          return {
            resultString: JSON.stringify({
              pattern,
              matchCount: matches.length,
              results: matches.slice(0, 50)
            })
          };
        }
            
        case "write_file": {
          const oldContent = vfsRef.current[args.path] || "";
          let newContent = args.content || "";
          if (newContent && !newContent.endsWith("\n")) {
            newContent += "\n";
          }
          const nextVfsWrite = { ...vfsRef.current, [args.path]: newContent };
          setVfs(nextVfsWrite);
          recordCheckpoint(`write_file: ${args.path}`, nextVfsWrite);
          onFileChanged(args.path);
          return {
            resultString: JSON.stringify({ success: true, path: args.path, bytes: newContent.length }),
            diffInfo: { path: args.path, oldContent, newContent }
          };
        }
          
        case "delete_file":
          if (vfsRef.current[args.path] !== undefined) {
            const nextVfsDel = { ...vfsRef.current };
            delete nextVfsDel[args.path];
            setVfs(nextVfsDel);
            recordCheckpoint(`delete_file: ${args.path}`, nextVfsDel);
            return { resultString: JSON.stringify({ success: true, path: args.path }) };
          }
          return { resultString: JSON.stringify({ error: "File not found" }) };
          
        case "list_directory":
          return { resultString: JSON.stringify({ files: Object.keys(vfsRef.current) }) };
          
        case "execute_bash": {
          const cmd = (args.command || "").trim();
          let output = "bash: command executed in sandbox";
          if (cmd.startsWith("ls")) {
            output = Object.keys(vfsRef.current).join("\n");
          } else if (cmd.startsWith("cat ")) {
            const file = cmd.split(" ")[1];
            output = vfsRef.current[file] || "cat: No such file or directory";
          } else if (cmd.startsWith("echo ")) {
            output = cmd.substring(5);
          }
          return { resultString: output };
        }

        case "run_code": {
          const rawCode = args.code;
          if (typeof rawCode !== "string" || !rawCode.trim()) {
            return {
              resultString: JSON.stringify({
                error: "code parameter cannot be empty. You must provide a valid, non-empty JavaScript string to run."
              })
            };
          }
          const codeToRun = rawCode.trim();
          const runnerResult = await runJavaScriptInWorker(codeToRun, vfsRef.current, 5000);
          
          if (runnerResult.filesChanged && runnerResult.filesChanged.length > 0) {
            setVfs(() => runnerResult.updatedVfs);
            recordCheckpoint("run_code", runnerResult.updatedVfs);
            onFileChanged(runnerResult.filesChanged[0]);
          }

          return { 
            resultString: JSON.stringify({
              stdout: runnerResult.stdout,
              result: runnerResult.result,
              error: runnerResult.error,
              filesChanged: runnerResult.filesChanged
            }) 
          };
        }
          
        default:
          return { resultString: JSON.stringify({ error: "Unknown tool" }) };
      }
    } catch (e: any) {
      return { resultString: JSON.stringify({ error: e.message }) };
    }
  };

  const handleSlashOrBangCommand = async (cmdStr: string): Promise<boolean> => {
    const trimmed = cmdStr.trim();
    if (!trimmed.startsWith("/") && !trimmed.startsWith("!")) return false;

    const ctx: CommandContext = {
      input: trimmed,
      settings,
      onUpdateSettings,
      vfs: vfsRef.current,
      setVfs,
      onFileChanged,
      permissionMode,
      setPermissionMode: (mode: any) => onPermissionChange(mode),
      toolPermissions,
      setToolPermissions,
      isPlanMode,
      setIsPlanMode,
      messages,
      setMessages,
      checkpoints,
      setCheckpoints,
      currentCheckpointIndex,
      setCurrentCheckpointIndex,
      activeSubagent,
      setActiveSubagent,
      setIsMemoryModalOpen,
      setIsDiffModalOpen: () => {},
      setIsSettingsOpen: () => onOpenSettings(),
      setIsSessionPickerOpen,
      estimatedTokens,
      contextPct,
      saveCurrentSession,
      sessions: savedSessions,
      currentSessionId,
      currentSessionName,
      currentProject,
      currentWorktree,
      currentBranch,
      onResumeSession: handleResumeSession,
      onRenameSession: handleRenameSession,
      onBranchSession: handleBranchSession,
      onClearSession: handleClearSession
    };

    const res = await executeSlashOrBangCommand(trimmed, ctx);
    if (res.handled) {
      if (res.response) {
        const isLocal = res.contextEffect === "local-only";
        setMessages(prev => [
          ...prev,
          { role: "user", content: trimmed, isLocal },
          { role: "assistant", content: res.response, isLocal }
        ]);
      }
      return true;
    }
    return false;
  };

  const handleSubmit = async (e?: React.FormEvent, customCmd?: string) => {
    if (e) e.preventDefault();
    const userMsg = (customCmd !== undefined ? customCmd : input).trim();
    if (!userMsg || isLoading) return;

    // Auto-generate descriptive session name from first prompt if still using default name
    if (messages.length === 0 && !isCustomSessionName && !userMsg.startsWith("/")) {
      const generated = generateDefaultSessionName(currentProject, userMsg);
      setCurrentSessionName(generated.name);
    }

    if (userMsg.toLowerCase() === "<time-user>") {
      const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const content = buildTimeObservation(userTimeZone);

      setMessages(prev => [
        ...prev,
        { role: "user", content: userMsg },
        { role: "assistant", content }
      ]);
      setInput("");
      return;
    }



    setCmdHistory(prev => [...prev, userMsg]);
    setCmdHistoryIdx(-1);
    setInput("");

    if (await handleSlashOrBangCommand(userMsg)) {
      return;
    }

    if (!settings.apiKey) {
      setShowApiKeyNotice(true);
      return;
    }
    
    let currentMessages: any[] = [...messages, { role: "user", content: userMsg }];
    setMessages(currentMessages);
    setIsLoading(true);

    try {
      let isDone = false;
      let turnCount = 0;
      let lastToolSignature = "";
      let toolSignatureRepeatCount = 0;

      while (!isDone && turnCount < 10) {
        turnCount++;
        
        const apiMessages = currentMessages.map(m => {
          const { name, diffInfo, reasoning, tokens, ...rest } = m;
          return m.role === 'tool' ? m : rest;
        });

        let data;
        try {
          data = await callOpenAI(apiMessages);
        } catch (apiErr: any) {
          const errStr = (apiErr.message || "").toLowerCase();
          if (errStr.includes("400") || errStr.includes("tool") || errStr.includes("calling") || errStr.includes("support")) {
            setUsePlainCommandsOnly(true);
            data = await callOpenAI(apiMessages, true);
          } else {
            throw apiErr;
          }
        }

        const responseMessage: any = { ...data.choices[0].message };

        // 1. Direct reasoning fields from API response
        if (responseMessage.reasoning_content && !responseMessage.reasoning) {
          responseMessage.reasoning = responseMessage.reasoning_content;
        }
        if (responseMessage.thinking && !responseMessage.reasoning) {
          responseMessage.reasoning = responseMessage.thinking;
        }

        // 2. Parse reasoning (<think>...</think>, </think>) & XML/tag tool calls (<tool_call>, <function=...>) & plain commands
        if (responseMessage.content) {
          const parsedResult = parseToolCallsAndReasoning(responseMessage.content);

          if (parsedResult.reasoning) {
            responseMessage.reasoning = responseMessage.reasoning
              ? `${responseMessage.reasoning}\n\n${parsedResult.reasoning}`
              : parsedResult.reasoning;
          }

          if (parsedResult.toolCalls.length > 0) {
            if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
              responseMessage.tool_calls = parsedResult.toolCalls;
            } else {
              responseMessage.tool_calls = [...responseMessage.tool_calls, ...parsedResult.toolCalls];
            }
          }

          responseMessage.content = parsedResult.cleanContent;
        }

        currentMessages = [...currentMessages, responseMessage];
        setMessages([...currentMessages]);

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          // Check for repeated identical tool calls to prevent infinite loops and wasted tokens
          const currentSignature = JSON.stringify(
            responseMessage.tool_calls.map((tc: any) => ({
              name: tc.function?.name,
              args: tc.function?.arguments
            }))
          );

          if (currentSignature === lastToolSignature) {
            toolSignatureRepeatCount++;
          } else {
            lastToolSignature = currentSignature;
            toolSignatureRepeatCount = 1;
          }

          if (toolSignatureRepeatCount > 2) {
            const errorNotice = "Detected repeated identical tool calls, stopping to prevent loop.";
            // Every tool_call above needs a matching tool-result message, or this
            // assistant turn is left dangling and every future API call in this
            // session will fail (most providers reject tool_calls with no
            // response). Synthesize one instead of just breaking out.
            currentMessages = [
              ...currentMessages,
              ...responseMessage.tool_calls.map((tc: any) => ({
                role: "tool",
                tool_call_id: tc.id,
                name: tc.function?.name,
                content: `Skipped: ${errorNotice}`
              }))
            ];
            currentMessages = [
              ...currentMessages,
              { role: "assistant", content: `System Error: ${errorNotice}` }
            ];
            setMessages([...currentMessages]);
            break;
          }

          for (const toolCall of responseMessage.tool_calls) {
            const { resultString, diffInfo } = await executeTool(toolCall);
            currentMessages = [
              ...currentMessages, 
              { 
                role: "tool", 
                tool_call_id: toolCall.id, 
                name: toolCall.function.name, 
                content: resultString,
                diffInfo
              }
            ];
          }
          setMessages([...currentMessages]);

          // Rate limit cooldown (3s countdown) before sending tool output back to AI
          skipCooldownRef.current = false;
          for (let s = 3; s > 0; s--) {
            if (skipCooldownRef.current) break;
            setCooldownSeconds(s);
            await new Promise(r => setTimeout(r, 1000));
            if (abortControllerRef.current?.signal.aborted) {
              setCooldownSeconds(null);
              throw new Error("Cancelled by user.");
            }
          }
          setCooldownSeconds(null);
        } else {
          isDone = true;
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: `Error: ${error.message}` },
        ]);
      }
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        saveCurrentSession();
      }, 200);
    }
  };

  const findToolResult = (toolCallId: string) => {
    return messages.find(m => m.role === "tool" && m.tool_call_id === toolCallId);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-[#e5e5e5] font-mono select-text relative">
      {/* Terminal Top Bar */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-[#222222] bg-[#141414] select-none text-xs">
        <div className="flex items-center gap-2">
          <img 
            src={clawdImg} 
            alt="Clawd Mascot" 
            className="w-5 h-5 object-contain shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleClearSession}
            title="Return to Home Screen"
            onError={(e) => { (e.target as HTMLImageElement).src = "/clawd.png"; }}
          />

          {activeSubagent && (
            <span className="text-[10px] text-[#888888] font-mono">
              [{activeSubagent}]
            </span>
          )}


        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs text-[#777777] shrink-0">
          <span>
            ~{estimatedTokens} tokens
            <span className="hidden sm:inline"> · {contextPct}%</span>
          </span>
          <span className="text-[#333333]">|</span>
          <button
            onClick={onOpenSettings}
            className="hover:text-[#e5e5e5] transition-colors"
            title="Settings"
          >
            [settings]
          </button>
          <span className="text-[#333333]">|</span>
          <button
            onClick={() => setIsTosModalOpen(true)}
            className="hover:text-[#e5e5e5] transition-colors"
            title="Terms of Service"
          >
            [ToS]
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div
        className="flex-1 overflow-y-auto p-4 leading-relaxed font-mono text-xs"
        ref={scrollRef}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center max-w-3xl mx-auto select-none py-2 font-mono">
            {/* Authentic Claude Code CLI Banner Frame */}
            <div className="relative border border-[#D97757] rounded-lg bg-[#0e0e0e] w-full overflow-hidden shadow-2xl my-2">
              {/* Top title embedded in frame border */}
              <div className="border-b border-[#D97757] px-4 py-1.5 bg-[#14100e] text-[#D97757] font-semibold text-xs tracking-wider flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Claude Code</span>
                  <span className="text-[#888888] font-normal">v2.1.233</span>
                </div>
                <div className="text-[10px] text-[#888888] hidden sm:block">
                  Agentic Coding Terminal
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[190px]">
                {/* Left Column: Mascot + Welcome + Model/Path */}
                <div className="md:col-span-6 p-5 flex flex-col justify-between items-center text-center border-b md:border-b-0 md:border-r border-[#D97757]/60">
                  <div className="text-white font-bold text-sm tracking-wide mt-0.5">
                    Welcome back Developer!
                  </div>
                  
                  <div className="py-3 flex items-center justify-center">
                    <ClawdPixelMascot className="w-16 h-12 text-[#D97757] hover:scale-105 transition-transform cursor-pointer" />
                  </div>

                  <div className="space-y-0.5 text-xs text-[#888888]">
                    <div className="font-medium text-[#aaaaaa]">
                      {settings.model || "Sonnet 4.5"} · Max 20x
                    </div>
                    <div className="text-[#666666] text-[11px] truncate max-w-[260px]">
                      /workspace/{currentProject || "app"}
                    </div>
                  </div>
                </div>

                {/* Right Column: Split Top/Bottom */}
                <div className="md:col-span-6 flex flex-col divide-y divide-[#D97757]/60">
                  {/* Top Half: Recent activity */}
                  <div className="p-3.5 space-y-1.5 text-xs">
                    <div className="text-[#D97757] font-semibold text-xs">
                      Recent activity
                    </div>
                    <div className="space-y-1 text-[#cccccc] text-[11px]">
                      <div className="flex items-center justify-between cursor-pointer hover:text-[#D97757] transition-colors" onClick={() => setIsMemoryModalOpen(true)}>
                        <span className="text-[#777777] w-12 shrink-0">1m ago</span>
                        <span className="truncate flex-1">Updated project memory</span>
                      </div>
                      <div className="flex items-center justify-between cursor-pointer hover:text-[#D97757] transition-colors" onClick={() => handleSubmit(undefined, "/files")}>
                        <span className="text-[#777777] w-12 shrink-0">8m ago</span>
                        <span className="truncate flex-1">Updated claw'd feet</span>
                      </div>
                      <div className="flex items-center justify-between cursor-pointer hover:text-[#D97757] transition-colors" onClick={() => handleSubmit(undefined, "/doctor")}>
                        <span className="text-[#777777] w-12 shrink-0">2d ago</span>
                        <span className="truncate flex-1">Add new words to spinner</span>
                      </div>
                      <div className="flex items-center justify-between cursor-pointer hover:text-[#D97757] transition-colors" onClick={() => handleSubmit(undefined, "/test")}>
                        <span className="text-[#777777] w-12 shrink-0">1w ago</span>
                        <span className="truncate flex-1">Update unit tests</span>
                      </div>
                    </div>
                    <div 
                      onClick={() => setIsSessionPickerOpen(true)}
                      className="text-[#666666] text-[11px] hover:text-[#D97757] cursor-pointer pt-0.5"
                    >
                      ... /resume for more
                    </div>
                  </div>

                  {/* Bottom Half: What's new */}
                  <div className="p-3.5 space-y-1.5 text-xs">
                    <div className="text-[#D97757] font-semibold text-xs">
                      What's new
                    </div>
                    <div className="space-y-1 text-[#cccccc] text-[11px]">
                      <div 
                        onClick={() => setIsAgentsModalOpen(true)} 
                        className="cursor-pointer hover:text-[#D97757] truncate transition-colors"
                      >
                        /agents to create subagents
                      </div>
                      <div 
                        onClick={() => handleSubmit(undefined, "/security-review")} 
                        className="cursor-pointer hover:text-[#D97757] truncate transition-colors"
                      >
                        /security-review for review agent
                      </div>
                      <div className="text-[#888888] truncate">
                        ctrl+b to background bashes
                      </div>
                    </div>
                    <div 
                      onClick={() => setIsCommandPaletteOpen(true)}
                      className="text-[#666666] text-[11px] hover:text-[#D97757] cursor-pointer pt-0.5"
                    >
                      ... /help for more
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status bar line right under banner matching Image 5 & 6 */}
            <div className="w-full px-2 py-1.5 flex items-center justify-between text-xs text-[#777777]">
              <div 
                onClick={() => handleSubmit(undefined, "/doctor")}
                className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <span className="text-[#e5c07b] font-medium">1 setup issue: MCP</span>
                <span>·</span>
                <span className="hover:text-[#e5c07b]">/doctor</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-[#aaaaaa]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7ee787] inline-block" />
                  <span>high · /effort</span>
                </span>
                <span>|</span>
                <span>~{estimatedTokens} tokens ({contextPct}%)</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {groupMessagesIntoRenderBlocks(messages).map((block, idx) => {
              if (block.type === "user") {
                return (
                  <div key={idx} className="flex items-start justify-between gap-2 pt-2 animate-fadeIn group/user">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-[#D97757] font-bold select-none">&gt;</span>
                      <div className="text-[#ffffff] font-medium whitespace-pre-wrap flex-1">
                        {block.message.content}
                        {block.message.isLocal && (
                          <span className="ml-2 text-[10px] text-[#666666] bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#2a2a2a] font-normal select-none">
                            local only
                          </span>
                        )}
                      </div>
                    </div>
                    <CopyButton text={block.message.content || ""} />
                  </div>
                );
              }

              if (block.type === "system") {
                return (
                  <div key={idx} className="py-1 px-2.5 my-1 bg-[#141414] border border-[#222222] text-xs font-mono text-[#888888] select-none">
                    <div className="whitespace-pre-wrap">{block.message.content}</div>
                  </div>
                );
              }

              if (block.type === "assistant_turn") {
                return (
                  <div key={idx} className="space-y-2 pl-3 border-l border-[#262626] group/turn">
                    {block.reasonings.map((r, rIdx) => (
                      <ThinkingBlock key={rIdx} reasoning={r} />
                    ))}

                    {block.textContent && (
                      <div className="space-y-1 relative group/aitext">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <TypewriterText content={block.textContent} />
                          </div>
                          <CopyButton text={block.textContent} label="Copy Message" />
                        </div>
                        <TodoListWidget text={block.textContent} />
                      </div>
                    )}

                    {block.toolCalls.map(({ tc, resultObj }, tIdx) => {
                      const args = typeof tc.function?.arguments === "string" 
                        ? safeJsonParse(tc.function.arguments || "{}", {}) 
                        : tc.function?.arguments || {};

                      return (
                        <ToolCallLog
                          key={tc.id || `tc-${idx}-${tIdx}`}
                          toolName={tc.function.name}
                          args={args}
                          result={resultObj?.content}
                          isPending={resultObj === undefined}
                          diffInfo={resultObj?.diffInfo}
                        />
                      );
                    })}
                  </div>
                );
              }

              return null;
            })}

            {/* Inline Permission Request Dialog matching Image 4 */}
            {pendingPermission && (
              <div className="my-3 p-4 bg-[#121318] border border-[#7aa2f7]/50 rounded font-mono text-xs animate-fadeIn max-w-2xl">
                <div className="text-[#7aa2f7] font-semibold mb-2 flex items-center gap-2">
                  <span>Bash command</span>
                </div>
                
                <div className="bg-[#0b0c10] border border-[#1e2230] p-2.5 text-[#e5e5e5] font-mono text-xs mb-3 space-y-1 rounded">
                  <div className="text-white font-medium break-all">{pendingPermission.action}</div>
                  <div className="text-[#777777] text-[11px]">Execute action in /workspace</div>
                </div>

                <div className="text-[#cccccc] mb-2 font-medium">
                  Do you want to proceed?
                </div>

                <div className="space-y-1.5 pl-1">
                  <button
                    onClick={() => handlePermissionDecision(true)}
                    className="flex items-center gap-2 text-left w-full hover:text-[#7aa2f7] transition-colors py-0.5 text-xs text-[#e5e5e5]"
                  >
                    <span className="text-[#7aa2f7] font-bold">❯ 1.</span>
                    <span>Yes</span>
                  </button>
                  <button
                    onClick={() => {
                      permissionModeRef.current = "Allow";
                      onPermissionChange("Allow");
                      handlePermissionDecision(true);
                    }}
                    className="flex items-center gap-2 text-left w-full hover:text-[#7aa2f7] transition-colors py-0.5 text-xs text-[#aaaaaa]"
                  >
                    <span className="text-[#666666] font-bold">  2.</span>
                    <span>Yes, and don't ask again for commands in /workspace</span>
                  </button>
                  <button
                    onClick={() => handlePermissionDecision(false)}
                    className="flex items-center gap-2 text-left w-full hover:text-[#e5e5e5] transition-colors py-0.5 text-xs text-[#777777]"
                  >
                    <span className="text-[#666666] font-bold">  3.</span>
                    <span>No, and tell Claude what to do differently (esc)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic Thinking Spinner */}
            {isLoading && (
              <div className="flex items-center justify-between text-[#D97757] text-xs pt-1 pl-3 font-mono animate-fadeIn">
                <div className="flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin text-[#D97757] opacity-80" />
                  <span className="animate-pulse font-mono">
                    {["Thinking...", "Pondering...", "Working...", "Analyzing...", "Synthesizing..."][thinkingTime % 5]} ({thinkingTime}s · esc to interrupt)
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (abortControllerRef.current) abortControllerRef.current.abort();
                    setIsLoading(false);
                    setMessages(prev => [...prev, { role: "assistant", content: "⏺ Interrupted by user." }]);
                  }}
                  className="text-[11px] text-[#888888] hover:text-[#D97757] underline"
                >
                  [esc to interrupt]
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Memory Modal (CLAUDE.md) */}
      {isMemoryModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-mono text-xs">
          <div className="bg-[#121212] border border-[#2e2e2e] p-4 w-full max-w-lg max-h-[85vh] flex flex-col text-[#e5e5e5]">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#222222]">
              <span className="font-bold text-[#D97757] tracking-wider">PROJECT MEMORY (CLAUDE.MD)</span>
              <button onClick={() => setIsMemoryModalOpen(false)} className="text-[#888888] hover:text-white">
                <X size={14} />
              </button>
            </div>
            <textarea
              className="w-full h-64 bg-[#0a0a0a] border border-[#222222] p-2.5 text-[#e5e5e5] font-mono text-xs leading-relaxed outline-none focus:border-[#D97757] resize-none mb-3"
              value={memoryContent}
              onChange={(e) => setMemoryContent(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsMemoryModalOpen(false)}
                className="px-3 py-1.5 bg-[#222222] text-[#888888] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setVfs(prev => ({ ...prev, "CLAUDE.md": memoryContent }));
                  setIsMemoryModalOpen(false);
                  showToast("CLAUDE.md memory updated");
                }}
                className="px-3 py-1.5 bg-[#D97757] text-white font-bold hover:bg-[#c66546] transition-colors"
              >
                Save Memory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {isTosModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-mono text-xs">
          <div className="bg-[#121212] border border-[#2e2e2e] rounded-none p-5 max-w-lg w-full max-h-[85vh] flex flex-col text-[#e5e5e5] shadow-2xl">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#222222]">
              <span className="font-bold text-[#D97757] tracking-wider text-xs">TERMS OF SERVICE</span>
              <button onClick={() => setIsTosModalOpen(false)} className="text-[#888888] hover:text-white p-1">
                <X size={14} />
              </button>
            </div>
            <div className="overflow-y-auto pr-2 space-y-3 text-xs text-[#cccccc] font-mono leading-relaxed select-text whitespace-pre-wrap">
              {`This application runs entirely client-side (in your browser). No backend servers of ours process or store any data you create.

PROHIBITED
- Spamming file or data creation with abnormally large volume intended to exhaust or break browser local storage.
- Using the application to execute code for malicious purposes (bypassing browser sandboxes or exploiting vulnerabilities).

OUR COMMITMENTS
- Zero collection of any user data.
- No storage or transmission of your API Key outside your browser — keys exist solely in your local machine's localStorage and are sent directly to your configured Base URL.
- All files, chat history, and executed code run completely on your machine (client-side) and are not synchronized to any server of ours.
- API calls to your configured Base URL (e.g., Google Gemini) comply with the terms and privacy policies of that provider, outside the scope of this agreement.

By using the app, you agree to take full responsibility for your API Key and the content you generate.`}
            </div>
            <div className="flex justify-end mt-4 pt-3 border-t border-[#222222]">
              <button
                onClick={() => setIsTosModalOpen(false)}
                className="px-4 py-1.5 bg-[#D97757] text-white font-bold text-xs hover:bg-[#c66546] transition-colors rounded-none"
              >
                Accept & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline API key notice banner */}
      {showApiKeyNotice && (
        <div className="mx-3 my-2 p-3 bg-[#181210] border border-[#D97757] text-xs font-mono text-[#e5e5e5] flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-[#D97757]" />
            <span>API Key missing. Please configure your API Key in Settings to continue.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowApiKeyNotice(false);
                onOpenSettings();
              }}
              className="px-2.5 py-1 bg-[#D97757] text-white font-bold hover:bg-[#c66546] transition-colors"
            >
              Open Settings
            </button>
            <button
              onClick={() => setShowApiKeyNotice(false)}
              className="px-2 py-1 text-[#888888] hover:text-[#e5e5e5]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Command Palette Modal (Ctrl+K) */}
      {isCommandPaletteOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-mono text-xs">
          <div className="bg-[#121212] border border-[#2e2e2e] p-4 w-[500px] max-h-[80vh] flex flex-col text-[#e5e5e5] shadow-2xl">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#222222]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#D97757] tracking-wider">COMMAND PALETTE</span>
                <span className="text-[10px] text-[#666666]">({ALL_SLASH_COMMANDS.length} commands)</span>
              </div>
              <button onClick={() => setIsCommandPaletteOpen(false)} className="text-[#888888] hover:text-white">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-1 overflow-y-auto pr-1 flex-1">
              {ALL_SLASH_COMMANDS.map((item, cIdx) => (
                <div
                  key={cIdx}
                  onClick={() => {
                    setIsCommandPaletteOpen(false);
                    if (item.cmd.startsWith("/")) {
                      handleSubmit(undefined, item.cmd);
                    }
                  }}
                  className="p-2 border border-transparent hover:border-[#333333] hover:bg-[#1a1a1a] cursor-pointer flex justify-between items-center transition-colors rounded"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[#D97757] font-bold shrink-0">{item.cmd}</span>
                    <span className="text-[#888888] text-[11px] truncate">{item.desc}</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 shrink-0 ml-2 font-mono ${
                    item.contextEffect === "affects-context" 
                      ? "bg-[#2b1812] text-[#D97757] border border-[#D97757]/40" 
                      : "bg-[#1f1f1f] text-[#888888] border border-[#333333]"
                  }`}>
                    {item.contextEffect === "affects-context" ? "affects context" : "local only"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Agents Modal */}
      {isAgentsModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-mono text-xs">
          <div className="bg-[#121212] border border-[#2e2e2e] p-4 w-full max-w-sm text-[#e5e5e5]">
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-[#D97757]">SPECIALIZED SUB-AGENTS</span>
              <button onClick={() => setIsAgentsModalOpen(false)} className="text-[#888888] hover:text-white">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {[
                { name: "Fullstack Architect", desc: "Focuses on clean structure & modular files" },
                { name: "Code Reviewer & Auditor", desc: "Focuses on security, performance & refactoring" },
                { name: "Test Engineer", desc: "Focuses on unit tests & test runner execution" },
              ].map((agent, aIdx) => (
                <div
                  key={aIdx}
                  onClick={() => {
                    setIsAgentsModalOpen(false);
                    setActiveSubagent(agent.name);
                    showToast(`Switched to agent persona: ${agent.name}`);
                  }}
                  className="p-2.5 border border-[#222222] bg-[#181818] hover:border-[#D97757] cursor-pointer transition-colors"
                >
                  <div className="font-bold text-[#e5e5e5] mb-0.5">{agent.name}</div>
                  <div className="text-[11px] text-[#888888]">{agent.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Session Picker Modal (CLI /resume interactive picker with previews, PR & worktree filters, rename, keyboard navigation) */}
      <SessionPickerModal
        isOpen={isSessionPickerOpen || isSessionsModalOpen}
        onClose={() => {
          setIsSessionPickerOpen(false);
          setIsSessionsModalOpen(false);
        }}
        sessions={savedSessions}
        currentProject={currentProject}
        currentWorktree={currentWorktree}
        currentBranch={currentBranch}
        currentSessionId={currentSessionId}
        onResumeSession={handleResumeSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        onNewSession={() => {
          handleClearSession();
          setIsSessionPickerOpen(false);
          setIsSessionsModalOpen(false);
          showToast(`Started fresh session`);
        }}
      />

      {/* Auto-Compaction Resume Notice (>100k tokens & inactive > 1 hr) */}
      <ResumeCompactionPrompt
        isOpen={isCompactionPromptOpen}
        session={pendingResumeSession}
        onCompactNow={() => {
          if (pendingResumeSession) {
            applyResumeSession(pendingResumeSession, true);
          }
        }}
        onKeepHistory={() => {
          if (pendingResumeSession) {
            applyResumeSession(pendingResumeSession, false);
          }
        }}
        onNeverAskAgain={() => {
          if (pendingResumeSession) {
            applyResumeSession(pendingResumeSession, false);
          }
        }}
        onCancel={() => {
          setIsCompactionPromptOpen(false);
          setPendingResumeSession(null);
        }}
      />

      {/* Toast Notification Overlay */}
      {toastMsg && (
        <div className="fixed bottom-12 right-4 z-50 bg-[#1e1e1e] border border-[#D97757] text-[#D97757] px-3 py-1.5 text-xs font-mono shadow-xl animate-fadeIn">
          {toastMsg}
        </div>
      )}

      {/* Slash command autocomplete popup matching Image 7 */}
      {slashSuggestions.length > 0 && (
        <div className="mx-3 bg-[#111111] border border-[#2e2e2e] shadow-2xl overflow-y-auto max-h-60 rounded font-mono text-xs z-30 mb-1 animate-fadeIn">
          {slashSuggestions.map((item, sIdx) => (
            <div
              key={sIdx}
              onClick={() => {
                setInput(item.cmd + " ");
              }}
              className="px-3 py-1.5 hover:bg-[#1f1f1f] cursor-pointer grid grid-cols-12 gap-2 items-center transition-colors border-b border-[#1a1a1a] last:border-0 group"
            >
              <span className="col-span-4 text-[#7aa2f7] group-hover:text-[#9bb8ff] font-semibold">
                {item.cmd}
              </span>
              <span className="col-span-8 text-[#888888] text-[11px] truncate">
                {item.desc}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Rate limit cooldown countdown banner */}
      {cooldownSeconds !== null && (
        <div className="mx-3 mb-1 px-3 py-1.5 bg-[#1a1512] border border-[#D97757] text-xs font-mono text-[#D97757] flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-[#D97757] animate-ping" />
            <span className="font-semibold text-[11px]">
              Rate Limit Cooldown: Waiting {cooldownSeconds}s before sending next turn to AI...
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              skipCooldownRef.current = true;
              setCooldownSeconds(null);
            }}
            className="px-2 py-0.5 bg-[#2e211b] hover:bg-[#3d2b23] text-[10px] text-white font-bold border border-[#D97757] cursor-pointer transition-colors"
          >
            Skip Cooldown
          </button>
        </div>
      )}

      {/* Terminal Command Input */}
      <form onSubmit={(e) => handleSubmit(e)} className="flex items-center border-t border-[#222222] bg-[#121212] px-3 py-2.5">
        <span className="text-[#D97757] font-bold text-sm mr-2 select-none">&gt;</span>
        <div className="relative flex-1 flex items-center font-mono text-xs overflow-hidden">
          <input
            type="text"
            className="w-full bg-transparent border-none outline-none text-[#e5e5e5] placeholder-[#555555] font-mono text-xs leading-normal caret-transparent relative z-10 selection:bg-[#D97757]/40"
            placeholder={isInputFocused ? "" : (isPlanMode ? "Ask Claude Code (plan mode)..." : "Ask Claude Code...")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                if (cmdHistory.length === 0) return;
                const nextIdx = cmdHistoryIdx === -1 ? cmdHistory.length - 1 : Math.max(0, cmdHistoryIdx - 1);
                setCmdHistoryIdx(nextIdx);
                setInput(cmdHistory[nextIdx]);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                if (cmdHistoryIdx === -1) return;
                const nextIdx = cmdHistoryIdx + 1;
                if (nextIdx >= cmdHistory.length) {
                  setCmdHistoryIdx(-1);
                  setInput("");
                } else {
                  setCmdHistoryIdx(nextIdx);
                  setInput(cmdHistory[nextIdx]);
                }
              }
            }}
            disabled={isLoading}
          />
          {/* Custom blinking solid square block cursor - ONLY visible when input is focused */}
          {isInputFocused && (
            <div className="absolute inset-0 pointer-events-none flex items-center font-mono text-xs text-transparent whitespace-pre">
              <span className="opacity-0">{input}</span>
              <span className="w-2 h-3.5 bg-[#D97757] animate-cursor-blink ml-0.5 inline-block shrink-0 align-middle z-20" />
            </div>
          )}
        </div>
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()}
          className="ml-2 text-[#888888] hover:text-[#D97757] disabled:opacity-30 transition-colors p-1"
        >
          <Play size={13} />
        </button>
      </form>

      {/* Bottom Status Bar matching Image 5 */}
      <div className="flex px-3 py-1.5 bg-[#0a0a0a] border-t border-[#1a1a1a] text-[11px] text-[#777777] select-none font-mono items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#e5c07b] font-bold">▸▸</span>
          <span className="text-[#e5c07b]">
            {permissionMode === "default" ? "auto mode on" : `${permissionMode.toLowerCase()} mode`}
          </span>
          <span className="text-[#555555]">(shift+tab to cycle)</span>
          <span className="text-[#333333]">·</span>
          <span className="text-[#777777]">esc to interrupt</span>
          <span className="text-[#333333]">·</span>
          <span 
            onClick={() => setIsCommandPaletteOpen(true)}
            className="text-[#777777] hover:text-[#D97757] cursor-pointer"
          >
            ? for help
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <button 
            onClick={onOpenSettings}
            className="hover:text-[#e5e5e5] transition-colors"
          >
            [settings]
          </button>
          <span className="text-[#333333]">|</span>
          <button 
            onClick={() => setIsTosModalOpen(true)}
            className="hover:text-[#e5e5e5] transition-colors"
          >
            [ToS]
          </button>
        </div>
      </div>
    </div>
  );
}

export type UserIntent = "user_want_code" | "user_want_search" | "user_just_chat_normal";

// Whole-word / whole-phrase match instead of raw substring matching.
// Raw `.includes()` on short tokens like "ai" or "app" produced false
// positives (e.g. "ai" matches inside "mai", "hai"; "app" matches inside
// "happy"), which let unrelated words silently hijack intent detection.
// Multi-word phrases (containing a space) are safe to match as substrings.
function containsTrigger(text: string, trigger: string): boolean {
  if (trigger.includes(" ")) {
    return text.includes(trigger);
  }
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?:$|[^\\p{L}\\p{N}_])`, "u");
  return re.test(text);
}

const CODE_TRIGGERS = [
  "code", "lập trình", "viết code", "tạo file", "sửa file", "write_file", "edit_file",
  "run_code", "execute_bash", "game", "function", "class", "script", "bug", "fix",
  "refactor", "html", "css", "javascript", "typescript", "python", "terminal", "vfs",
  "xây dựng", "tạo game", "viết hàm", "thuật toán", "cài đặt", "build", "component",
  "giao diện", "ui", "app", "trang web", "website", "tạo", "viết", "làm game"
];

const SEARCH_TRIGGERS = [
  "search", "tìm kiếm", "tra cứu", "tin tức", "news", "thông tin", "mới", "mới nhất", "latest",
  "google", "search_web", "tìm trên mạng", "tra mạng", "bảng xếp hạng", "hôm nay", "thời tiết",
  "giá vàng", "tỷ giá", "hiện tại", "hiện nay", "ngày nay", "ai là", "ở đâu", "thế nào", "bao nhiêu",
  "mạnh nhất", "tốt nhất", "nổi tiếng", "đứng đầu", "đang", "vừa", "cập nhật", "update", "ai",
  "weather", "price", "who is", "what is", "where is", "how is", "how to"
];

export function detectUserIntent(userText: string, currentMessages: any[]): UserIntent {
  const text = (userText || "").toLowerCase().trim();

  const isSearchSignal = SEARCH_TRIGGERS.some(t => containsTrigger(text, t));
  const isCodeSignal = CODE_TRIGGERS.some(t => containsTrigger(text, t));

  // 1. A real-time / search signal in the CURRENT message always wins.
  //    This must be checked before any "sticky" code context below, otherwise
  //    a real-time question asked right after a coding turn never gets
  //    routed to search (the model silently answers from memory instead).
  if (isSearchSignal) {
    return "user_want_search";
  }

  // 2. Explicit coding intent in the current message.
  if (isCodeSignal) {
    return "user_want_code";
  }

  // 3. Only fall back to "recent code activity" stickiness when the current
  //    message itself gives no clear signal either way.
  const hasRecentCodeActivity = [...currentMessages].reverse().slice(0, 3).some(m =>
    m.role === "tool" || m.tool_calls?.length > 0 ||
    (m.role === "user" && CODE_TRIGGERS.some(t => containsTrigger((m.content || "").toLowerCase(), t)))
  );
  if (hasRecentCodeActivity) {
    return "user_want_code";
  }

  // 4. Normal conversation
  return "user_just_chat_normal";
}

function buildModularSystemPrompt(
  intent: UserIntent,
  dateStr: string,
  year: number,
  isPlanMode: boolean,
  isUnsafe: boolean,
  customOverride?: string,
  supportNativeTools: boolean = true,
  claudeMemory?: string | null
): string {
  if (isUnsafe) {
    return "Warning: Unsafe prompt detected. Politely decline.";
  }

  // Shared language rule: default to replying in the user's language unless CLAUDE.md or user directive specifies otherwise.
  const LANGUAGE_RULE = "- Reply in the SAME language the user writes in (unless CLAUDE.md or explicit instructions specify a target language), regardless of what language search results, URLs, or tool output are in. Never switch language to match raw tool output.";

  // Shared, non-negotiable image inspection rule:
  // When asked about an image or visual asset without an exact path, the model MUST first call list_directory to find the image file, and then call view_image with that path. NEVER call run_code when inspecting images.
  const IMAGE_RULE = `- When the user refers to an image, screenshot, or graphic asset (e.g. png, jpg, webp, svg):
  * If the exact path is not specified, ALWAYS call 'list_directory' first to discover the available image files in the workspace.
  * Once the image path is identified, ALWAYS call 'view_image' with the exact path (e.g. 'screenshot.png') to visually inspect the image.
  * NEVER call 'run_code' with empty or unneeded code when dealing with images.`;

  let prompt = "";

  const TOOL_DIRECTIVE = supportNativeTools
    ? '- Use the provided native tools directly and silently. Do NOT output raw command text or pseudocode in chat responses.'
    : '- You must use the ">>> COMMAND" plain text syntax to use tools.';

  switch (intent) {
    case "user_want_code":
      prompt = `[INTENT: CODE] Expert AI coder.
- NO emojis/stickers.
${TOOL_DIRECTIVE}
${LANGUAGE_RULE}
${IMAGE_RULE}
- Maintain UI design, layout, margins & colors.
- Use tool calls. Auto-retry on errors.`;
      break;

    case "user_want_search":
      prompt = `[INTENT: SEARCH] Research AI. Date: ${dateStr}.
- NO emojis/stickers.
${TOOL_DIRECTIVE}
${LANGUAGE_RULE}
${IMAGE_RULE}
- The user is asking about real-time, current, or time-sensitive information.
- You MUST call the 'search_web' tool BEFORE answering. Do not answer from memory alone, and do not skip this step even if you believe you already know the answer.
- When you call search_web, do NOT also write a full/conclusive answer in that same turn -- you have not seen the results yet. Either call the tool with no accompanying answer text, or at most a short one-line acknowledgment (e.g. "Let me check that").
- Give your actual answer only in a later turn, after the tool result has come back.
- ALWAYS call the 'read_url' tool on the most relevant URL from the search results to get full information before concluding. Do not guess from a snippet alone.
- If 'read_url' fails or gets blocked, you MUST call it again on a DIFFERENT URL until you succeed.`;
      break;

    case "user_just_chat_normal":
    default:
      prompt = `[INTENT: CHAT] AI Assistant.
- NO emojis/stickers.
${TOOL_DIRECTIVE}
${LANGUAGE_RULE}
${IMAGE_RULE}
- Answer directly for things you're confident about. No unsolicited tools/boilerplate for those.
- Exception: if the question is about something current, recent, version-specific, or you're not confident you know the up-to-date answer, call 'search_web' first instead of guessing.`;
      break;
  }

  // Inject CLAUDE.md guidelines & memory dynamically from VFS
  if (claudeMemory && claudeMemory.trim()) {
    prompt += `\n\n### PROJECT MEMORY & GUIDELINES (from CLAUDE.md)\nThe following project rules, instructions, and constraints from CLAUDE.md MUST be strictly followed across all responses and tool executions:\n${claudeMemory.trim()}`;
  }

  if (customOverride && customOverride.trim()) {
    prompt += `\n\n[USER DIRECTIVE]: ${customOverride.trim()}`;
  }

  if (isPlanMode) {
    prompt += `\n\n[PLAN]: Output step checklist first. Do not call tools until confirmed.`;
  }

  return prompt;
}

function parseToolCallsAndReasoning(text: string): { reasoning: string; cleanContent: string; toolCalls: any[] } {
  let reasoning = "";
  let cleanContent = text || "";
  const toolCalls: any[] = [];

  const generateId = (prefix = "tc-tag") => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 1. Extract reasoning from <think>...</think> or leading thoughts ending with </think>
  if (cleanContent.includes("</think>")) {
    const thinkEndIdx = cleanContent.indexOf("</think>");
    const thinkStartIdx = cleanContent.indexOf("<think>");
    if (thinkStartIdx !== -1 && thinkStartIdx < thinkEndIdx) {
      reasoning = cleanContent.substring(thinkStartIdx + 7, thinkEndIdx).trim();
      cleanContent = cleanContent.substring(0, thinkStartIdx) + cleanContent.substring(thinkEndIdx + 8);
    } else {
      // No opening <think>, everything before </think> is reasoning
      reasoning = cleanContent.substring(0, thinkEndIdx).trim();
      cleanContent = cleanContent.substring(thinkEndIdx + 8);
    }
  } else if (cleanContent.includes("<think>")) {
    const thinkStartIdx = cleanContent.indexOf("<think>");
    reasoning = cleanContent.substring(thinkStartIdx + 7).trim();
    cleanContent = cleanContent.substring(0, thinkStartIdx);
  }

  // Handle any additional <think> blocks if present
  const extraThinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  let exMatch;
  while ((exMatch = extraThinkRegex.exec(cleanContent)) !== null) {
    const extraReasoning = exMatch[1].trim();
    if (extraReasoning) {
      reasoning = reasoning ? `${reasoning}\n\n${extraReasoning}` : extraReasoning;
    }
  }
  cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/gi, "");

  // 2. Extract <tool_call> and <tool_calls> blocks
  const toolCallBlockRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
  let match;
  while ((match = toolCallBlockRegex.exec(cleanContent)) !== null) {
    const block = match[1].trim();
    let isJsonHandled = false;

    // A. Check if the block is raw JSON
    if (block.startsWith("{") && block.endsWith("}")) {
      try {
        const parsed = JSON.parse(block);
        if (parsed.name) {
          toolCalls.push({
            id: generateId("tc-json"),
            type: "function",
            function: {
              name: parsed.name,
              arguments: typeof parsed.arguments === "string" ? parsed.arguments : JSON.stringify(parsed.arguments || {})
            }
          });
          isJsonHandled = true;
        } else if (parsed.function?.name) {
          toolCalls.push({
            id: generateId("tc-json"),
            type: "function",
            function: {
              name: parsed.function.name,
              arguments: typeof parsed.function.arguments === "string" ? parsed.function.arguments : JSON.stringify(parsed.function.arguments || {})
            }
          });
          isJsonHandled = true;
        }
      } catch (e) {}
    }

    // B. Tag-based XML format inside <tool_call>
    // Handles: <function=name>, <function name="name">, <invoke name="name">
    if (!isJsonHandled) {
      const funcMatch = block.match(/<function(?:=|\s+name=|\s*=\s*)["']?([^>"\s]+)["']?>([\s\S]*?)(?:<\/function>|$)/i) ||
                        block.match(/<invoke(?:=|\s+name=|\s*=\s*)["']?([^>"\s]+)["']?>([\s\S]*?)(?:<\/invoke>|$)/i);
      
      if (funcMatch) {
        const funcName = funcMatch[1].trim();
        const paramsBody = funcMatch[2];
        const argsObj: Record<string, string> = {};

        // Match <parameter=key>value</parameter> or <parameter name="key">value</parameter>
        const paramRegex = /<parameter(?:=|\s+name=|\s*=\s*)["']?([^>"\s]+)["']?>([\s\S]*?)(?:<\/parameter>|(?=<parameter|$))/gi;
        let pMatch;
        while ((pMatch = paramRegex.exec(paramsBody)) !== null) {
          const paramKey = pMatch[1].trim();
          let paramVal = pMatch[2].trim();
          argsObj[paramKey] = paramVal;
        }

        toolCalls.push({
          id: generateId("tc-xml"),
          type: "function",
          function: {
            name: funcName,
            arguments: JSON.stringify(argsObj)
          }
        });
      }
    }
  }

  // Remove handled <tool_call> and <tool_calls>
  cleanContent = cleanContent
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<tool_calls>[\s\S]*?<\/tool_calls>/gi, "")
    .trim();

  // 3. Check for standalone <function=...> tags without <tool_call>
  const standaloneFuncRegex = /<function(?:=|\s+name=|\s*=\s*)["']?([^>"\s]+)["']?>([\s\S]*?)<\/function>/gi;
  let sMatch;
  while ((sMatch = standaloneFuncRegex.exec(cleanContent)) !== null) {
    const funcName = sMatch[1].trim();
    const paramsBody = sMatch[2];
    const argsObj: Record<string, string> = {};
    const paramRegex = /<parameter(?:=|\s+name=|\s*=\s*)["']?([^>"\s]+)["']?>([\s\S]*?)(?:<\/parameter>|(?=<parameter|$))/gi;
    let pMatch;
    while ((pMatch = paramRegex.exec(paramsBody)) !== null) {
      const paramKey = pMatch[1].trim();
      const paramVal = pMatch[2].trim();
      argsObj[paramKey] = paramVal;
    }
    toolCalls.push({
      id: generateId("tc-standalone"),
      type: "function",
      function: {
        name: funcName,
        arguments: JSON.stringify(argsObj)
      }
    });
  }

  cleanContent = cleanContent
    .replace(/<function(?:=|\s+name=|\s*=\s*)["']?[^>"\s]+["']?>[\s\S]*?<\/function>/gi, "")
    .trim();

  // 4. Plain commands (>>> SEARCH, >>> WRITE, [Called tool: ...], search_web, etc.)
  if (
    cleanContent.includes(">>>") || 
    cleanContent.toLowerCase().includes("search_web") || 
    cleanContent.toLowerCase().includes("read_url") ||
    /\[(?:Called tool|Calling tool|tool_call|tool)\s*:/i.test(cleanContent)
  ) {
    const parsedPlain = parsePlainCommands(cleanContent);
    if (parsedPlain.toolCalls.length > 0) {
      toolCalls.push(...parsedPlain.toolCalls);
    }
    cleanContent = parsedPlain.cleanedText;
  }

  return { reasoning, cleanContent, toolCalls };
}

function parsePlainCommands(text: string): { toolCalls: any[], cleanedText: string } {
  const toolCalls: any[] = [];
  const cleanLines: string[] = [];
  const lines = text.split("\n");
  let i = 0;

  const generateId = (prefix = "tc-plain") => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const tryExtractJson = (str: string): any | null => {
    const jsonMatch = str.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {}
    }
    return null;
  };

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Check for [Called tool: <name> with arguments {...}] or [Calling tool: ...] or [tool_call: ...]
    const bracketMatch = line.match(/^\[(?:Called tool|Calling tool|tool_call|tool)\s*:?\s*([A-Za-z0-9_]+)(?:\s+with arguments\s*:?)?\s*(.*)$/i);
    if (bracketMatch) {
      const fnName = bracketMatch[1].trim();
      let restStr = bracketMatch[2].trim();
      
      // If closing bracket is at end of string, strip it
      if (restStr.endsWith("]")) {
        restStr = restStr.slice(0, -1).trim();
      }

      let parsedArgs = tryExtractJson(restStr);
      if (!parsedArgs && restStr.startsWith("{")) {
        // Might span multiple lines
        let accumulated = restStr;
        let j = i + 1;
        while (j < lines.length && !parsedArgs) {
          accumulated += "\n" + lines[j];
          if (accumulated.endsWith("]")) {
            accumulated = accumulated.slice(0, -1).trim();
          }
          parsedArgs = tryExtractJson(accumulated);
          j++;
        }
        if (parsedArgs) {
          i = j - 1;
        }
      }

      if (parsedArgs) {
        toolCalls.push({
          id: generateId(`tc-${fnName}`),
          type: "function",
          function: {
            name: fnName,
            arguments: JSON.stringify(parsedArgs)
          }
        });
        i++;
        continue;
      }
    }

    // Check for JSON embedded directly in any >>> command line first
    const lineJson = line.startsWith(">>>") ? tryExtractJson(line) : null;

    if (line.startsWith(">>> SEARCH_WEB") || line.startsWith(">>>SEARCH_WEB") || (!line.startsWith(">>>") && line.toLowerCase().includes("search_web"))) {
      const query = lineJson?.query ||
        (line.match(/query="([^"]+)"/i) || line.match(/query='([^']+)'/i) || line.match(/"query"\s*:\s*"([^"]+)"/i) || line.match(/search_web\s*\(\s*query\s*=\s*"([^"]+)"\s*\)/i) || line.match(/search_web\s+([^\s\n]+)/i))?.[1] ||
        "latest updates";

      toolCalls.push({
        id: generateId("tc-search-web"),
        type: "function",
        function: {
          name: "search_web",
          arguments: JSON.stringify({ query })
        }
      });
      i++;
    } else if (line.toLowerCase().includes("read_url") || line.toLowerCase().includes("read:") || line.toLowerCase().includes("<read:")) {
      const url = lineJson?.url ||
        (line.match(/url="([^"]+)"/i) || line.match(/url='([^']+)'/i) || line.match(/"url"\s*:\s*"([^"]+)"/i) || line.match(/read:\s*([^\s,>]+)/i) || line.match(/read_url\s*\(\s*url\s*=\s*"([^"]+)"/i) || line.match(/read:\s*([^,>\s]+)/i) || line.match(/<read:\s*([^,>\s]+)/i))?.[1]?.replace(/[">]/g, '').trim();

      const moreMatch = line.match(/part\s*=\s*"?(\d+)"?/i) || line.match(/"part"\s*:\s*(\d+)/i) || line.match(/more:\s*([^>]+)/i) || line.match(/more:(\d+)/i);
      let partNum = lineJson?.part || 1;
      if (!lineJson?.part && moreMatch) {
        const digitMatch = moreMatch[1].match(/\d+/);
        if (digitMatch) {
          partNum = parseInt(digitMatch[0], 10);
        }
      }

      if (url) {
        toolCalls.push({
          id: generateId("tc-read-url"),
          type: "function",
          function: {
            name: "read_url",
            arguments: JSON.stringify({
              url,
              part: partNum
            })
          }
        });
      }
      i++;
    } else if (line.startsWith(">>> LIST_DIRECTORY") || line.startsWith(">>>LIST_DIRECTORY") || line.startsWith(">>> LIST_DIR") || line.startsWith(">>> LIST") || line.startsWith(">>>LIST")) {
      toolCalls.push({
        id: generateId("tc-list-dir"),
        type: "function",
        function: {
          name: "list_directory",
          arguments: "{}"
        }
      });
      i++;
    } else if (line.startsWith(">>> SEARCH") || line.startsWith(">>>SEARCH") || line.startsWith(">>> GREP") || line.startsWith(">>>GREP")) {
      const pattern = lineJson?.pattern || (line.match(/pattern="([^"]+)"/i) || line.match(/pattern='([^']+)'/i))?.[1];
      const path = lineJson?.path || (line.match(/path="([^"]+)"/i) || line.match(/path='([^']+)'/i))?.[1];
      if (pattern) {
        toolCalls.push({
          id: generateId("tc-grep"),
          type: "function",
          function: {
            name: "grep_files",
            arguments: JSON.stringify({
              pattern,
              path: path || undefined
            })
          }
        });
      }
      i++;
    } else if (line.startsWith(">>> GLOB") || line.startsWith(">>>GLOB")) {
      const pattern = lineJson?.pattern || (line.match(/pattern="([^"]+)"/i) || line.match(/pattern='([^']+)'/i))?.[1];
      if (pattern) {
        toolCalls.push({
          id: generateId("tc-glob"),
          type: "function",
          function: {
            name: "glob_files",
            arguments: JSON.stringify({ pattern })
          }
        });
      }
      i++;
    } else if (line.startsWith(">>> STATS") || line.startsWith(">>>STATS") || line.startsWith(">>> FILE_STATS") || line.startsWith(">>>FILE_STATS")) {
      const path = lineJson?.path || (line.match(/path="([^"]+)"/i) || line.match(/path='([^']+)'/i))?.[1];
      if (path) {
        toolCalls.push({
          id: generateId("tc-stats"),
          type: "function",
          function: {
            name: "file_stats",
            arguments: JSON.stringify({ path })
          }
        });
      }
      i++;
    } else if (line.startsWith(">>> READ_FILE") || line.startsWith(">>>READ_FILE") || line.startsWith(">>> READ") || line.startsWith(">>>READ")) {
      const path = lineJson?.path || 
        (line.match(/path="([^"]+)"/i) || line.match(/path='([^']+)'/i))?.[1] ||
        line.replace(/^>>>\s*(READ_FILE|READ)\s*/i, '').trim();

      const offset = lineJson?.offset ?? (line.match(/offset=(\d+)/i)?.[1] ? parseInt(line.match(/offset=(\d+)/i)![1], 10) : undefined);
      const limit = lineJson?.limit ?? (line.match(/limit=(\d+)/i)?.[1] ? parseInt(line.match(/limit=(\d+)/i)![1], 10) : undefined);

      if (path && !path.startsWith("{")) {
        toolCalls.push({
          id: generateId("tc-read"),
          type: "function",
          function: {
            name: "read_file",
            arguments: JSON.stringify({
              path: path.replace(/[">]/g, '').trim(),
              offset,
              limit
            })
          }
        });
      }
      i++;
    } else if (line.startsWith(">>> VIEW_IMAGE") || line.startsWith(">>>VIEW_IMAGE") || line.startsWith(">>> IMAGE") || line.startsWith(">>>IMAGE")) {
      const path = lineJson?.path || 
        (line.match(/path="([^"]+)"/i) || line.match(/path='([^']+)'/i))?.[1] ||
        line.replace(/^>>>\s*(VIEW_IMAGE|IMAGE)\s*/i, '').trim();

      if (path && !path.startsWith("{")) {
        toolCalls.push({
          id: generateId("tc-view-image"),
          type: "function",
          function: {
            name: "view_image",
            arguments: JSON.stringify({
              path: path.replace(/[">]/g, '').trim()
            })
          }
        });
      }
      i++;
    } else if (line.startsWith(">>> EDIT_FILE") || line.startsWith(">>>EDIT_FILE") || line.startsWith(">>> EDIT") || line.startsWith(">>>EDIT")) {
      if (lineJson?.path && lineJson?.old_string !== undefined && lineJson?.new_string !== undefined) {
        toolCalls.push({
          id: generateId("tc-edit"),
          type: "function",
          function: {
            name: "edit_file",
            arguments: JSON.stringify({
              path: lineJson.path,
              old_string: lineJson.old_string,
              new_string: lineJson.new_string
            })
          }
        });
        i++;
      } else {
        const pathMatch = line.match(/path="([^"]+)"/i) || line.match(/path='([^']+)'/i);
        if (pathMatch) {
          const path = pathMatch[1];
          let oldStr = "";
          let newStr = "";
          let mode: "seeking_old" | "reading_old" | "reading_new" = "seeking_old";
          
          i++;
          while (i < lines.length) {
            const subLine = lines[i];
            const subLineTrim = subLine.trim();

            if (subLineTrim.startsWith(">>>")) {
              break;
            }
            if (subLineTrim === "```" && mode === "reading_new") {
              i++;
              break;
            }

            if (mode === "seeking_old") {
              if (subLineTrim === "OLD:" || subLineTrim.startsWith("OLD:")) {
                mode = "reading_old";
                const inlineOld = subLineTrim.replace(/^OLD:\s*/, "");
                if (inlineOld) oldStr += (oldStr ? "\n" : "") + inlineOld;
              }
            } else if (mode === "reading_old") {
              if (subLineTrim === "NEW:" || subLineTrim.startsWith("NEW:")) {
                mode = "reading_new";
                const inlineNew = subLineTrim.replace(/^NEW:\s*/, "");
                if (inlineNew) newStr += (newStr ? "\n" : "") + inlineNew;
              } else {
                oldStr += (oldStr ? "\n" : "") + subLine;
              }
            } else if (mode === "reading_new") {
              newStr += (newStr ? "\n" : "") + subLine;
            }
            i++;
          }

          toolCalls.push({
            id: generateId("tc-edit"),
            type: "function",
            function: {
              name: "edit_file",
              arguments: JSON.stringify({
                path,
                old_string: oldStr,
                new_string: newStr
              })
            }
          });
        } else {
          i++;
        }
      }
    } else if (line.startsWith(">>> MULTIEDIT") || line.startsWith(">>>MULTIEDIT") || line.startsWith(">>> MULTI_EDIT") || line.startsWith(">>>MULTI_EDIT")) {
      if (lineJson?.path && Array.isArray(lineJson?.edits)) {
        toolCalls.push({
          id: generateId("tc-multiedit"),
          type: "function",
          function: {
            name: "multi_edit_file",
            arguments: JSON.stringify(lineJson)
          }
        });
        i++;
      } else {
        const pathMatch = line.match(/path="([^"]+)"/i) || line.match(/path='([^']+)'/i);
        if (pathMatch) {
          const path = pathMatch[1];
          const edits: any[] = [];
          let oldStr = "";
          let newStr = "";
          let mode: "seeking" | "reading_old" | "reading_new" = "seeking";

          i++;
          while (i < lines.length) {
            const subLine = lines[i];
            const subLineTrim = subLine.trim();

            if (subLineTrim.startsWith(">>>")) {
              break;
            }
            if (subLineTrim === "```" && mode === "reading_new") {
              i++;
              break;
            }

            if (subLineTrim === "---") {
              if (oldStr) {
                edits.push({ old_string: oldStr, new_string: newStr });
                oldStr = "";
                newStr = "";
              }
              mode = "seeking";
            } else if (subLineTrim.startsWith("OLD:")) {
              const inlineMatch = subLine.match(/^OLD:\s*(.*)$/);
              if (inlineMatch && inlineMatch[1].trim()) {
                oldStr = inlineMatch[1];
                mode = "reading_old";
              } else {
                mode = "reading_old";
              }
            } else if (subLineTrim.startsWith("NEW:")) {
              const inlineMatch = subLine.match(/^NEW:\s*(.*)$/);
              if (inlineMatch && inlineMatch[1].trim()) {
                newStr = inlineMatch[1];
                mode = "reading_new";
              } else {
                mode = "reading_new";
              }
            } else {
              if (mode === "reading_old") {
                oldStr += (oldStr ? "\n" : "") + subLine;
              } else if (mode === "reading_new") {
                newStr += (newStr ? "\n" : "") + subLine;
              }
            }
            i++;
          }

          if (oldStr) {
            edits.push({ old_string: oldStr, new_string: newStr });
          }

          if (edits.length > 0) {
            toolCalls.push({
              id: generateId("tc-multiedit"),
              type: "function",
              function: {
                name: "multi_edit_file",
                arguments: JSON.stringify({
                  path,
                  edits
                })
              }
            });
          }
        } else {
          i++;
        }
      }
    } else if (line.startsWith(">>> WRITE_FILE") || line.startsWith(">>>WRITE_FILE") || line.startsWith(">>> WRITE") || line.startsWith(">>>WRITE")) {
      if (lineJson?.path && lineJson?.content !== undefined) {
        toolCalls.push({
          id: generateId("tc-write"),
          type: "function",
          function: {
            name: "write_file",
            arguments: JSON.stringify({
              path: lineJson.path,
              content: lineJson.content
            })
          }
        });
        i++;
      } else {
        const pathMatch = line.match(/path="([^"]+)"/i) || line.match(/path='([^']+)'/i);
        if (pathMatch) {
          const path = pathMatch[1];
          let content = "";
          
          i++;
          while (i < lines.length) {
            const subLine = lines[i];
            const subLineTrim = subLine.trim();

            if (subLineTrim.startsWith(">>>")) {
              break;
            }
            if (subLineTrim === "```") {
              i++;
              break;
            }
            content += (content ? "\n" : "") + subLine;
            i++;
          }

          toolCalls.push({
            id: generateId("tc-write"),
            type: "function",
            function: {
              name: "write_file",
              arguments: JSON.stringify({
                path,
                content
              })
            }
          });
        } else {
          i++;
        }
      }
    } else if (line.startsWith(">>> RUN_CODE") || line.startsWith(">>>RUN_CODE") || line.startsWith(">>> RUN") || line.startsWith(">>>RUN")) {
      if (lineJson?.code) {
        toolCalls.push({
          id: generateId("tc-run"),
          type: "function",
          function: {
            name: "run_code",
            arguments: JSON.stringify({ code: lineJson.code })
          }
        });
        i++;
      } else {
        let code = "";
        i++;
        while (i < lines.length) {
          const subLine = lines[i];
          const subLineTrim = subLine.trim();

          if (subLineTrim.startsWith(">>>")) {
            break;
          }
          if (subLineTrim === "```") {
            i++;
            break;
          }
          code += (code ? "\n" : "") + subLine;
          i++;
        }

        toolCalls.push({
          id: generateId("tc-run"),
          type: "function",
          function: {
            name: "run_code",
            arguments: JSON.stringify({ code })
          }
        });
      }
    } else if (line.startsWith(">>> TODO") || line.startsWith(">>>TODO")) {
      const todos: any[] = [];
      i++;
      while (i < lines.length) {
        const subLine = lines[i];
        const subLineTrim = subLine.trim();

        if (subLineTrim.startsWith(">>>")) {
          break;
        }
        if (subLineTrim === "```") {
          i++;
          break;
        }
        
        const todoMatch = subLineTrim.match(/^\[([ xX]?)\]\s*(.*)$/);
        if (todoMatch) {
          todos.push({
            text: todoMatch[2].trim(),
            done: todoMatch[1].toLowerCase() === "x"
          });
        }
        i++;
      }

      if (todos.length > 0) {
        toolCalls.push({
          id: generateId("tc-todo"),
          type: "function",
          function: {
            name: "manage_todos",
            arguments: JSON.stringify({
              action: "update",
              todos
            })
          }
        });
      }
    } else if (line.startsWith(">>> TODO_UPDATE") || line.startsWith(">>>TODO_UPDATE")) {
      const itemMatch = line.match(/item="([^"]+)"/i) || line.match(/item='([^']+)'/i);
      const statusMatch = line.match(/status="([^"]+)"/i) || line.match(/status='([^']+)'/i);
      if (itemMatch && statusMatch) {
        toolCalls.push({
          id: generateId("tc-todo-upd"),
          type: "function",
          function: {
            name: "manage_todos",
            arguments: JSON.stringify({
              action: "update_item",
              item: itemMatch[1],
              status: statusMatch[1]
            })
          }
        });
      }
      i++;
    } else if (line.startsWith(">>> SUBTASK") || line.startsWith(">>>SUBTASK")) {
      let desc = "";
      const inlineMatch = line.match(/^>>>\s*SUBTASK\s*(.*)$/i);
      if (inlineMatch && inlineMatch[1].trim()) {
        desc = inlineMatch[1].trim();
      }
      i++;
      while (i < lines.length) {
        const subLine = lines[i];
        const subLineTrim = subLine.trim();

        if (subLineTrim.startsWith(">>>")) {
          break;
        }
        if (subLineTrim === "```") {
          i++;
          break;
        }
        desc += (desc ? "\n" : "") + subLine;
        i++;
      }

      toolCalls.push({
        id: generateId("tc-subtask"),
        type: "function",
        function: {
          name: "delegate_subtask",
          arguments: JSON.stringify({
            description: desc
          })
        }
      });
    } else if (line.startsWith(">>>")) {
      // Any generic >>> command: try dynamic extraction or safely drop from chat
      const genericMatch = line.match(/^>>>\s*([A-Za-z0-9_]+)\s*(.*)$/);
      if (genericMatch) {
        const fnName = genericMatch[1].toLowerCase();
        const rawArgs = genericMatch[2].trim();
        const parsedArgs = tryExtractJson(rawArgs);
        if (parsedArgs) {
          toolCalls.push({
            id: generateId(`tc-${fnName}`),
            type: "function",
            function: {
              name: fnName,
              arguments: JSON.stringify(parsedArgs)
            }
          });
        }
      }
      i++;
    } else {
      cleanLines.push(rawLine);
      i++;
    }
  }

  return { toolCalls, cleanedText: cleanLines.join("\n").trim() };
}