export interface FileMetadata {
  type: "binary" | "text";
}

export const BINARY_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", 
  "mp4", "webm", "mp3", "wav", "ogg", 
  "rbxl", "zip", "pdf", "tar", "gz", 
  "rar", "exe", "dll", "so", "bin", 
  "dmg", "iso"
]);

export const TEXT_EXTENSIONS = new Set([
  "txt", "csv", "tsv", "py", "js", "ts", "jsx", "tsx", 
  "html", "css", "md", "json", "xml", "yml", "yaml", 
  "ini", "conf", "sh", "bat", "gitkeep", "gitignore", "svg"
]);

export function isBinaryFile(fileName: string, mimeType?: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (BINARY_EXTENSIONS.has(ext)) return true;
  if (TEXT_EXTENSIONS.has(ext)) return false;
  if (mimeType) {
    if (mimeType.startsWith("text/")) return false;
    if (mimeType.includes("json") || mimeType.includes("xml") || mimeType.includes("javascript")) return false;
  }
  return !TEXT_EXTENSIONS.has(ext);
}

export function getVfsMetadata(vfs: Record<string, string>): Record<string, FileMetadata> {
  const metaStr = vfs[".metadata.json"];
  if (metaStr) {
    try {
      const parsed = JSON.parse(metaStr);
      if (parsed && typeof parsed === "object" && parsed.files) {
        return parsed.files;
      }
    } catch (e) {
      console.error("Failed to parse VFS metadata:", e);
    }
  }
  return {};
}

export function getFileMetadata(vfs: Record<string, string>, path: string): FileMetadata {
  const files = getVfsMetadata(vfs);
  if (files[path]) {
    return files[path];
  }
  return { type: isBinaryFile(path) ? "binary" : "text" };
}

export function setVfsFileMetadata(
  vfs: Record<string, string>,
  path: string,
  meta: FileMetadata
): Record<string, string> {
  const currentMeta = { ...getVfsMetadata(vfs) };
  currentMeta[path] = meta;
  return {
    ...vfs,
    [".metadata.json"]: JSON.stringify({ files: currentMeta })
  };
}

export function removeVfsFileMetadata(
  vfs: Record<string, string>,
  path: string
): Record<string, string> {
  const currentMeta = { ...getVfsMetadata(vfs) };
  delete currentMeta[path];
  const nextVfs = { ...vfs };
  nextVfs[".metadata.json"] = JSON.stringify({ files: currentMeta });
  return nextVfs;
}

export function renameVfsFileMetadata(
  vfs: Record<string, string>,
  oldPath: string,
  newPath: string
): Record<string, string> {
  const currentMeta = { ...getVfsMetadata(vfs) };
  if (currentMeta[oldPath]) {
    currentMeta[newPath] = currentMeta[oldPath];
    delete currentMeta[oldPath];
  }
  const nextVfs = { ...vfs };
  nextVfs[".metadata.json"] = JSON.stringify({ files: currentMeta });
  return nextVfs;
}

/**
 * Utility to decode a base64 Data URL string back into a Uint8Array.
 */
export function dataURLToUint8Array(dataUrl: string): Uint8Array {
  const parts = dataUrl.split(",");
  if (parts.length < 2) return new Uint8Array();
  const base64 = parts[1];
  const raw = window.atob(base64);
  const rawLength = raw.length;
  const array = new Uint8Array(new ArrayBuffer(rawLength));
  for (let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

/**
 * Checks if a string content is a valid Data URL pattern.
 */
export function isDataURL(content: string): boolean {
  return typeof content === "string" && content.startsWith("data:") && content.includes(";base64,");
}

/**
 * Retrieves the project memory and guidelines from CLAUDE.md in the virtual file system.
 * Checks root workspace CLAUDE.md first, followed by case-insensitive matches and ~/.claude/CLAUDE.md.
 */
export function getClaudeMemory(vfs: Record<string, string> | undefined | null): string | null {
  if (!vfs) return null;

  // 1. Direct workspace root matches
  const rootKeys = ["CLAUDE.md", "/CLAUDE.md", "./CLAUDE.md", "claude.md", "/claude.md", "./claude.md"];
  let rootMemory = "";
  for (const k of rootKeys) {
    if (vfs[k] !== undefined && typeof vfs[k] === "string" && vfs[k].trim().length > 0) {
      rootMemory = vfs[k].trim();
      break;
    }
  }

  // 2. Case-insensitive search on all VFS keys if not found
  if (!rootMemory) {
    for (const [k, v] of Object.entries(vfs)) {
      const fileName = k.split("/").pop() || "";
      if (fileName.toLowerCase() === "claude.md" && typeof v === "string" && v.trim().length > 0) {
        rootMemory = v.trim();
        break;
      }
    }
  }

  // 3. User global memory (~/.claude/CLAUDE.md or .claude/CLAUDE.md)
  const userKeys = ["~/.claude/CLAUDE.md", ".claude/CLAUDE.md"];
  let userMemory = "";
  for (const k of userKeys) {
    if (vfs[k] !== undefined && typeof vfs[k] === "string" && vfs[k].trim().length > 0 && vfs[k].trim() !== rootMemory) {
      userMemory = vfs[k].trim();
      break;
    }
  }

  if (rootMemory && userMemory) {
    return `${rootMemory}\n\n[USER GLOBAL GUIDELINES (~/.claude/CLAUDE.md)]:\n${userMemory}`;
  }

  return rootMemory || userMemory || null;
}

