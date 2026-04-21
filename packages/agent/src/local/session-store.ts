/**
 * 0xNIMBUS — Session Store Interface
 *
 * Replaces what Durable Object SQLite + AIChatAgent provide on Cloudflare:
 * - Message persistence (this.messages auto-loaded from store)
 * - Stream chunk storage (resumable streams)
 * - Recovery data (stash/unstash for interrupted streams)
 * - Agent state (arbitrary per-session state)
 *
 * Implementations: SqliteSessionStore, FileSessionStore, CapSessionStore
 */

import type { UIMessage } from "ai";

/**
 * Session store — the persistence layer for NimbusLocal.
 *
 * Each method takes a sessionId to support multiple concurrent sessions
 * in a single process (like Cloudflare Durable Objects).
 */
export interface SessionStore {
  // ── Messages ──────────────────────────────────────────────────────────────

  /** Load all messages for a session. Replaces AIChatAgent's auto-load from SQLite. */
  loadMessages(sessionId: string): Promise<UIMessage[]>;

  /** Save messages for a session. Replaces AIChatAgent.persistMessages(). */
  saveMessages(sessionId: string, messages: UIMessage[]): Promise<void>;

  // ── Stream Chunks ─────────────────────────────────────────────────────────

  /** Store a stream chunk for resumption. Replaces AIChatAgent's _storeStreamChunk. */
  saveStreamChunk(sessionId: string, streamId: string, chunk: string): Promise<void>;

  /** Load stored chunks for a stream (for replay on reconnect). */
  loadStreamChunks(sessionId: string, streamId: string): Promise<string[]>;

  /** Delete chunks after successful stream completion. */
  deleteStreamChunks(sessionId: string, streamId: string): Promise<void>;

  // ── Recovery Data ──────────────────────────────────────────────────────────

  /** Save recovery/checkpoint data. Replaces AIChatAgent's this.stash(). */
  saveRecoveryData(sessionId: string, data: unknown): Promise<void>;

  /** Load recovery data. Replaces AIChatAgent's onChatRecovery context. */
  loadRecoveryData(sessionId: string): Promise<unknown | null>;

  // ── State ──────────────────────────────────────────────────────────────────

  /** Save arbitrary agent state. Replaces DO this.state. */
  saveState(sessionId: string, state: unknown): Promise<void>;

  /** Load agent state. */
  loadState(sessionId: string): Promise<unknown | null>;

  // ── Session Management ─────────────────────────────────────────────────────

  /** List all session IDs. */
  listSessions(): Promise<string[]>;

  /** Delete a session and all its data. */
  deleteSession(sessionId: string): Promise<void>;
}