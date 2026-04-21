/**
 * Chat — the main chat interface.
 *
 * T3.chat-style: dark, minimal, streaming. Handles both anonymous
 * (free tier) and authenticated (paid tier) usage.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Paperclip, Search, Image, GripHorizontal, LogIn } from "lucide-react";
import { PricingModal } from "./pricing-modal";
import { UsageBadge } from "./usage-badge";
import { getAnonId } from "@/lib/anon";
import type { Tier } from "@/lib/tier-gate";

interface ChatProps {
  agentId: string;
  onToggleSidebar: () => void;
}

export function Chat({ agentId, onToggleSidebar }: ChatProps) {
  const [showPricing, setShowPricing] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [model, setModel] = useState("@cf/zai-org/glm-4.7-flash");

  const userId = getAnonId(); // anonymous until sign-in
  const isAnon = !userId.startsWith("user_"); // Clerk IDs start with user_

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
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-surface-raised transition-colors"
          >
            <GripHorizontal className="w-5 h-5 text-text-muted" />
          </button>

          <button
            onClick={() => setShowPricing(true)}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
          >
            {model.split("/").pop()}
            <span className="text-accent text-xs font-medium ml-1">Pro</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {isAnon && (
            <button
              onClick={() => setShowPricing(true)}
              className="flex items-center gap-1.5 text-xs text-accent bg-accent-ghost px-2.5 py-1 rounded-full hover:bg-accent hover:text-white transition-colors font-medium"
            >
              <LogIn className="w-3 h-3" /> Sign in
            </button>
          )}
          <UsageBadge tier={"free"} />
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h1 className="text-2xl font-medium tracking-tight mb-2">Nimbus</h1>
              <p className="text-text-muted text-sm">Ask your agent anything. No account needed.</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6 pt-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent text-white ml-auto"
                      : "bg-surface-raised text-text"
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
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
      <div className="p-4 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative bg-surface border border-border rounded-2xl focus-within:border-text-muted hover:border-text-muted/50">
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={messages.length === 0 ? "Ask anything..." : "Continue the conversation..."}
              rows={1}
              className="w-full bg-transparent px-4 pt-3 pb-10 text-sm resize-none outline-none placeholder:text-text-faint text-text font-sans"
            />

            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowPricing(true)}
                  className="p-1.5 rounded-lg hover:bg-surface-raised text-text-muted hover:text-text transition-colors"
                  title="Attach file (Pro)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPricing(true)}
                  className="p-1.5 rounded-lg hover:bg-surface-raised text-text-muted hover:text-text transition-colors"
                  title="Web search (Pro)"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPricing(true)}
                  className="p-1.5 rounded-lg hover:bg-surface-raised text-text-muted hover:text-text transition-colors"
                  title="Generate image (Pro)"
                >
                  <Image className="w-4 h-4" />
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:hover:bg-accent text-white transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-text-faint mt-1">
            Press Enter to send · Shift+Enter for new line
          </p>
        </form>
      </div>

      {showPricing && (
        <PricingModal
          onClose={() => {
            setShowPricing(false);
            setShowAuthPrompt(false);
          }}
          currentTier={"free"}
          showAuth={showAuthPrompt}
        />
      )}
    </div>
  );
}
