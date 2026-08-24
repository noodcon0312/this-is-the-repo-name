import React, { useState, useEffect, useRef } from "react";
import { Settings } from "../types";
import { resolveBaseUrlCandidates, getProviderHeaders, testAndDetectProtocol } from "../utils/apiResolver";
import { ChevronDown, Check } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Settings) => void;
  initialSettings: Settings;
}

const API_PROTOCOL_OPTIONS: { value: "auto" | "openai-compatible" | "anthropic" | "custom"; label: string }[] = [
  { value: "auto", label: "Auto Detect" },
  { value: "openai-compatible", label: "OpenAI Compatible" },
  { value: "anthropic", label: "Anthropic Messages" },
  { value: "custom", label: "Custom" },
];

export function SettingsModal({
  isOpen,
  onClose,
  onSave,
  initialSettings,
}: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [showPassword, setShowPassword] = useState(false);
  const [isProtocolOpen, setIsProtocolOpen] = useState(false);
  const protocolDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        protocolDropdownRef.current &&
        !protocolDropdownRef.current.contains(event.target as Node)
      ) {
        setIsProtocolOpen(false);
      }
    };
    if (isProtocolOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProtocolOpen]);

  const handleTestConnection = async () => {
    setTestStatus("testing");
    try {
      const result = await testAndDetectProtocol(settings.baseUrl, settings.apiKey, settings.model);
      
      if (result.success) {
        setTestStatus("success");
      } else {
        setTestStatus("error");
        console.error("Connection test failed:", result.error);
      }
    } catch (err) {
      setTestStatus("error");
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const currentProtocolOption =
    API_PROTOCOL_OPTIONS.find((opt) => opt.value === (settings.apiProtocol || "auto")) ||
    API_PROTOCOL_OPTIONS[0];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-mono text-xs select-text">
      <div className="bg-[#111111] border border-[#2e2e2e] p-5 rounded-none max-w-2xl w-full text-[#e5e5e5] flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4 border-b border-[#222222] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[#D97757] font-bold text-sm">SETTINGS</span>
            <span className="text-[#666666] text-xs">-- Configuration</span>
          </div>
          <button onClick={onClose} className="text-[#777777] hover:text-[#e5e5e5] text-lg leading-none">&times;</button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          <div>
            <label className="block mb-1 text-[#888888] font-semibold">Base URL</label>
            <input
              type="text"
              placeholder="e.g. https://openrouter.ai/api/v1 or https://api.groq.com/openai/v1"
              className="w-full bg-[#181818] border border-[#2e2e2e] p-2 text-[#e5e5e5] font-mono focus:outline-none focus:border-[#D97757]"
              value={settings.baseUrl}
              onChange={(e) =>
                setSettings({ ...settings, baseUrl: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block mb-1 text-[#888888] font-semibold">API Key</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="sk-..."
                className="w-full bg-[#181818] border border-[#2e2e2e] p-2 text-[#e5e5e5] font-mono focus:outline-none focus:border-[#D97757] pr-12"
                value={settings.apiKey}
                onChange={(e) =>
                  setSettings({ ...settings, apiKey: e.target.value })
                }
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#777777] hover:text-[#e5e5e5] text-[11px]"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-[#888888] font-semibold">Model</label>
              <input
                type="text"
                placeholder="e.g. provider/model-name"
                className="w-full bg-[#181818] border border-[#2e2e2e] p-2 text-[#e5e5e5] font-mono focus:outline-none focus:border-[#D97757]"
                value={settings.model}
                onChange={(e) =>
                  setSettings({ ...settings, model: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block mb-1 text-[#888888] font-semibold">Max Tokens</label>
              <input
                type="number"
                min="256"
                max="32768"
                step="256"
                placeholder="4096"
                className="w-full bg-[#181818] border border-[#2e2e2e] p-2 text-[#e5e5e5] font-mono focus:outline-none focus:border-[#D97757]"
                value={settings.max_tokens ?? 4096}
                onChange={(e) =>
                  setSettings({ ...settings, max_tokens: parseInt(e.target.value, 10) || 4096 })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="relative" ref={protocolDropdownRef}>
              <label className="block mb-1 text-[#888888] font-semibold">API Protocol</label>
              <button
                type="button"
                onClick={() => setIsProtocolOpen(!isProtocolOpen)}
                className={`w-full bg-[#181818] border p-2 text-[#e5e5e5] font-mono text-left flex items-center justify-between transition-colors focus:outline-none ${
                  isProtocolOpen ? "border-[#D97757]" : "border-[#2e2e2e] hover:border-[#444444]"
                }`}
              >
                <span>{currentProtocolOption.label}</span>
                <ChevronDown
                  className={`w-4 h-4 text-[#888888] transition-transform duration-150 ${
                    isProtocolOpen ? "rotate-180 text-[#D97757]" : ""
                  }`}
                />
              </button>

              {isProtocolOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#161616] border border-[#2e2e2e] shadow-2xl z-50 py-1 font-mono text-xs">
                  {API_PROTOCOL_OPTIONS.map((opt) => {
                    const isSelected = (settings.apiProtocol || "auto") === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSettings({ ...settings, apiProtocol: opt.value });
                          setIsProtocolOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#241814] text-[#D97757] font-semibold border-l-2 border-[#D97757]"
                            : "text-[#cccccc] hover:bg-[#202020] hover:text-[#ffffff]"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#D97757]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Session Storage & Environment Variables */}
          <div className="border border-[#282828] bg-[#141414] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[#D97757] font-bold text-xs uppercase tracking-wide">
                Virtual Workspace & Session Persistence
              </div>
              <span className="text-[10px] text-[#777777] bg-[#1d1d1d] px-1.5 py-0.5 border border-[#333333]">
                Browser LocalStorage
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-[#888888] font-semibold">
                  Virtual Config Directory
                </label>
                <input
                  type="text"
                  placeholder="~/.claude"
                  className="w-full bg-[#181818] border border-[#2e2e2e] p-2 text-[#e5e5e5] font-mono text-xs focus:outline-none focus:border-[#D97757]"
                  value={settings.claudeConfigDir || "~/.claude"}
                  onChange={(e) =>
                    setSettings({ ...settings, claudeConfigDir: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block mb-1 text-[#888888] font-semibold">
                  Virtual Project Name
                </label>
                <input
                  type="text"
                  placeholder="workspace"
                  className="w-full bg-[#181818] border border-[#2e2e2e] p-2 text-[#e5e5e5] font-mono text-xs focus:outline-none focus:border-[#D97757]"
                  value={settings.claudeProjectDirName || "workspace"}
                  onChange={(e) =>
                    setSettings({ ...settings, claudeProjectDirName: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="skipPromptHistory"
                className="accent-[#D97757]"
                checked={!!settings.skipPromptHistory}
                onChange={(e) =>
                  setSettings({ ...settings, skipPromptHistory: e.target.checked })
                }
              />
              <label htmlFor="skipPromptHistory" className="text-xs text-[#cccccc] cursor-pointer">
                <strong>--no-session-persistence</strong> - Do not save session history to browser storage
              </label>
            </div>
          </div>

          <div>
            <label className="block mb-1 text-[#888888] font-semibold">Custom System Instruction</label>
            <textarea
              placeholder="Leave empty or add custom global directives..."
              className="w-full bg-[#181818] border border-[#2e2e2e] p-2 text-[#e5e5e5] font-mono focus:outline-none focus:border-[#D97757] h-32 leading-relaxed"
              value={settings.systemInstruction}
              onChange={(e) =>
                setSettings({ ...settings, systemInstruction: e.target.value })
              }
            />
            <p className="text-[11px] text-[#666666] mt-1">
              System instructions are dynamically tailored per turn to minimize token consumption.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-between items-center border-t border-[#222222] pt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              className="px-3 py-1.5 border border-[#333333] hover:border-[#D97757] text-[#cccccc] hover:text-white transition-colors cursor-pointer"
            >
              Test Connection
            </button>
            {testStatus === "testing" && <span className="text-yellow-400">Testing...</span>}
            {testStatus === "success" && <span className="text-green-400">OK - Connection Successful</span>}
            {testStatus === "error" && <span className="text-red-400">FAIL - Connection Failed</span>}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 border border-transparent hover:border-[#333333] text-[#888888] hover:text-[#e5e5e5] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(settings)}
              className="px-3 py-1.5 bg-[#D97757] text-white font-semibold hover:bg-[#c66546] transition-colors cursor-pointer"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
