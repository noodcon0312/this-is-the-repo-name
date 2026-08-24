import React, { useState, useEffect, useRef, useMemo } from "react";
import { SessionEntry } from "../types";
import { resolveUniqueSessionName } from "../utils/sessionManager";
import { formatDateTime } from "../utils/dateFormat";

interface SessionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionEntry[];
  currentSessionId: string;
  currentProject?: string;
  currentWorktree?: string;
  currentBranch?: string;
  configDir?: string;
  projectDirName?: string;
  onResumeSession: (session: SessionEntry) => void;
  onRenameSession: (sessionId: string, newName: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onNewSession?: () => void;
}

export function SessionPickerModal({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onResumeSession,
  onRenameSession,
  onDeleteSession,
}: SessionPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editNameInput, setEditNameInput] = useState("");
  const [sessionToDelete, setSessionToDelete] = useState<SessionEntry | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Filter sessions by query
  const filteredList = useMemo(() => {
    let list = sessions.filter(s => s && s.messages && s.messages.length > 0);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(s => {
        if (s.name.toLowerCase().includes(q)) return true;
        if (s.id.toLowerCase().includes(q)) return true;
        if (s.prNumber && s.prNumber.toLowerCase().includes(q)) return true;
        return s.messages.some(m => m.content && m.content.toLowerCase().includes(q));
      });
    }
    return list.sort((a, b) => (b.lastActiveAt || b.timestamp) - (a.lastActiveAt || a.timestamp));
  }, [sessions, searchQuery]);

  // Adjust selection bounds
  useEffect(() => {
    if (filteredList.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= filteredList.length) {
      setSelectedIndex(filteredList.length - 1);
    }
  }, [filteredList.length, selectedIndex]);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setEditingSessionId(null);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Focus rename input
  useEffect(() => {
    if (editingSessionId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingSessionId]);

  const selectedSession = filteredList[selectedIndex] || null;

  const handleStartRename = (session: SessionEntry) => {
    setEditingSessionId(session.id);
    setEditNameInput(session.name);
  };

  const handleSaveRename = (session: SessionEntry) => {
    if (editNameInput.trim()) {
      const resolved = resolveUniqueSessionName(
        editNameInput,
        sessions,
        session.id
      );
      onRenameSession(session.id, resolved);
    }
    setEditingSessionId(null);
  };

  // Keyboard navigation & hotkeys
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If delete confirmation modal is open
      if (sessionToDelete) {
        if (e.key === "Escape") {
          e.preventDefault();
          setSessionToDelete(null);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (onDeleteSession) onDeleteSession(sessionToDelete.id);
          setSessionToDelete(null);
        }
        return;
      }

      // If currently editing session name
      if (editingSessionId) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (selectedSession) handleSaveRename(selectedSession);
        } else if (e.key === "Escape") {
          e.preventDefault();
          setEditingSessionId(null);
        }
        return;
      }

      // Ctrl + R: Rename selected session
      if ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        if (selectedSession) {
          handleStartRename(selectedSession);
        }
        return;
      }

      // Escape: Close picker
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Arrow Up / Down
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(filteredList.length - 1, prev + 1));
        return;
      }

      // Enter: Select session
      if (e.key === "Enter") {
        e.preventDefault();
        if (selectedSession) {
          onResumeSession(selectedSession);
          onClose();
        }
        return;
      }

      // Delete key: Delete selected session
      if (selectedSession && onDeleteSession) {
        const isDelKey = e.key === "Delete" || e.key === "Del";
        const isCtrlMod = e.ctrlKey || e.metaKey || e.altKey;
        const isNotInSearch = document.activeElement !== searchInputRef.current;

        if (isNotInSearch || isDelKey || (isCtrlMod && (e.key === "Backspace" || e.key === "Delete"))) {
          e.preventDefault();
          setSessionToDelete(selectedSession);
          return;
        }
      }

      // Forward slash '/' to focus search input if not focused
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    editingSessionId,
    selectedSession,
    filteredList,
    selectedIndex,
    editNameInput,
    sessions,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 font-mono text-xs select-text animate-fadeIn">
      <div className="bg-[#111111] border border-[#2e2e2e] w-full max-w-2xl text-[#e5e5e5] flex flex-col h-[75vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-2.5 border-b border-[#222222] bg-[#141414]">
          <div className="flex items-center gap-2">
            <span className="text-[#ffffff] font-semibold text-xs">SESSION PICKER</span>
            <span className="text-[10px] text-[#888888] bg-[#1a1a1a] px-1.5 py-0.2 border border-[#2a2a2a]">
              {filteredList.length} {filteredList.length === 1 ? "session" : "sessions"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#777777] hover:text-[#e5e5e5] text-base leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-[#222222] bg-[#121212]">
          <div className="flex items-center bg-[#161616] border border-[#2a2a2a] focus-within:border-[#D97757] px-2.5 py-1.5">
            <span className="text-[#D97757] font-bold mr-2 select-none">&gt;</span>
            <input
              ref={searchInputRef}
              type="text"
              className="w-full bg-transparent border-none outline-none text-[#e5e5e5] placeholder-[#555555] font-mono text-xs"
              placeholder="Search sessions by title, PR #, or keywords... (Press / to focus)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-[#666666] hover:text-[#e5e5e5] text-xs px-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Sessions List */}
        <div
          ref={listContainerRef}
          className="flex-1 overflow-y-auto p-2 space-y-1"
        >
          {filteredList.length === 0 ? (
            <div className="p-8 text-center text-[#666666] italic">
              No matching sessions found.
            </div>
          ) : (
            filteredList.map((session, idx) => {
              const isSelected = idx === selectedIndex;
              const isCurrent = session.id === currentSessionId;
              const isEditing = editingSessionId === session.id;
              const dateFormatted = formatDateTime(session.lastActiveAt || session.timestamp);
              const tokenEst = session.tokens || (session.messages.length * 350);

              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedIndex(idx)}
                  onDoubleClick={() => {
                    onResumeSession(session);
                    onClose();
                  }}
                  title={session.id}
                  className={`p-2 border transition-colors cursor-pointer select-none ${
                    isSelected
                      ? "bg-[#1f1a16] border-[#D97757] text-[#ffffff]"
                      : "bg-[#141414] border-[#1e1e1e] text-[#cccccc] hover:bg-[#181818] hover:border-[#2a2a2a]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`text-xs ${
                          isSelected ? "text-[#D97757] font-bold" : "text-[#444444]"
                        }`}
                      >
                        {isSelected ? ">" : " "}
                      </span>

                      {isEditing ? (
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={editNameInput}
                          onChange={(e) => setEditNameInput(e.target.value)}
                          onBlur={() => handleSaveRename(session)}
                          className="bg-[#0e0e0e] border border-[#D97757] px-1.5 py-0.5 text-xs text-white font-mono outline-none w-full"
                        />
                      ) : (
                        <div className="font-medium text-xs truncate flex items-center gap-1.5">
                          <span className="truncate">{session.name}</span>
                          {session.parentSessionId && (
                            <span className="text-[9px] px-1 py-0.2 bg-[#222222] text-[#888888] border border-[#333333] font-normal">
                              fork
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-[#D97757]/20 text-[#D97757] border border-[#D97757]/40 font-semibold">
                              active
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[11px] text-[#666666]">
                      {session.prNumber && (
                        <span className="text-[10px] px-1 py-0.2 border border-[#38bdf8]/40 text-[#38bdf8]">
                          PR {session.prNumber}
                        </span>
                      )}
                      <span>{session.messages.length} msgs</span>
                      <span>·</span>
                      <span>~{tokenEst.toLocaleString()} tok</span>
                      <span>·</span>
                      <span className="text-[#888888]">{dateFormatted}</span>
                      {onDeleteSession && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToDelete(session);
                          }}
                          className="px-1 py-0.5 text-[#666666] hover:text-[#D97757] transition-colors font-mono text-[10px]"
                          title="Delete session"
                        >
                          [x]
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer / Terminal Status Bar */}
        <div className="px-4 py-2 border-t border-[#222222] bg-[#141414] flex items-center justify-between text-[11px] text-[#777777]">
          <div className="flex items-center gap-3">
            <span><strong className="text-[#cccccc]">↑↓</strong> Navigate</span>
            <span><strong className="text-[#cccccc]">Enter</strong> Resume</span>
            <span><strong className="text-[#cccccc]">Ctrl+R</strong> Rename</span>
            <span><strong className="text-[#cccccc]">Del</strong> Delete (when selected)</span>
            <span><strong className="text-[#cccccc]">/</strong> Search</span>
            <span><strong className="text-[#cccccc]">Esc</strong> Close</span>
          </div>
        </div>
      </div>

      {/* Custom Terminal Confirm Delete Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4 font-mono text-xs select-text">
          <div className="bg-[#111111] border border-[#D97757] p-5 w-full max-w-sm text-[#e5e5e5] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-[#222222] pb-2.5 mb-3">
              <span className="w-2 h-2 bg-[#D97757] inline-block"></span>
              <span className="font-bold text-xs text-[#D97757]">CONFIRM DELETE SESSION</span>
            </div>
            <div className="text-[#cccccc] mb-5 text-xs leading-relaxed">
              Are you sure you want to delete session <strong className="text-white">"{sessionToDelete.name}"</strong>?
              This action cannot be undone.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-3 py-1 bg-[#181818] border border-[#333333] hover:border-[#555555] text-[#aaaaaa] hover:text-white transition-colors cursor-pointer text-xs"
              >
                Cancel [Esc]
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteSession) onDeleteSession(sessionToDelete.id);
                  setSessionToDelete(null);
                }}
                className="px-3 py-1 bg-[#D97757] text-white font-bold hover:bg-[#c66546] transition-colors cursor-pointer text-xs"
              >
                Delete [Enter]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
