import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { VFS } from "../types";
import { Upload, Download, Plus, MoreVertical, Edit2, Copy, Move, Trash2, FileText, Search, RotateCcw, RotateCw, FolderUp } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  isBinaryFile,
  getFileMetadata,
  setVfsFileMetadata,
  removeVfsFileMetadata,
  renameVfsFileMetadata,
  dataURLToUint8Array,
  isDataURL
} from "../utils/fileUtils";

interface FileExplorerProps {
  vfs: VFS;
  setVfs: React.Dispatch<React.SetStateAction<VFS>>;
  onSelectFile: (path: string) => void;
  selectedFile: string | null;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isOpen?: boolean;
  onMenuStateChange?: (isOpen: boolean) => void;
}

interface TreeNode {
  name: string;
  path?: string;
  dirPath: string;
  children: TreeNode[];
}

interface TreeRenderItem {
  name: string;
  prefix: string;
  path?: string;
  dirPath: string;
  isDir: boolean;
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", dirPath: "", children: [] };
  
  for (const path of paths) {
    const parts = path.split("/");
    let current = root;
    let accumulatedPath = "";
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      
      let child = current.children.find(c => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: isFile ? path : undefined,
          dirPath: isFile ? current.dirPath : accumulatedPath,
          children: []
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  const sortTree = (node: TreeNode) => {
    node.children.sort((a, b) => {
      const aIsDir = a.path === undefined;
      const bIsDir = b.path === undefined;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortTree);
  };
  sortTree(root);

  return root;
}

function flattenTree(node: TreeNode, collapsedDirs: Set<string>, prefix = ""): TreeRenderItem[] {
  const items: TreeRenderItem[] = [];
  const children = node.children;
  
  children.forEach((child, index) => {
    const isLast = index === children.length - 1;
    const connector = isLast ? "└─ " : "├─ ";
    const childPrefix = isLast ? "   " : "│  ";
    const isDir = child.path === undefined;

    items.push({
      name: child.name,
      prefix: prefix + connector,
      path: child.path,
      dirPath: child.dirPath,
      isDir
    });
    
    if (isDir && !collapsedDirs.has(child.dirPath) && child.children.length > 0) {
      items.push(...flattenTree(child, collapsedDirs, prefix + childPrefix));
    }
  });
  
  return items;
}

function calculateAdjustedMenuPos(clickX: number, clickY: number, menuWidth: number, menuHeight: number) {
  const pad = 8;
  let left = clickX;
  let top = clickY;

  // Horizontal flip check if menu spills past right viewport edge
  if (left + menuWidth > window.innerWidth - pad) {
    left = clickX - menuWidth;
    if (left + menuWidth > window.innerWidth - pad) {
      left = window.innerWidth - menuWidth - pad;
    }
  }

  // Ensure menu never bleeds off left screen edge
  if (left < pad) {
    left = pad;
  }

  // Vertical flip check if menu spills past bottom viewport edge
  if (top + menuHeight > window.innerHeight - pad) {
    top = clickY - menuHeight;
    if (top + menuHeight > window.innerHeight - pad) {
      top = window.innerHeight - menuHeight - pad;
    }
  }

  // Ensure menu never bleeds off top screen edge
  if (top < pad) {
    top = pad;
  }

  return { top, left };
}

const MAX_VFS_BYTES = 6 * 1024 * 1024; // 6MB limit

function calculateVfsBytes(vfs: VFS): number {
  let bytes = 0;
  const encoder = new TextEncoder();
  for (const [path, content] of Object.entries(vfs)) {
    if (path === ".metadata.json") continue;
    if (typeof content === "string") {
      bytes += encoder.encode(content).length;
    }
  }
  return bytes;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FileExplorer({ vfs, setVfs, onSelectFile, selectedFile, onUndo, onRedo, canUndo, canRedo, isOpen, onMenuStateChange }: FileExplorerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const [activeMenuPath, setActiveMenuPath] = useState<string | null>(null);
  const [clickCoords, setClickCoords] = useState<{ x: number; y: number } | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newItemPath, setNewItemPath] = useState("");
  const [activeItemInfo, setActiveItemInfo] = useState<{ path: string; isDir: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastClickedPath, setLastClickedPath] = useState<string | null>(null);

  // Sync selectedPaths when selectedFile changes from outside
  useEffect(() => {
    if (selectedFile) {
      if (!selectedPaths.has(selectedFile)) {
        setSelectedPaths(new Set([selectedFile]));
        setLastClickedPath(selectedFile);
      }
    } else {
      if (selectedPaths.size === 1) {
        setSelectedPaths(new Set());
        setLastClickedPath(null);
      }
    }
  }, [selectedFile]);

  // Escape key listener to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClearSelection = () => {
    setSelectedPaths(new Set());
    setLastClickedPath(null);
    onSelectFile("");
  };

  const resolveAllAffectedFilePaths = (selectedSet: Set<string>): string[] => {
    const affected = new Set<string>();
    const selectedArray = Array.from(selectedSet);
    
    Object.keys(vfs).forEach(key => {
      if (key === ".metadata.json") return;
      
      for (const sel of selectedArray) {
        if (key === sel || key.startsWith(sel + "/")) {
          affected.add(key);
        }
      }
    });
    
    return Array.from(affected);
  };

  const [uploadReport, setUploadReport] = useState<{
    loaded: { path: string; size: number }[];
    skipped: { path: string; size: number; reason: string }[];
    totalBytesUsed: number;
  } | null>(null);

  // Auto-dismiss upload complete report after 4.5 seconds
  useEffect(() => {
    if (uploadReport) {
      const timer = setTimeout(() => {
        setUploadReport(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [uploadReport]);

  // Custom modal dialog states (replaces native window alert/prompt/confirm)
  const [customModal, setCustomModal] = useState<{
    type: "alert" | "prompt" | "confirm";
    title: string;
    message?: string;
    defaultValue?: string;
    onConfirm?: (inputValue?: string) => void;
  } | null>(null);

  // Notify parent component whether a context menu or modal is currently active
  const isMenuOrModalActive = Boolean(activeMenuPath || isNewModalOpen || customModal);
  useEffect(() => {
    if (onMenuStateChange) {
      onMenuStateChange(isMenuOrModalActive);
    }
  }, [isMenuOrModalActive, onMenuStateChange]);

  // Close context menu whenever sidebar is collapsed or closed
  useEffect(() => {
    if (isOpen === false) {
      setActiveMenuPath(null);
    }
  }, [isOpen]);

  const [promptInputValue, setPromptInputValue] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuPath(null);
      }
    };
    const handleCloseMenu = () => {
      setActiveMenuPath(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleCloseMenu, true);
    window.addEventListener("resize", handleCloseMenu);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleCloseMenu, true);
      window.removeEventListener("resize", handleCloseMenu);
    };
  }, []);

  useLayoutEffect(() => {
    if (activeMenuPath && menuRef.current && clickCoords) {
      const rect = menuRef.current.getBoundingClientRect();
      const actualWidth = rect.width || 160;
      const actualHeight = rect.height || 220;
      const adjusted = calculateAdjustedMenuPos(clickCoords.x, clickCoords.y, actualWidth, actualHeight);
      setMenuPos(adjusted);
    }
  }, [activeMenuPath, clickCoords]);

  const rawPaths = Object.keys(vfs).filter(p => p !== ".metadata.json").sort();
  const paths = searchQuery.trim()
    ? rawPaths.filter(p => p.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : rawPaths;

  const treeRoot = buildTree(paths);
  const treeItems = flattenTree(treeRoot, collapsedDirs);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    try {
      const loadedFiles: { path: string; size: number }[] = [];
      const skippedFiles: { path: string; size: number; reason: string }[] = [];
      let nextVfs = { ...vfs };
      let currentBytes = calculateVfsBytes(vfs);
      const filesArray = Array.from(e.dataTransfer.files) as File[];

      for (const file of filesArray) {
        let relPath = file.name;
        relPath = relPath.replace(/^\/+/, "");

        try {
          const isBinary = isBinaryFile(file.name, file.type);
          let fileContent = "";
          let fileSize = 0;

          if (isBinary) {
            fileContent = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            });
            fileSize = fileContent.length;
          } else {
            fileContent = await file.text();
            fileSize = new TextEncoder().encode(fileContent).length;
          }

          const existingOldSize = vfs[relPath] ? new TextEncoder().encode(vfs[relPath]).length : 0;
          const netAddition = fileSize - existingOldSize;

          if (currentBytes + netAddition <= MAX_VFS_BYTES) {
            nextVfs[relPath] = fileContent;
            nextVfs = setVfsFileMetadata(nextVfs, relPath, { type: isBinary ? "binary" : "text" });
            currentBytes += netAddition;
            loadedFiles.push({ path: relPath, size: fileSize });
          } else {
            const isAudioOrVideo = /\.(mp4|webm|mp3|wav|ogg)$/i.test(file.name);
            const label = isAudioOrVideo ? "Video/audio file" : "File";
            skippedFiles.push({
              path: relPath,
              size: fileSize,
              reason: `${label} too large after encoding (${formatBytes(fileSize)}) — remaining storage: ${formatBytes(Math.max(0, MAX_VFS_BYTES - currentBytes))}`
            });
          }
        } catch (fileErr: any) {
          console.error("Error reading dropped file:", relPath, fileErr);
          skippedFiles.push({
            path: relPath,
            size: file.size,
            reason: `Read error: ${fileErr?.message || "Invalid file encoding"}`
          });
        }
      }

      setVfs(nextVfs);

      if (loadedFiles.length > 0 || skippedFiles.length > 0) {
        setUploadReport({
          loaded: loadedFiles,
          skipped: skippedFiles,
          totalBytesUsed: currentBytes,
        });
      }
    } catch (err) {
      console.error("Fatal drop handler error:", err);
    }
  };

  const toggleFolder = (dirPath: string) => {
    setCollapsedDirs(prev => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    const rawPath = newItemPath.trim();
    if (!rawPath) return;

    const isFolder = rawPath.endsWith("/") || !rawPath.includes(".");
    const targetPath = isFolder ? rawPath.replace(/\/+$/, "") : rawPath;

    if (vfs[targetPath] !== undefined || (isFolder && vfs[`${targetPath}/.gitkeep`] !== undefined)) {
      setCustomModal({
        type: "alert",
        title: "Error",
        message: `File or path '${targetPath}' already exists.`,
      });
      return;
    }

    if (isFolder) {
      setVfs(prev => ({ ...prev, [`${targetPath}/.gitkeep`]: "" }));
      // Folder creation: do NOT open in preview panel
    } else {
      setVfs(prev => ({ ...prev, [targetPath]: "" }));
      onSelectFile(targetPath);
    }

    setNewItemPath("");
    setIsNewModalOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    try {
      const loadedFiles: { path: string; size: number }[] = [];
      const skippedFiles: { path: string; size: number; reason: string }[] = [];
      let nextVfs = { ...vfs };
      let currentBytes = calculateVfsBytes(vfs);
      const filesArray = Array.from(fileList) as (File & { webkitRelativePath?: string })[];

      for (const file of filesArray) {
        let relPath = file.webkitRelativePath || file.name;
        relPath = relPath.replace(/^\/+/, "");

        try {
          const isBinary = isBinaryFile(file.name, file.type);
          let fileContent = "";
          let fileSize = 0;

          if (isBinary) {
            fileContent = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            });
            fileSize = fileContent.length;
          } else {
            fileContent = await file.text();
            fileSize = new TextEncoder().encode(fileContent).length;
          }

          const existingOldSize = vfs[relPath] ? new TextEncoder().encode(vfs[relPath]).length : 0;
          const netAddition = fileSize - existingOldSize;

          if (currentBytes + netAddition <= MAX_VFS_BYTES) {
            nextVfs[relPath] = fileContent;
            nextVfs = setVfsFileMetadata(nextVfs, relPath, { type: isBinary ? "binary" : "text" });
            currentBytes += netAddition;
            loadedFiles.push({ path: relPath, size: fileSize });
          } else {
            const isAudioOrVideo = /\.(mp4|webm|mp3|wav|ogg)$/i.test(file.name);
            const label = isAudioOrVideo ? "Video/audio file" : "File";
            skippedFiles.push({
              path: relPath,
              size: fileSize,
              reason: `${label} too large after encoding (${formatBytes(fileSize)}) — remaining storage: ${formatBytes(Math.max(0, MAX_VFS_BYTES - currentBytes))}`
            });
          }
        } catch (fileErr: any) {
          console.error("Error reading file:", relPath, fileErr);
          skippedFiles.push({
            path: relPath,
            size: file.size,
            reason: `Read error: ${fileErr?.message || "Invalid file encoding"}`
          });
        }
      }

      setVfs(nextVfs);

      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";

      if (loadedFiles.length > 0 || skippedFiles.length > 0) {
        setUploadReport({
          loaded: loadedFiles,
          skipped: skippedFiles,
          totalBytesUsed: currentBytes,
        });
      }
    } catch (err) {
      console.error("Fatal upload handler error:", err);
    }
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    Object.entries(vfs).forEach(([path, content]) => {
      if (path === ".metadata.json") return; // skip internal metadata file
      const isBinary = getFileMetadata(vfs, path).type === "binary";
      if (isBinary && isDataURL(content)) {
        const bytes = dataURLToUint8Array(content);
        zip.file(path, bytes);
      } else {
        zip.file(path, content);
      }
    });
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "workspace.zip");
  };

  const openMenu = (e: React.MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault();
    e.stopPropagation();

    let clickX = e.clientX;
    let clickY = e.clientY;

    if (!clickX && !clickY && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      clickX = rect.left + 10;
      clickY = rect.bottom + 2;
    }

    if (!selectedPaths.has(path)) {
      setSelectedPaths(new Set([path]));
      setLastClickedPath(path);
      if (!isDir) {
        onSelectFile(path);
      }
    }

    const initialPos = calculateAdjustedMenuPos(clickX, clickY, 160, 220);

    setClickCoords({ x: clickX, y: clickY });
    setMenuPos(initialPos);
    setActiveMenuPath(path);
    setActiveItemInfo({ path, isDir });
  };

  const handleItemClick = (e: React.MouseEvent, itemKey: string, isDir: boolean, itemPath?: string) => {
    e.stopPropagation();

    if (e.shiftKey) {
      e.preventDefault();
      // Shift + click range select
      const keys = treeItems.map(it => it.isDir ? it.dirPath : it.path!);
      const anchorIdx = lastClickedPath ? keys.indexOf(lastClickedPath) : -1;
      const currentIdx = keys.indexOf(itemKey);

      if (anchorIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(anchorIdx, currentIdx);
        const end = Math.max(anchorIdx, currentIdx);
        const newSelected = new Set<string>();
        for (let i = start; i <= end; i++) {
          newSelected.add(keys[i]);
        }
        setSelectedPaths(newSelected);
        
        if (!isDir && itemPath) {
          onSelectFile(itemPath);
        }
      } else {
        setSelectedPaths(new Set([itemKey]));
        setLastClickedPath(itemKey);
        if (isDir) {
          toggleFolder(itemKey);
        } else if (itemPath) {
          onSelectFile(itemPath);
        }
      }
    } else if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      // Ctrl/Cmd + click toggle select
      let isPathAdded = false;
      setSelectedPaths(prev => {
        const next = new Set(prev);
        if (next.has(itemKey)) {
          next.delete(itemKey);
        } else {
          next.add(itemKey);
          isPathAdded = true;
        }
        return next;
      });
      setLastClickedPath(itemKey);
      
      if (isPathAdded && !isDir && itemPath) {
        onSelectFile(itemPath);
      }
    } else {
      // Normal click
      setSelectedPaths(new Set([itemKey]));
      setLastClickedPath(itemKey);
      if (isDir) {
        toggleFolder(itemKey);
      } else if (itemPath) {
        onSelectFile(itemPath);
      }
    }
  };

  const handleMoveMultiple = () => {
    setActiveMenuPath(null);
    setPromptInputValue("");
    setCustomModal({
      type: "prompt",
      title: "Move Multiple Items",
      message: `Enter destination parent folder/directory path to move the ${selectedPaths.size} selected items:`,
      defaultValue: "",
      onConfirm: (destinationFolder) => {
        if (!destinationFolder) return;
        const dest = destinationFolder.trim().replace(/\/+$/, "");
        
        setVfs(prev => {
          let next = { ...prev };
          
          selectedPaths.forEach(selPath => {
            const baseName = selPath.split("/").pop() || "";
            if (!baseName) return;
            
            const newPathBase = dest ? `${dest}/${baseName}` : baseName;
            
            Object.keys(prev).forEach(key => {
              if (key === ".metadata.json") return;
              
              if (key === selPath) {
                next[newPathBase] = prev[key];
                delete next[key];
                next = renameVfsFileMetadata(next, key, newPathBase);
              } else if (key.startsWith(selPath + "/")) {
                const relativePart = key.slice(selPath.length + 1);
                const targetKey = `${newPathBase}/${relativePart}`;
                next[targetKey] = prev[key];
                delete next[key];
                next = renameVfsFileMetadata(next, key, targetKey);
              }
            });
          });
          
          return next;
        });
        
        setSelectedPaths(new Set());
        setLastClickedPath(null);
      }
    });
  };

  const handleDownloadMultiple = async () => {
    setActiveMenuPath(null);
    const zip = new JSZip();
    const affectedFiles = resolveAllAffectedFilePaths(selectedPaths);
    
    if (affectedFiles.length === 0) {
      setCustomModal({
        type: "alert",
        title: "Download Items",
        message: "No files found inside the selected items.",
      });
      return;
    }
    
    affectedFiles.forEach(filePath => {
      const content = vfs[filePath] || "";
      const isBinary = getFileMetadata(vfs, filePath).type === "binary";
      if (isBinary && isDataURL(content)) {
        const bytes = dataURLToUint8Array(content);
        zip.file(filePath, bytes);
      } else {
        zip.file(filePath, content);
      }
    });
    
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "selected_files.zip");
  };

  const handleDeleteMultiple = () => {
    setActiveMenuPath(null);
    const affectedFiles = resolveAllAffectedFilePaths(selectedPaths);
    
    setCustomModal({
      type: "confirm",
      title: "Delete Multiple Items",
      message: `Are you sure you want to permanently delete the ${selectedPaths.size} selected items (${affectedFiles.length} files)? This action cannot be undone.`,
      onConfirm: () => {
        setVfs(prev => {
          let next = { ...prev };
          affectedFiles.forEach(filePath => {
            delete next[filePath];
            next = removeVfsFileMetadata(next, filePath);
          });
          return next;
        });
        
        if (selectedFile && affectedFiles.includes(selectedFile)) {
          onSelectFile("");
        }
        
        setSelectedPaths(new Set());
        setLastClickedPath(null);
      }
    });
  };

  const handleEditFile = () => {
    if (!activeItemInfo || activeItemInfo.isDir) return;
    onSelectFile(activeItemInfo.path);
    setActiveMenuPath(null);
  };

  const handleRename = () => {
    if (!activeItemInfo) return;
    const { path, isDir } = activeItemInfo;
    setActiveMenuPath(null);

    setPromptInputValue(path);
    setCustomModal({
      type: "prompt",
      title: `Rename ${isDir ? "Folder" : "File"}`,
      message: `Enter new path for ${path}:`,
      defaultValue: path,
      onConfirm: (newPath) => {
        if (!newPath || newPath === path) return;
        setVfs(prev => {
          let next = { ...prev };
          if (isDir) {
            const prefix = path + "/";
            Object.keys(prev).forEach(key => {
              if (key.startsWith(prefix)) {
                const rel = key.slice(prefix.length);
                const target = newPath + "/" + rel;
                next[target] = prev[key];
                delete next[key];
                next = renameVfsFileMetadata(next, key, target);
              }
            });
          } else {
            next[newPath] = prev[path];
            delete next[path];
            next = renameVfsFileMetadata(next, path, newPath);
          }
          return next;
        });

        if (selectedFile === path) {
          onSelectFile(newPath);
        }
      }
    });
  };

  const handleMove = () => {
    if (!activeItemInfo) return;
    const { path, isDir } = activeItemInfo;
    setActiveMenuPath(null);

    setPromptInputValue(path);
    setCustomModal({
      type: "prompt",
      title: "Move Item",
      message: `Enter destination path for ${path}:`,
      defaultValue: path,
      onConfirm: (newPath) => {
        if (!newPath || newPath === path) return;
        setVfs(prev => {
          let next = { ...prev };
          if (isDir) {
            const prefix = path + "/";
            Object.keys(prev).forEach(key => {
              if (key.startsWith(prefix)) {
                const rel = key.slice(prefix.length);
                const target = newPath + "/" + rel;
                next[target] = prev[key];
                delete next[key];
                next = renameVfsFileMetadata(next, key, target);
              }
            });
          } else {
            next[newPath] = prev[path];
            delete next[path];
            next = renameVfsFileMetadata(next, path, newPath);
          }
          return next;
        });

        if (selectedFile === path) {
          onSelectFile(newPath);
        }
      }
    });
  };

  const handleDelete = () => {
    if (!activeItemInfo) return;
    const { path, isDir } = activeItemInfo;
    setActiveMenuPath(null);

    setCustomModal({
      type: "confirm",
      title: "Delete Item",
      message: `Are you sure you want to delete '${path}'?`,
      onConfirm: () => {
        setVfs(prev => {
          let next = { ...prev };
          if (isDir) {
            const prefix = path + "/";
            Object.keys(prev).forEach(key => {
              if (key.startsWith(prefix) || key === path) {
                delete next[key];
                next = removeVfsFileMetadata(next, key);
              }
            });
          } else {
            delete next[path];
            next = removeVfsFileMetadata(next, path);
          }
          return next;
        });

        if (selectedFile === path) {
          onSelectFile("");
        }
      }
    });
  };

  const handleCopyPath = () => {
    if (!activeItemInfo) return;
    navigator.clipboard.writeText(activeItemInfo.path);
    setActiveMenuPath(null);
  };

  const handleDownloadSingle = async () => {
    if (!activeItemInfo) return;
    const { path, isDir } = activeItemInfo;

    if (!isDir) {
      const content = vfs[path] || "";
      const fileName = path.split("/").pop() || "file";
      const isBinary = getFileMetadata(vfs, path).type === "binary";
      
      let blob: Blob;
      if (isBinary && isDataURL(content)) {
        const bytes = dataURLToUint8Array(content);
        const mimeMatch = content.match(/^data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
        blob = new Blob([bytes], { type: mimeType });
      } else {
        blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      }
      saveAs(blob, fileName);
    } else {
      const zip = new JSZip();
      const prefix = path + "/";
      Object.entries(vfs).forEach(([k, v]) => {
        if (k.startsWith(prefix)) {
          const isBinary = getFileMetadata(vfs, k).type === "binary";
          if (isBinary && isDataURL(v)) {
            const bytes = dataURLToUint8Array(v);
            zip.file(k.slice(prefix.length), bytes);
          } else {
            zip.file(k.slice(prefix.length), v);
          }
        }
      });
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${path.split("/").pop() || "folder"}.zip`);
    }
    setActiveMenuPath(null);
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="w-full h-full bg-[#0d0d0d] border-r border-[#222222] flex flex-col font-mono text-xs select-none relative"
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-[#D97757]/20 border-2 border-dashed border-[#D97757] z-50 flex items-center justify-center text-[#D97757] font-bold text-xs bg-black/80 backdrop-blur-xs">
          Drop files to import
        </div>
      )}

      {/* Workspace Header */}
      <div className="p-2.5 border-b border-[#222222] bg-[#141414] flex justify-between items-center text-[#888888]">
        <div className="font-semibold tracking-wide text-[#e5e5e5] flex items-center gap-1.5">
          <span className="text-[#D97757]">FILES</span>
          <span className="text-[10px] text-[#666666]">({paths.length})</span>
        </div>
        <div className="flex gap-1.5 items-center">
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="hover:text-[#D97757] disabled:opacity-30 transition-colors p-0.5"
              title="Undo file change (Ctrl+Z)"
            >
              <RotateCcw size={13} />
            </button>
          )}
          {onRedo && (
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="hover:text-[#D97757] disabled:opacity-30 transition-colors p-0.5"
              title="Redo file change (Ctrl+Y)"
            >
              <RotateCw size={13} />
            </button>
          )}
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="hover:text-[#D97757] transition-colors p-0.5"
            title="New File/Folder"
          >
            <Plus size={14} />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="hover:text-[#D97757] transition-colors p-0.5"
            title="Upload File(s)"
          >
            <Upload size={13} />
          </button>
          <button 
            onClick={() => folderInputRef.current?.click()}
            className="hover:text-[#D97757] transition-colors p-0.5"
            title="Upload Folder"
          >
            <FolderUp size={13} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            multiple 
          />
          <input 
            type="file" 
            ref={folderInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            multiple 
            // @ts-ignore
            webkitdirectory="true" 
            directory="true"
          />
          <button 
            onClick={handleDownloadAll}
            className="hover:text-[#D97757] transition-colors p-0.5"
            title="Download Workspace Zip"
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* Quick Search Bar */}
      <div className="px-2 py-1.5 border-b border-[#1f1f1f] bg-[#090909] flex items-center gap-1.5">
        <Search size={12} className="text-[#666666]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter files..."
          className="w-full bg-transparent text-[#e5e5e5] placeholder-[#555555] outline-none text-[11px] font-mono"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery("")}
            className="text-[#666666] hover:text-[#e5e5e5] text-[10px]"
          >
            ×
          </button>
        )}
      </div>

      {/* Tree view */}
      <div 
        onClick={handleClearSelection}
        className="flex-1 overflow-y-auto p-2 leading-relaxed"
      >
        {paths.length === 0 ? (
          <div className="text-[#555555] text-center mt-6 italic">empty directory</div>
        ) : (
          <div className="space-y-0.5">
            <div className="text-[#666666] mb-1 font-bold">.</div>
            {treeItems.map((item, idx) => {
              const itemKey = item.isDir ? item.dirPath : item.path!;
              const isSelected = selectedPaths.has(itemKey);

              return (
                <div
                  key={idx}
                  onClick={(e) => handleItemClick(e, itemKey, item.isDir, item.path)}
                  onContextMenu={(e) => openMenu(e, itemKey, item.isDir)}
                  className={`group flex items-center justify-between whitespace-pre cursor-pointer py-0.5 px-1 rounded-none border-l-2 transition-all ${
                    isSelected 
                      ? "bg-[#251713] text-[#D97757] border-[#D97757] font-semibold" 
                      : `border-transparent hover:bg-[#1a1a1a] ${item.isDir ? "text-[#888888]" : "text-[#cccccc]"}`
                  }`}
                >
                  <div className="flex items-center truncate pr-1">
                    <span className="text-[#444444]">{item.prefix}</span>
                    <span className={`truncate ${item.isDir ? "text-[#a0a0a0] font-medium" : ""}`}>
                      {item.name}{item.isDir ? "/" : ""}
                    </span>
                  </div>

                  {/* 3-dots actions trigger */}
                  <div className={`flex items-center opacity-0 group-hover:opacity-100 transition-opacity`}>
                    <button
                      onClick={(e) => openMenu(e, itemKey, item.isDir)}
                      className="p-0.5 text-[#777777] hover:text-[#e5e5e5] hover:bg-[#262626]"
                      title="File options"
                    >
                      <MoreVertical size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline Upload Report Log */}
      {uploadReport && (
        <div className="p-2.5 border-t border-[#222222] bg-[#0c0c0c] border-l-2 border-l-[#D97757] text-xs font-mono text-[#cccccc] shrink-0 select-text flex justify-between items-center">
          <div className="font-bold text-[#e5e5e5] text-[11px] truncate pr-2">
            Upload complete ({formatBytes(uploadReport.loaded.reduce((acc, f) => acc + f.size, 0))})
          </div>
          <button
            onClick={() => setUploadReport(null)}
            className="text-[#777777] hover:text-[#e5e5e5] transition-colors font-bold px-1 text-xs shrink-0 cursor-pointer"
            title="Close upload log"
          >
            [x]
          </button>
        </div>
      )}

      {/* VFS Capacity Storage Bar at Bottom */}
      <div className="p-2.5 border-t border-[#222222] bg-[#141414] text-[10px] font-mono text-[#888888] flex flex-col gap-1.5 shrink-0">
        {(() => {
          const currentBytes = calculateVfsBytes(vfs);
          const ratio = Math.min(1, currentBytes / MAX_VFS_BYTES);
          const percent = Math.round(ratio * 100);
          return (
            <>
              <div className="flex justify-between items-center">
                <span className="text-[#666666] font-semibold tracking-wider">STORAGE CAPACITY</span>
                <span
                  className={`font-mono font-bold ${
                    ratio > 0.9 ? "text-[#f87171]" : ratio > 0.75 ? "text-[#fbbf24]" : "text-[#D97757]"
                  }`}
                  title={`VFS Capacity: ${formatBytes(currentBytes)} of 6.00 MB`}
                >
                  {formatBytes(currentBytes)} / 6.00 MB
                </span>
              </div>
              <div className="w-full bg-[#222222] h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    ratio > 0.9 ? "bg-[#f87171]" : ratio > 0.75 ? "bg-[#fbbf24]" : "bg-[#D97757]"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </>
          );
        })()}
      </div>
      {activeMenuPath && createPortal(
        <div
          ref={menuRef}
          style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
          className="fixed z-[9999] bg-[#161616] border border-[#2e2e2e] shadow-2xl rounded-sm py-1 min-w-[150px] text-xs font-mono select-none"
        >
          {selectedPaths.size >= 2 ? (
            <>
              <button
                onClick={handleMoveMultiple}
                className="w-full text-left px-3 py-1.5 hover:bg-[#262626] text-[#cccccc] hover:text-white flex items-center gap-2 group transition-colors"
              >
                <Move size={12} className="text-[#888888] group-hover:text-white" /> Move
              </button>
              <button
                onClick={handleDownloadMultiple}
                className="w-full text-left px-3 py-1.5 hover:bg-[#262626] text-[#cccccc] hover:text-white flex items-center gap-2 group transition-colors"
              >
                <Download size={12} className="text-[#888888] group-hover:text-white" /> Download
              </button>
              <div className="border-t border-[#262626] my-1"></div>
              <button
                onClick={handleDeleteMultiple}
                className="w-full text-left px-3 py-1.5 hover:bg-red-500/15 text-[#f87171] hover:text-red-300 flex items-center gap-2 transition-colors"
              >
                <Trash2 size={12} className="text-[#f87171]" /> Delete
              </button>
            </>
          ) : (
            <>
              {!activeItemInfo?.isDir && (
                <button
                  onClick={handleEditFile}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#262626] text-[#cccccc] hover:text-white flex items-center gap-2 group transition-colors"
                >
                  <FileText size={12} className="text-[#888888] group-hover:text-[#D97757]" /> Edit file
                </button>
              )}
              <button
                onClick={handleRename}
                className="w-full text-left px-3 py-1.5 hover:bg-[#262626] text-[#cccccc] hover:text-white flex items-center gap-2 group transition-colors"
              >
                <Edit2 size={12} className="text-[#888888] group-hover:text-white" /> Rename
              </button>
              <button
                onClick={handleMove}
                className="w-full text-left px-3 py-1.5 hover:bg-[#262626] text-[#cccccc] hover:text-white flex items-center gap-2 group transition-colors"
              >
                <Move size={12} className="text-[#888888] group-hover:text-white" /> Move
              </button>
              <button
                onClick={handleCopyPath}
                className="w-full text-left px-3 py-1.5 hover:bg-[#262626] text-[#cccccc] hover:text-white flex items-center gap-2 group transition-colors"
              >
                <Copy size={12} className="text-[#888888] group-hover:text-white" /> Copy path
              </button>
              <button
                onClick={handleDownloadSingle}
                className="w-full text-left px-3 py-1.5 hover:bg-[#262626] text-[#cccccc] hover:text-white flex items-center gap-2 group transition-colors"
              >
                <Download size={12} className="text-[#888888] group-hover:text-white" /> Download
              </button>
              <div className="border-t border-[#262626] my-1"></div>
              <button
                onClick={handleDelete}
                className="w-full text-left px-3 py-1.5 hover:bg-red-500/15 text-[#f87171] hover:text-red-300 flex items-center gap-2 transition-colors"
              >
                <Trash2 size={12} className="text-[#f87171]" /> Delete
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* New File Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-[#121212] border border-[#2e2e2e] p-4.5 w-full max-w-sm text-[#e5e5e5] shadow-2xl">
            <div className="text-xs font-bold mb-2.5 text-[#D97757] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#D97757] inline-block shrink-0"></span>
              <span>Create New File / Path</span>
            </div>
            <form onSubmit={handleCreateNewItem} className="space-y-3">
              <div>
                <label className="text-[11px] text-[#888888] block mb-1">Path (e.g. src/app.js)</label>
                <input
                  type="text"
                  value={newItemPath}
                  onChange={(e) => setNewItemPath(e.target.value)}
                  placeholder="src/file.ts"
                  className="w-full bg-[#181818] border border-[#333333] p-1.5 text-xs text-[#e5e5e5] focus:outline-none focus:border-[#D97757] font-mono"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-2.5 py-1 text-[#888888] hover:text-[#e5e5e5] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#D97757] text-white font-semibold hover:bg-[#c66546] cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Modal for Alert / Prompt / Confirm (Delete / Rename etc.) */}
      {customModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 font-mono text-xs">
          <div className="bg-[#121212] border border-[#2e2e2e] p-4.5 w-full max-w-md max-h-[85vh] flex flex-col text-[#e5e5e5] shadow-2xl overflow-y-auto">
            <div className="text-xs font-bold mb-2.5 text-[#D97757] flex items-center gap-2 shrink-0">
              <span className="w-1.5 h-1.5 bg-[#D97757] inline-block shrink-0"></span>
              <span className="break-words">{customModal.title}</span>
            </div>
            {customModal.message && (
              <div className="text-[#cccccc] mb-3.5 leading-relaxed break-all [overflow-wrap:anywhere] select-text">
                {customModal.message}
              </div>
            )}

            {customModal.type === "prompt" && (
              <input
                type="text"
                value={promptInputValue}
                onChange={(e) => setPromptInputValue(e.target.value)}
                className="w-full bg-[#181818] border border-[#333333] p-1.5 text-xs text-[#e5e5e5] focus:outline-none focus:border-[#D97757] font-mono mb-3"
                autoFocus
              />
            )}

            <div className="flex justify-end gap-2 mt-1 shrink-0">
              {customModal.type !== "alert" && (
                <button
                  type="button"
                  onClick={() => setCustomModal(null)}
                  className="px-2.5 py-1 text-[#888888] hover:text-[#e5e5e5] cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const cb = customModal.onConfirm;
                  const val = promptInputValue;
                  setCustomModal(null);
                  if (cb) cb(val);
                }}
                className="px-3 py-1 bg-[#D97757] text-white font-semibold hover:bg-[#c66546] cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
