import React from "react";
import { SessionEntry } from "../types";

interface ResumeCompactionPromptProps {
  isOpen: boolean;
  session: SessionEntry | null;
  onCompactNow: () => void;
  onKeepHistory: () => void;
  onNeverAskAgain: () => void;
  onCancel: () => void;
}

export function ResumeCompactionPrompt({
  isOpen,
  session,
  onCompactNow,
  onKeepHistory,
  onNeverAskAgain,
  onCancel,
}: ResumeCompactionPromptProps) {
  if (!isOpen || !session) return null;

  const tokenEst = session.tokens || (session.messages.length * 350);
  const inactiveHours = Math.max(
    1,
    Math.round((Date.now() - (session.lastActiveAt || session.timestamp)) / (3600 * 1000))
  );

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 font-mono text-xs select-text animate-fadeIn">
      <div className="bg-[#111111] border border-[#2e2e2e] p-5 w-full max-w-lg text-[#e5e5e5] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#222222] pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#D97757] rounded-none inline-block"></span>
            <span className="font-bold text-xs text-[#D97757]">SESSION RESUME NOTICE</span>
          </div>
          <button
            onClick={onCancel}
            className="text-[#777777] hover:text-[#e5e5e5] text-base leading-none"
          >
            &times;
          </button>
        </div>

        <div className="space-y-3 mb-5 leading-relaxed text-[#cccccc]">
          <div className="text-xs">
            Session <strong className="text-white">"{session.name}"</strong> was inactive for ~
            <strong className="text-white">{inactiveHours} hours</strong> with context (~
            <strong className="text-[#D97757]">{tokenEst.toLocaleString()} tokens</strong> across {session.messages.length} messages).
          </div>
          <div className="p-2.5 bg-[#161616] border border-[#262626] text-[11px] text-[#888888]">
            Resuming large inactive sessions without summarization may increase per-turn latency and token consumption. How would you like to proceed?
          </div>
        </div>

        {/* 3 Decision Options */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={onCompactNow}
            className="w-full text-left p-2.5 bg-[#1e1710] hover:bg-[#2e2115] border border-[#D97757] text-white flex items-center justify-between transition-colors group cursor-pointer"
          >
            <div>
              <div className="font-bold text-[#D97757] group-hover:underline">
                1. Summarize Now (/compact)
              </div>
              <div className="text-[11px] text-[#888888]">
                Condense older turns to save context tokens while preserving key code context.
              </div>
            </div>
            <span className="text-xs text-[#D97757] font-bold">[Enter]</span>
          </button>

          <button
            type="button"
            onClick={onKeepHistory}
            className="w-full text-left p-2.5 bg-[#161616] hover:bg-[#202020] border border-[#2e2e2e] hover:border-[#444444] text-[#cccccc] flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="font-bold text-white">2. Keep Full History</div>
              <div className="text-[11px] text-[#777777]">
                Restore all conversation turns exactly as they were.
              </div>
            </div>
            <span className="text-xs text-[#888888]">[K]</span>
          </button>

          <button
            type="button"
            onClick={onNeverAskAgain}
            className="w-full text-left p-2.5 bg-[#161616] hover:bg-[#202020] border border-[#2e2e2e] hover:border-[#444444] text-[#888888] hover:text-[#cccccc] flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="font-semibold">3. Don't Ask Again</div>
              <div className="text-[11px] text-[#666666]">
                Always resume directly without prompting for auto-compaction.
              </div>
            </div>
            <span className="text-xs text-[#666666]">[D]</span>
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-[#222222] flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-xs text-[#888888] hover:text-[#cccccc] border border-transparent hover:border-[#333333]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
