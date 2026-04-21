/**
 * Sidebar — Conversation list, new chat, user actions.
 * Anonymous users see Sign Up/Sign In. Authenticated: settings + sign out.
 */

"use client";

import { Plus, MessageSquare, Settings, LogOut, LogIn, Shield, UserPlus } from "lucide-react";
import type { Tier } from "@/lib/tier-gate";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  currentAgentId: string;
}

const CONVERSATIONS = [
  { id: "1", title: "Federal data lookup", updated: "2h ago" },
  { id: "2", title: "Model comparison for...", updated: "1d ago" },
  { id: "3", title: "Deploying workers", updated: "3d ago" },
];

// Placeholder — in production, detect Clerk auth state
function isSignedIn(): boolean {
  return false;
}

function getTier(): Tier {
  return "free";
}

function getUserName(): string {
  return "Guest";
}

export function Sidebar({ open, onClose, onSelect, currentAgentId }: SidebarProps) {
  const signedIn = isSignedIn();
  const tier = getTier();
  const userName = getUserName();

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-background border-r border-border flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* New chat */}
        <div className="p-3 border-b border-border">
          <button
            onClick={() => onSelect(Date.now().toString())}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border hover:bg-surface-raised transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4 text-text" />
            New chat
          </button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto py-2">
          {CONVERSATIONS.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full flex items-start gap-2.5 px-3 py-2.5 mx-2 rounded-lg text-left transition-colors text-sm ${
                currentAgentId === conv.id
                  ? "bg-surface-raised text-text"
                  : "text-text-muted hover:bg-surface hover:text-text"
              }`}
            >
              <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="truncate">{conv.title}</p>
                <p className="text-[10px] text-text-faint">{conv.updated}</p>
              </div>
            </button>
          ))}
        </div>

        {/* User section */}
        <div className="border-t border-border p-3 space-y-2">
          {/* Tier badge */}
          <div className="flex items-center justify-between px-2">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                tier === "premier" ? "text-accent" : tier === "pro" ? "text-success" : "text-text-muted"
              }`}
            >
              {tier}
            </span>
            {!signedIn && (
              <button className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full hover:bg-accent hover:text-white transition-colors">
                Upgrade
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="divide-y divide-border">
            {!signedIn && (
              <>
                <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-success hover:text-white hover:bg-success transition-colors">
                  <UserPlus className="w-4 h-4" /> Sign up
                </button>
                <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-accent hover:text-white hover:bg-accent transition-colors">
                  <LogIn className="w-4 h-4" /> Sign in
                </button>
              </>
            )}
            {signedIn && (
              <>
                <div className="px-2 py-1.5 text-xs text-text-muted flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {userName}
                </div>
                <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-muted hover:text-text transition-colors">
                  <Settings className="w-4 h-4" /> Settings
                </button>
                <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-muted hover:text-danger transition-colors">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </>
            )}
          </div>

          <div className="text-center text-[10px] text-text-faint pt-1">
            Nimbus v0.1.0 · 🐉
          </div>
        </div>
      </aside>
    </>
  );
}
