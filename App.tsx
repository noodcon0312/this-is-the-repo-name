/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { TerminalUI } from "./components/TerminalUI";
import { SettingsModal } from "./components/SettingsModal";
import { Settings, PermissionMode, VFS } from "./types";
import { FileExplorer } from "./components/FileExplorer";
import { PreviewPanel } from "./components/PreviewPanel";

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKey: "",
    model: "gemini-3.6-flash",
    max_tokens: 4096,
    systemInstruction: `Agentic assistant. Reply in user's language. Use tools when needed.`,
  });

  const [permissionMode, setPermissionMode] = useState<PermissionMode>("default");

  useEffect(() => {
    const handleUnload = () => {
      setPermissionMode("default");
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);
  const [vfs, setVfsState] = useState<VFS>(() => {
    const savedVfs = localStorage.getItem("code-agent-vfs");
    if (savedVfs) {
      try { return JSON.parse(savedVfs); } catch (e) {}
    }
    return {
      "README.md": "# Code Agent Studio\n\nWelcome to your new virtual workspace.",
      "src/index.js": "console.log('Hello World');",
    };
  });

  const [vfsHistory, setVfsHistory] = useState<VFS[]>([]);
  const [vfsRedoHistory, setVfsRedoHistory] = useState<VFS[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("code-agent-vfs", JSON.stringify(vfs));
  }, [vfs]);

  const setVfs = (action: React.SetStateAction<VFS>) => {
    setVfsState(prev => {
      const next = typeof action === "function" ? action(prev) : action;
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        setVfsHistory(h => [...h, prev]);
        setVfsRedoHistory([]);
      }
      return next;
    });
  };

  const handleUndo = () => {
    if (vfsHistory.length === 0) return;
    const previous = vfsHistory[vfsHistory.length - 1];
    setVfsHistory(h => h.slice(0, h.length - 1));
    setVfsRedoHistory(r => [...r, vfs]);
    setVfsState(previous);
  };

  const handleRedo = () => {
    if (vfsRedoHistory.length === 0) return;
    const next = vfsRedoHistory[vfsRedoHistory.length - 1];
    setVfsRedoHistory(r => r.slice(0, r.length - 1));
    setVfsHistory(h => [...h, vfs]);
    setVfsState(next);
  };

  const handleSaveFileContent = (path: string, newContent: string) => {
    setVfs(prev => ({ ...prev, [path]: newContent }));
  };

  useEffect(() => {
    const saved = localStorage.getItem("code-agent-settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
        setIsSettingsOpen(false);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem("code-agent-settings", JSON.stringify(newSettings));
    setIsSettingsOpen(false);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [vfsHistory, vfsRedoHistory, vfs]);

  const [isFilesOpen, setIsFilesOpen] = useState(false);
  const [filesWidth, setFilesWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = Math.min(600, Math.max(180, e.clientX));
        setFilesWidth(newWidth);
        return;
      }
      // Trigger open if hovering near left edge (<= 16px)
      if (e.clientX <= 16) {
        setIsFilesOpen(true);
        return;
      }
      // Auto close if sidebar is open, no context menu or modal is active, and mouse moves past threshold
      if (isFilesOpen && !isMenuOpen && e.clientX > filesWidth * 1.25) {
        setIsFilesOpen(false);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isFilesOpen, isResizing, filesWidth, isMenuOpen]);

  return (
    <div className="relative flex h-screen bg-[#0d0d0d] text-[#e5e5e5] font-mono overflow-hidden select-none">
      {/* Edge Hover Trigger Handle */}
      <div 
        onMouseEnter={() => setIsFilesOpen(true)}
        className="fixed left-0 top-0 bottom-0 w-3 z-40 cursor-pointer group flex items-center justify-center hover:bg-[#D97757]/20 transition-colors"
        title="Hover to view FILES"
      >
        <div className="w-1 h-8 bg-[#333333] group-hover:bg-[#D97757] transition-colors" />
      </div>

      {/* Sliding Collapsible File Explorer with Resizable Handle */}
      <div 
        style={{ width: `${filesWidth}px` }}
        className={`fixed left-0 top-0 bottom-0 z-30 transition-transform ${
          isResizing ? "transition-none select-none" : "duration-300 ease-in-out"
        } shadow-2xl flex ${
          isFilesOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        onMouseEnter={() => setIsFilesOpen(true)}
      >
        <div className="flex-1 h-full min-w-0 overflow-hidden">
          <FileExplorer 
            vfs={vfs} 
            setVfs={setVfs}
            onSelectFile={setSelectedFile} 
            selectedFile={selectedFile}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={vfsHistory.length > 0}
            canRedo={vfsRedoHistory.length > 0}
            isOpen={isFilesOpen}
            onMenuStateChange={setIsMenuOpen}
          />
        </div>

        {/* Resizable Drag Handle on Right Border */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          className="w-2 h-full bg-[#1c1c1c] hover:bg-[#D97757] cursor-col-resize flex-shrink-0 transition-colors group relative flex items-center justify-center"
          title="Drag to resize FILES sidebar"
        >
          <div className="w-0.5 h-6 bg-[#444444] group-hover:bg-white transition-colors" />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 border-x border-[#222222]">
        <TerminalUI
          settings={settings}
          onOpenSettings={() => setIsSettingsOpen(true)}
          permissionMode={permissionMode}
          onPermissionChange={setPermissionMode}
          vfs={vfs}
          setVfs={setVfs}
          onFileChanged={setSelectedFile}
          onUpdateSettings={(newPartial) => {
            const updated = { ...settings, ...newPartial };
            setSettings(updated);
            localStorage.setItem("code-agent-settings", JSON.stringify(updated));
          }}
        />
      </div>

      <PreviewPanel 
        vfs={vfs} 
        selectedFile={selectedFile}
        onClose={() => setSelectedFile(null)}
        onSaveFile={handleSaveFileContent}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        initialSettings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

