/**
 * ProviderKeySettings — BYOK (Bring Your Own Key)
 *
 * Lets users add their OpenAI, Anthropic, Google, Groq, or DeepSeek
 * API key. When a key is present, those premium models appear in the
 * selector and AI calls route to the user's provider.
 */

"use client";

import { useState } from "react";
import { KeyRound, Trash2, Check, AlertCircle } from "lucide-react";

/** Supported providers */
const PROVIDERS = [
  { id: "openai", name: "OpenAI", placeholder: "sk-...", models: "GPT-4o, GPT-4o Mini" },
  { id: "anthropic", name: "Anthropic", placeholder: "sk-ant-...", models: "Claude 3.5 Sonnet, Claude 3 Haiku" },
  { id: "google", name: "Google", placeholder: "AIzaSy...", models: "Gemini 1.5 Pro" },
  { id: "groq", name: "Groq", placeholder: "gsk_...", models: "Llama 3.3 70B (800 tok/s)" },
  { id: "deepseek", name: "DeepSeek", placeholder: "sk-...", models: "DeepSeek V3" },
] as const;

export function ProviderKeySettings() {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const updateKey = (provider: string, value: string) => {
    setKeys((prev) => ({ ...prev, [provider]: value }));
  };

  const saveKey = async (provider: string) => {
    const apiKey = keys[provider];
    if (!apiKey?.trim()) return;

    setSaving(provider);
    setMessage(null);

    try {
      // TODO: Replace with actual API call after Clerk auth is wired
      // const res = await fetch("/api/provider-keys", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ provider, apiKey }),
      // });

      // Simulate success for now
      await new Promise((r) => setTimeout(r, 500));
      setMessage({ type: "success", text: `${PROVIDERS.find((p) => p.id === provider)?.name} key saved` });
    } catch (e) {
      setMessage({ type: "error", text: "Failed to save key" });
    } finally {
      setSaving(null);
    }
  };

  const removeKey = async (provider: string) => {
    setKeys((prev) => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
    setMessage({ type: "success", text: `${PROVIDERS.find((p) => p.id === provider)?.name} key removed` });
  };

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-semibold">Bring Your Own Key</h2>
      </div>

      <p className="text-text-muted text-sm">
        Add your own API keys to access premium models (GPT-4o, Claude 3.5, etc).
        You pay for your own AI usage — we handle the app.
      </p>

      {message && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
          message.type === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
        }`}>
          {message.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const hasKey = !!keys[provider.id];
          return (
            <div key={provider.id} className="border border-border rounded-xl p-3 sm:p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{provider.name}</p>
                  <p className="text-text-faint text-xs">{provider.models}</p>
                </div>
                {hasKey && (
                  <button
                    onClick={() => removeKey(provider.id)}
                    className="p-1.5 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                    title="Remove key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={keys[provider.id] || ""}
                  onChange={(e) => updateKey(provider.id, e.target.value)}
                  placeholder={provider.placeholder}
                  className="flex-1 bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent"
                />
                <button
                  onClick={() => saveKey(provider.id)}
                  disabled={!keys[provider.id]?.trim() || saving === provider.id}
                  className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-30 disabled:hover:bg-accent transition-colors shrink-0"
                >
                  {saving === provider.id ? "Saving..." : hasKey ? "Update" : "Add"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-text-faint mt-4">
        Keys are encrypted at rest and never shared. You control your own spend.
      </div>
    </div>
  );
}
