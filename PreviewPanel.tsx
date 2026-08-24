import React, { useState, useEffect, useRef } from "react";
import { VFS } from "../types";
import { FileText } from "lucide-react";
import { runJsTest, runHtmlTest, TestResult } from "../utils/testRunner";
import { getFileMetadata, isDataURL } from "../utils/fileUtils";

interface PreviewPanelProps {
  vfs: VFS;
  selectedFile: string | null;
  onClose: () => void;
  onSaveFile?: (path: string, content: string) => void;
}

interface CodeBlock {
  id: string;
  title: string;
  startLine: number;
  endLine: number;
  lines: string[];
  relatedNote?: string;
}

function parseFileIntoBlocks(lines: string[], ext: string): CodeBlock[] {
  if (lines.length === 0) return [];

  const blocks: CodeBlock[] = [];
  let currentStart = 1;
  let currentTitle = "### Imports & Setup";
  let currentLines: string[] = [];

  const flushBlock = (endLine: number) => {
    if (currentLines.length > 0) {
      blocks.push({
        id: `block-${blocks.length}`,
        title: currentTitle,
        startLine: currentStart,
        endLine: endLine,
        lines: [...currentLines]
      });
    }
  };

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    let newHeading: string | null = null;

    if (ext === "md" || ext === "markdown") {
      if (/^#{1,6}\s+/.test(trimmed)) {
        newHeading = `### ${trimmed.replace(/^#{1,6}\s+/, "")}`;
      }
    } else {
      if (/^export\s+(async\s+)?function\s+([A-Za-z0-9_]+)/.test(trimmed)) {
        const m = trimmed.match(/^export\s+(async\s+)?function\s+([A-Za-z0-9_]+)/);
        newHeading = `### function ${m ? m[2] : 'function'}`;
      } else if (/^(async\s+)?function\s+([A-Za-z0-9_]+)/.test(trimmed)) {
        const m = trimmed.match(/^(async\s+)?function\s+([A-Za-z0-9_]+)/);
        newHeading = `### function ${m ? m[2] : 'function'}`;
      } else if (/^export\s+class\s+([A-Za-z0-9_]+)/.test(trimmed) || /^class\s+([A-Za-z0-9_]+)/.test(trimmed)) {
        const m = trimmed.match(/(?:export\s+)?class\s+([A-Za-z0-9_]+)/);
        newHeading = `### class ${m ? m[1] : 'Class'}`;
      } else if (/^export\s+interface\s+([A-Za-z0-9_]+)/.test(trimmed) || /^interface\s+([A-Za-z0-9_]+)/.test(trimmed)) {
        const m = trimmed.match(/(?:export\s+)?interface\s+([A-Za-z0-9_]+)/);
        newHeading = `### interface ${m ? m[1] : 'Interface'}`;
      } else if (/^export\s+const\s+([A-Za-z0-9_]+)/.test(trimmed)) {
        const m = trimmed.match(/^export\s+const\s+([A-Za-z0-9_]+)/);
        newHeading = `### export const ${m ? m[1] : 'const'}`;
      } else if (index > 0 && currentLines.length >= 35 && (trimmed.startsWith("const ") || trimmed.startsWith("function ") || trimmed.startsWith("//"))) {
        newHeading = `### Block (line ${lineNum})`;
      }
    }

    if (newHeading && index > 0) {
      flushBlock(lineNum - 1);
      currentStart = lineNum;
      currentTitle = newHeading;
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  });

  flushBlock(lines.length);

  const importBlock = blocks.find(b => b.startLine === 1);
  blocks.forEach((b, idx) => {
    if (idx > 0 && importBlock) {
      b.relatedNote = `Related: import in block ${importBlock.title.replace(/^###\s+/, '')} (lines ${importBlock.startLine}–${importBlock.endLine})`;
    }
  });

  return blocks;
}

function highlightLine(line: string, ext: string): React.ReactNode {
  if (line.startsWith("+ ")) {
    return <span className="diff-added">{line}</span>;
  }
  if (line.startsWith("- ")) {
    return <span className="diff-removed">{line}</span>;
  }

  // Comments
  if (/^\s*(\/\/|#|\/\*|\*)/.test(line)) {
    return <span className="text-[#666666] italic">{line}</span>;
  }

  const keywordRegex = /\b(const|let|var|function|return|if|else|for|while|import|export|from|default|class|extends|interface|type|async|await|try|catch|throw|new|typeof|instanceof|void|null|undefined|true|false)\b/g;
  const stringRegex = /(["'`])(?:(?=(\\?))\2[\s\S])*?\1/g;
  const numberRegex = /\b\d+(\.\d+)?\b/g;

  const tokens: { start: number; end: number; type: "string" | "keyword" | "number" }[] = [];
  let match: RegExpExecArray | null;

  stringRegex.lastIndex = 0;
  while ((match = stringRegex.exec(line)) !== null) {
    tokens.push({ start: match.index, end: match.index + match[0].length, type: "string" });
  }

  keywordRegex.lastIndex = 0;
  while ((match = keywordRegex.exec(line)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (!tokens.some(t => start >= t.start && end <= t.end)) {
      tokens.push({ start, end, type: "keyword" });
    }
  }

  numberRegex.lastIndex = 0;
  while ((match = numberRegex.exec(line)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (!tokens.some(t => start >= t.start && end <= t.end)) {
      tokens.push({ start, end, type: "number" });
    }
  }

  tokens.sort((a, b) => a.start - b.start);

  if (tokens.length === 0) {
    return <span className="text-[#e5e5e5]">{line}</span>;
  }

  const elements: React.ReactNode[] = [];
  let currentIdx = 0;

  tokens.forEach((t, i) => {
    if (t.start > currentIdx) {
      elements.push(<span key={`text-${i}`} className="text-[#e5e5e5]">{line.slice(currentIdx, t.start)}</span>);
    }
    const tokenText = line.slice(t.start, t.end);
    let colorClass = "text-[#e5e5e5]";
    if (t.type === "string") colorClass = "text-[#4ADE80]";
    else if (t.type === "keyword") colorClass = "text-[#38BDF8]";
    else if (t.type === "number") colorClass = "text-[#FACC15]";

    elements.push(<span key={`tok-${i}`} className={colorClass}>{tokenText}</span>);
    currentIdx = t.end;
  });

  if (currentIdx < line.length) {
    elements.push(<span key="tail" className="text-[#e5e5e5]">{line.slice(currentIdx)}</span>);
  }

  return <>{elements}</>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function PreviewPanel({ vfs, selectedFile, onClose, onSaveFile }: PreviewPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  // Run Test States
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testStatusMsg, setTestStatusMsg] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const htmlTestCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (htmlTestCleanupRef.current) {
        htmlTestCleanupRef.current();
        htmlTestCleanupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (selectedFile) {
      const fileContent = vfs[selectedFile] ?? "";
      setEditedContent(fileContent);
      setIsEditing(false);
      
      // Reset test results & cleanup active HTML tests when switching files
      if (htmlTestCleanupRef.current) {
        htmlTestCleanupRef.current();
        htmlTestCleanupRef.current = null;
      }
      setIsRunningTest(false);
      setTestResult(null);
      
      const fileLines = fileContent.split("\n");
      const ext = selectedFile.split(".").pop()?.toLowerCase() || "";
      const parsedBlocks = parseFileIntoBlocks(fileLines, ext);
      
      // Default: if file short or 1 block, open all. Otherwise open block 0
      const initialMap: Record<string, boolean> = {};
      parsedBlocks.forEach((b, idx) => {
        initialMap[b.id] = parsedBlocks.length === 1 || fileLines.length <= 25 || idx === 0;
      });
      setExpandedBlocks(initialMap);
    }
  }, [selectedFile, vfs]);

  if (!selectedFile) {
    return null;
  }

  const content = vfs[selectedFile] ?? "";
  const ext = selectedFile.split(".").pop()?.toLowerCase() || "";
  const isRunnable = ext === "js" || ext === "html";
  const lines = (isEditing ? editedContent : content).split("\n");
  const blocks = parseFileIntoBlocks(lines, ext);
  const isBinary = getFileMetadata(vfs, selectedFile).type === "binary";

  const handleSave = () => {
    if (selectedFile && onSaveFile) {
      onSaveFile(selectedFile, editedContent);
    }
    setIsEditing(false);
  };

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  const handleRunTest = async () => {
    setIsRunningTest(true);
    setTestResult(null);
    setTestStatusMsg("Running test...");

    const codeToRun = isEditing ? editedContent : content;

    if (ext === "js") {
      const res = await runJsTest(codeToRun, vfs);
      setTestResult(res);
      setIsRunningTest(false);
    } else if (ext === "html") {
      if (htmlTestCleanupRef.current) {
        htmlTestCleanupRef.current();
        htmlTestCleanupRef.current = null;
      }
      const cleanupFn = runHtmlTest(codeToRun, (res) => {
        setTestResult(res);
        setIsRunningTest(false);
      });
      htmlTestCleanupRef.current = cleanupFn;
    }
  };

  return (
    <div className="fixed inset-0 z-50 md:relative md:w-1/3 md:min-w-[320px] bg-[#0d0d0d] flex flex-col border-[#222222] md:border-l font-mono text-xs rounded-none">
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-[#222222] bg-[#141414]">
        <div className="flex items-center gap-2 truncate pr-2 text-[#cccccc]">
          <FileText size={13} className="text-[#D97757] shrink-0" />
          <span className="truncate font-medium text-[#e5e5e5]">{selectedFile}</span>
          <span className="text-[10px] text-[#666666]">({lines.length} lines · {blocks.length} blocks)</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {/* Replace [expand/collapse all] button with [Run Test] if .py, .js, .html. Otherwise hide completely */}
          {isRunnable && (
            <button
              onClick={handleRunTest}
              disabled={isRunningTest}
              className="text-[#D97757] hover:bg-[#D97757]/10 px-2 py-0.5 border border-[#D97757]/40 text-[11px] font-mono transition-colors disabled:opacity-50"
              title="Run Test on code file"
            >
              {isRunningTest ? "[running...]" : "[Run Test]"}
            </button>
          )}

          {isEditing ? (
            <button
              onClick={handleSave}
              className="text-[#D97757] font-bold hover:underline transition-colors"
              title="Save Changes"
            >
              [save]
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-[#777777] hover:text-[#e5e5e5] transition-colors"
              title="Edit File"
            >
              [edit]
            </button>
          )}

          <button 
            onClick={onClose} 
            className="text-[#777777] hover:text-[#D97757] font-bold transition-colors px-1"
            title="Close Preview (esc)"
          >
            ×
          </button>
        </div>
      </div>

      {/* Editor / Chunked Highlighted View */}
      <div className="flex-1 overflow-auto bg-[#090909] p-3 text-[#d4d4d4] leading-relaxed select-text font-mono">
        {isEditing ? (
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full h-full bg-transparent text-[#e5e5e5] outline-none border-none font-mono text-xs resize-none leading-relaxed"
            autoFocus
          />
        ) : isBinary ? (
          (() => {
            const mimeMatch = content.match(/^data:([^;]+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : "";
            const isImage = mimeType.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(selectedFile);
            const isVideo = mimeType.startsWith("video/") || /\.(mp4|webm)$/i.test(selectedFile);
            const isAudio = mimeType.startsWith("audio/") || /\.(mp3|wav|ogg)$/i.test(selectedFile);


            if (isImage) {
              return (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center select-none">
                  <div className="relative max-w-full max-h-[300px] bg-[#111111] p-2 border border-[#222222] rounded-xs mb-4 flex items-center justify-center overflow-hidden"
                       style={{
                         backgroundImage: "radial-gradient(#1f1f1f 20%, transparent 20%), radial-gradient(#1f1f1f 20%, transparent 20%)",
                         backgroundPosition: "0 0, 4px 4px",
                         backgroundSize: "8px 8px"
                       }}>
                    <img
                      src={content}
                      alt={selectedFile}
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-[280px] object-contain rounded-xs"
                    />
                  </div>
                  <div className="text-[#a0a0a0] font-semibold text-xs mb-1 truncate max-w-full">
                    {selectedFile.split("/").pop()}
                  </div>
                  <div className="text-[10px] text-[#666666]">
                    MIME: {mimeType || "image/*"} · {formatBytes(content.length)} (base64)
                  </div>
                </div>
              );
            }

            if (isVideo) {
              return (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <div className="w-full bg-[#111111] border border-[#222222] rounded-xs mb-4 p-1">
                    <video
                      src={content}
                      controls
                      className="w-full max-h-[300px] rounded-xs"
                      preload="metadata"
                    />
                  </div>
                  <div className="text-[#a0a0a0] font-semibold text-xs mb-1 truncate max-w-full">
                    {selectedFile.split("/").pop()}
                  </div>
                  <div className="text-[10px] text-[#666666]">
                    MIME: {mimeType || "video/*"} · {formatBytes(content.length)} (base64)
                  </div>
                </div>
              );
            }

            if (isAudio) {
              return (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <div className="w-full bg-[#111111] border border-[#222222] rounded-xs mb-4 p-4 flex items-center justify-center">
                    <audio
                      src={content}
                      controls
                      className="w-full max-w-[280px]"
                      preload="metadata"
                    />
                  </div>
                  <div className="text-[#a0a0a0] font-semibold text-xs mb-1 truncate max-w-full">
                    {selectedFile.split("/").pop()}
                  </div>
                  <div className="text-[10px] text-[#666666]">
                    MIME: {mimeType || "audio/*"} · {formatBytes(content.length)} (base64)
                  </div>
                </div>
              );
            }

            return (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center select-none">
                <div className="w-16 h-16 bg-[#111111] border border-[#222222] rounded-full flex items-center justify-center mb-4 text-[#D97757]">
                  <FileText size={32} />
                </div>
                <div className="text-[#e5e5e5] font-semibold text-sm mb-1 truncate max-w-full">
                  {selectedFile.split("/").pop()}
                </div>
                <div className="text-xs text-[#888888] mb-3">
                  Binary File ({formatBytes(content.length)})
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-[#D97757] hover:underline bg-[#D97757]/10 border border-[#D97757]/40 px-3 py-1 rounded-sm font-mono"
                >
                  [View Raw Base64 Data]
                </button>
              </div>
            );
          })()
        ) : ext === "svg" ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center select-none">
            <div className="relative w-full max-w-full max-h-[400px] min-h-[200px] bg-[#1a1a1a] p-4 border border-[#222222] rounded-xs mb-4 flex items-center justify-center overflow-hidden"
                 style={{
                   backgroundImage: "radial-gradient(#2a2a2a 20%, transparent 20%), radial-gradient(#2a2a2a 20%, transparent 20%)",
                   backgroundPosition: "0 0, 4px 4px",
                   backgroundSize: "8px 8px"
                 }}>
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(content)}`}
                alt={selectedFile}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[380px] object-contain rounded-xs"
              />
            </div>
            <div className="text-[#a0a0a0] font-semibold text-xs mb-1 truncate max-w-full">
              {selectedFile.split("/").pop()}
            </div>
            <div className="text-[10px] text-[#666666]">
              Vector Graphic (SVG) · {formatBytes(new Blob([content]).size)}
            </div>
          </div>
        ) : lines.length === 0 || (lines.length === 1 && lines[0] === "") ? (
          <span className="text-[#555555] italic">(empty file)</span>
        ) : (
          <div className="space-y-2">
            {blocks.map((block) => (
              <div key={block.id} className="border border-[#222222] bg-[#111111]">
                <div 
                  onClick={() => toggleBlock(block.id)}
                  className="flex items-center justify-between px-3 py-1.5 bg-[#161616] cursor-pointer hover:bg-[#1c1c1c] select-none border-b border-[#222222]"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[#D97757] font-bold text-xs">{block.title}</span>
                      <span className="text-[10px] text-[#888888] font-mono">(lines {block.startLine}–{block.endLine})</span>
                    </div>
                    {block.relatedNote && expandedBlocks[block.id] && (
                      <span className="text-[10px] text-[#777777] italic">{block.relatedNote}</span>
                    )}
                  </div>
                  <span className="text-[#777777] font-mono text-[10px]">
                    {expandedBlocks[block.id] ? "▲ [collapse]" : "▼ [expand block]"}
                  </span>
                </div>

                {expandedBlocks[block.id] && (
                  <div className="p-2 overflow-x-auto bg-[#090909]">
                    <table className="w-full border-collapse font-mono text-xs">
                      <tbody>
                        {block.lines.map((line, lIdx) => {
                          const lineNum = block.startLine + lIdx;
                          return (
                            <tr key={lineNum} className="hover:bg-[#151515]">
                              <td className="w-8 text-right pr-3 select-none text-[#444444] border-r border-[#1a1a1a] text-[11px] align-top">
                                {lineNum}
                              </td>
                              <td className="pl-3 whitespace-pre-wrap leading-relaxed align-top">
                                {highlightLine(line, ext)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Run Test Result Block */}
      {(isRunningTest || testResult) && (
        <div className="border-t border-[#222222] bg-[#111111] p-3 text-xs font-mono select-text shrink-0 flex flex-col max-h-[400px] md:max-h-[500px]">
          <div className="flex justify-between items-center mb-2 pb-1 border-b border-[#222222]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#e5e5e5]">[RUN TEST RESULT]</span>
              <span className="text-[#777777] truncate max-w-[120px]">{selectedFile}</span>
              {testResult && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold ${
                    testResult.isWarning || testResult.statusText === "WARNING"
                      ? "bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/40"
                      : testResult.hasError
                      ? "bg-[#f87171]/20 text-[#f87171] border border-[#f87171]/40"
                      : "bg-[#4ade80]/20 text-[#4ade80] border border-[#4ade80]/40"
                  }`}
                >
                  {testResult.isWarning || testResult.statusText === "WARNING"
                    ? "WARNING"
                    : testResult.hasError
                    ? "ERROR"
                    : "SUCCESS"}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                if (htmlTestCleanupRef.current) {
                  htmlTestCleanupRef.current();
                  htmlTestCleanupRef.current = null;
                }
                setTestResult(null);
                setIsRunningTest(false);
              }}
              className="text-[#777777] hover:text-[#e5e5e5] transition-colors font-bold px-1"
              title="Close Test Result"
            >
              [x]
            </button>
          </div>

          {isRunningTest && (
            <div className="text-[#888888] italic py-1">
              {testStatusMsg || "Executing code test..."}
            </div>
          )}

          {testResult && (
            <div className="space-y-2 overflow-y-auto flex-1 pr-1" style={{ overscrollBehavior: "contain" }}>
              {testResult.warningMessage && (
                <div className="p-2 bg-[#fbbf24]/10 border border-[#fbbf24]/30 text-[#fbbf24] whitespace-pre-wrap">
                  <div className="font-bold mb-1 text-[11px]">[Environment Limitation]</div>
                  <div className="text-[11px] leading-relaxed">{testResult.warningMessage}</div>
                </div>
              )}

              {testResult.errorMessage && (
                <div className="p-2 bg-[#f87171]/10 border border-[#f87171]/30 text-[#f87171] whitespace-pre-wrap">
                  <div className="font-bold mb-1">[Error Details]</div>
                  {testResult.errorLine && (
                    <div className="text-[11px] mb-1 font-bold text-[#f87171]">
                      Error at line: {testResult.errorLine}
                    </div>
                  )}
                  <div className="text-[11px]">{testResult.errorMessage}</div>
                </div>
              )}

              {testResult.logs && testResult.logs.length > 0 && (
                <div className="p-2 bg-[#090909] border border-[#222222] text-[#cccccc] whitespace-pre-wrap font-mono">
                  <div className="text-[10px] text-[#666666] mb-1 border-b border-[#1f1f1f] pb-0.5">
                    [Output Logs]
                  </div>
                  <div className="text-[11px] leading-relaxed">{testResult.logs.join("\n")}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
