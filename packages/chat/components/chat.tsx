/**
 * Chat — the main chat interface.
 *
 * T3.chat-style: dark, minimal, streaming.
 * Model selector shows tier-appropriate options.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Paperclip, Search, Image, GripHorizontal, LogIn, ChevronDown } from "lucide-react";
import { PricingModal } from "./pricing-modal";
import { UsageBadge } from "./usage-badge";
import { getAnonId } from "@/lib/anon";

/** Model availability by tier */
const MODELS = {
  free: [
    { id: "@cf/google/gemma-2-9b-it", name: "Gemma 2 9B", tag: "Free" },
  ],
  pro: [
    { id: "@cf/google/gemma-2-9b-it", name: "Gemma 2 9B", tag: "Free" },
    { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B", tag: "Pro" },
    { id: "@cf/qwen/qwen2.5-72b-instruct", name: "Qwen 2.5 72B", tag: "Pro" },
    { id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", name: "DeepSeek R1 32B", tag: "Pro" },
  ],
  premier: [
    { id: "@cf/google/gemma-2-9b-it", name: "Gemma 2 9B", tag: "Free" },
    { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B", tag: "Pro" },
    { id: "@cf/qwen/qwen2.5-72b-instruct", name: "Qwen 2.5 72B", tag: "Pro" },
    { id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", name: "DeepSeek R1 32B", tag: "Pro" },
  ],
};

/** Determine tier from userId */
function getTier(_userId: string): "free" | "pro" | "premier" {
  // TODO: fetch from agent after auth is wired
  // For now: anon users = free, "user_" prefix = check subscription
  if (_userId.startsWith("user_")) return "pro";
  return "free";
}

interface ChatProps {
  agentId: string;
  onToggleSidebar: () => void;
}

export function Chat({ agentId, onToggleSidebar }: ChatProps) {
  const [showPricing, setShowPricing] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [userId, setUserId] = useState("anon:guest");

  useEffect(() => {
    setUserId(getAnonId());
  }, []);

  const tier = getTier(userId);
  const isAnon = tier === "free";
  const availableModels = MODELS[tier];
  const [model, setModel] = useState(availableModels[0]?.id || "@cf/google/gemma-2-9b-it");

  const selectedModel = availableModels.find((m) => m.id === model) || availableModels[0];

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: `${process.env.NEXT_PUBLIC_AGENT_URL || "https://nimbus-agent.moikapy.workers.dev"}/?userId=${encodeURIComponent(userId)}`,
    body: { agentId, model },
    onError: (err) => {
      console.error("Chat error:", err.message);
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error === "limit_reached" || parsed.error === "model_not_allowed") {
          if (parsed.showAuthPrompt) setShowAuthPrompt(true);
          setShowPricing(true);
        }
      } catch {
        // Not JSON, ignore
      }
    },
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-surface-raised transition-colors shrink-0"
          >
            <GripHorizontal className="w-5 h-5 text-text-muted" />
          </button>

          {/* Model Selector */}
          <div className="relative min-w-0">
            <button
              onClick={() => tier !== "free" && setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors min-w-0"
            >
              <span className="font-medium truncate max-w-[80px] sm:max-w-[140px] md:max-w-[200px]">{selectedModel?.name || "Model"}</span>
              {tier !== "free" && <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
            </button>

            {showModelDropdown && tier !== "free" && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                {availableModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setModel(m.id);
                      setShowModelDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-raised transition-colors ${
                      m.id === model ? "text-accent" : "text-text"
                    }`}
                  >
                    <span>{m.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      m.tag === "Free" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"
                    }`}>
                      {m.tag}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isAnon && (
            <button
              onClick={() => setShowPricing(true)}
              className="flex items-center gap-1.5 text-xs text-accent bg-accent-ghost px-2 py-1 sm:px-2.5 rounded-full hover:bg-accent hover:text-white transition-colors font-medium shrink-0"
            >
              <LogIn className="w-3 h-3" /> <span className="hidden sm:inline">Sign in</span>
            </button>
          )}
          <div className="hidden sm:block"><UsageBadge tier={tier} /></div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 pb-2 sm:pb-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-2">
              <h1 className="text-xl sm:text-2xl font-medium tracking-tight mb-2">Nimbus</h1>
              <p className="text-text-muted text-xs sm:text-sm px-2">Ask your agent anything. No account needed.</p>
              <p className="text-text-faint text-[10px] sm:text-xs mt-2">
                Current model: <span className="text-accent">{selectedModel?.name}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 pt-2 sm:pt-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent text-white ml-auto"
                      : "bg-surface-raised text-text"
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans break-words">{
                    // @ts-ignore
                    msg.parts?.map((p: any) => p.type === "text" ? p.text : "").join("") || msg.content || ""
                  }</pre>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-surface-raised rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    {<span className="w-2 h-2 rounded-full bg-text-muted animate-bounce" />}
                    {<span className="w-2 h-2 rounded-full bg-text-muted animate-bounce [animation-delay:0.1s]" />}
                    {<span className="w-2 h-2 rounded-full bg-text-muted animate-bounce [animation-delay:0.2s]" />}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 sm:p-4 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative bg-surface border border-border rounded-2xl focus-within:border-text-muted hover:border-text-muted/50">
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={messages.length === 0 ? "Ask anything..." : "Continue..."}
              rows={1}
              className="w-full bg-transparent px-3 sm:px-4 pt-2 sm:pt-3 pb-9 sm:pb-10 text-sm resize-none outline-none placeholder:text-text-faint text-text font-sans"
            />

            <div className="absolute bottom-1.5 sm:bottom-2 left-2 right-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowPricing(true)}
                  className="p-1 sm:p-1.5 rounded-lg hover:bg-surface-raised text-text-muted hover:text-text transition-colors"
                  title="Attach file (Pro)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPricing(true)}
                  className="p-1 sm:p-1.5 rounded-lg hover:bg-surface-raised text-text-muted hover:text-text transition-colors"
                  title="Web search (Pro)"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPricing(true)}
                  className="p-1 sm:p-1.5 rounded-lg hover:bg-surface-raised text-text-muted hover:text-text transition-colors"
                  title="Generate image (Pro)"
                >
                  <Image className="w-4 h-4" />
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading || !(input ?? "").trim()}
                className="p-1 sm:p-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:hover:bg-accent text-white transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-text-faint mt-1 hidden sm:block">
            Press Enter to send · Shift+Enter for new line
          </p>
          <p className="text-center text-[10px] text-text-faint mt-1 sm:hidden">
            Enter to send · Shift+Enter for newline
          </p>
        </form>
      </div>

      {showPricing && (
        <PricingModal
          onClose={() => {
            setShowPricing(false);
            setShowAuthPrompt(false);
          }}
          currentTier={tier}
          showAuth={showAuthPrompt}
        />
      )}
    </div>
  );
}
