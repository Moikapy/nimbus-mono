/**
 * 0xNIMBUS — SQLite Session Store
 *
 * 1:1 parity with Durable Object SQLite.
 * Works on Bun (bun:sqlite) or Node.js (better-sqlite3).
 */

import type { UIMessage } from "ai";
import type { SessionStore } from "../session-store";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  transaction<T extends (...args: unknown[]) => unknown>(fn: T): T;
}

interface SqliteStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): SqliteRow | undefined;
  all(...params: unknown[]): SqliteRow[];
}

interface SqliteRow {
  [key: string]: unknown;
}

/** Factory for SQLite DB — resolved once at module load */
async function createDB(filename: string): Promise<SqliteDatabase> {
  // Ensure parent directory exists
  if (filename !== ":memory:") {
    const dir = dirname(resolve(filename));
    try { mkdirSync(dir, { recursive: true }); } catch { /* dir exists */ }
  }

  // Try bun:sqlite first (Bun runtime)
  try {
    // @ts-ignore — runtime-only module
    const sqlite = await import("bun:sqlite");
    return new (sqlite as any).Database(filename) as unknown as SqliteDatabase;
  } catch (e: any) {
    console.log("[SqliteSessionStore] bun:sqlite failed:", e?.message || e);
  }

  // Fallback: better-sqlite3 (Node.js)
  try {
    // @ts-ignore — runtime-only module
    const { default: Database } = await import("better-sqlite3");
    return new Database(filename) as unknown as SqliteDatabase;
  } catch (e: any) {
    console.log("[SqliteSessionStore] better-sqlite3 failed:", e?.message || e);
    throw new Error(
      "SqliteSessionStore requires bun:sqlite (Bun) or better-sqlite3 (Node). " +
        "Install: `bun add better-sqlite3`"
    );
  }
}

export class SqliteSessionStore implements SessionStore {
  private db!: SqliteDatabase;
  /** Promise that resolves once DB is initialized */
  private ready: Promise<void>;

  constructor(private options: { filename: string } = { filename: ":memory:" }) {
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    this.db = await createDB(this.options.filename);
    this.createTables();
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS stream_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        stream_id TEXT NOT NULL,
        chunk TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS recovery_data (
        session_id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_state (
        session_id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_stream_chunks_session ON stream_chunks(session_id, stream_id);
    `);
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  async loadMessages(sessionId: string): Promise<UIMessage[]> {
    await this.ensureReady();
    this.db.prepare("INSERT OR IGNORE INTO sessions (id) VALUES (?)").run(sessionId);
    const rows = this.db
      .prepare("SELECT data FROM messages WHERE session_id = ? ORDER BY id ASC")
      .all(sessionId) as SqliteRow[];
    if (!rows || rows.length === 0) return [];
    if (rows.length === 1) {
      try { return JSON.parse(rows[0].data as string) as UIMessage[]; }
      catch { return []; }
    }
    return rows
      .map((r: SqliteRow) => { try { return JSON.parse(r.data as string) as UIMessage; } catch { return null; } })
      .filter((m): m is UIMessage => m !== null);
  }

  async saveMessages(sessionId: string, messages: UIMessage[]): Promise<void> {
    await this.ensureReady();
    const deleteOld = this.db.prepare("DELETE FROM messages WHERE session_id = ?");
    const insert = this.db.prepare("INSERT INTO messages (session_id, data) VALUES (?, ?)");
    const txn = this.db.transaction(() => {
      deleteOld.run(sessionId);
      insert.run(sessionId, JSON.stringify(messages));
    });
    txn();
    this.db.prepare("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?").run(sessionId);
  }

  async saveStreamChunk(sessionId: string, streamId: string, chunk: string): Promise<void> {
    this.db.prepare("INSERT INTO stream_chunks (session_id, stream_id, chunk) VALUES (?, ?, ?)")
      .run(sessionId, streamId, chunk);
  }

  async loadStreamChunks(sessionId: string, streamId: string): Promise<string[]> {
    const rows = this.db.prepare(
      "SELECT chunk FROM stream_chunks WHERE session_id = ? AND stream_id = ? ORDER BY id ASC"
    ).all(sessionId, streamId) as SqliteRow[];
    return rows.map((r: SqliteRow) => r.chunk as string);
  }

  async deleteStreamChunks(sessionId: string, streamId: string): Promise<void> {
    this.db.prepare("DELETE FROM stream_chunks WHERE session_id = ? AND stream_id = ?")
      .run(sessionId, streamId);
  }

  async saveRecoveryData(sessionId: string, data: unknown): Promise<void> {
    this.db.prepare("INSERT OR REPLACE INTO recovery_data (session_id, data) VALUES (?, ?)")
      .run(sessionId, JSON.stringify(data));
  }

  async loadRecoveryData(sessionId: string): Promise<unknown | null> {
    const row = this.db.prepare("SELECT data FROM recovery_data WHERE session_id = ?")
      .get(sessionId) as SqliteRow | undefined;
    if (!row) return null;
    try { return JSON.parse(row.data as string); }
    catch { return null; }
  }

  async saveState(sessionId: string, state: unknown): Promise<void> {
    this.db.prepare("INSERT OR REPLACE INTO agent_state (session_id, state) VALUES (?, ?)")
      .run(sessionId, JSON.stringify(state));
  }

  async loadState(sessionId: string): Promise<unknown | null> {
    const row = this.db.prepare("SELECT state FROM agent_state WHERE session_id = ?")
      .get(sessionId) as SqliteRow | undefined;
    if (!row) return null;
    try { return JSON.parse(row.state as string); }
    catch { return null; }
  }

  async listSessions(): Promise<string[]> {
    const rows = this.db.prepare("SELECT id FROM sessions ORDER BY updated_at DESC")
      .all() as SqliteRow[];
    return rows.map((r: SqliteRow) => r.id as string);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  get raw(): SqliteDatabase { return this.db; }
}
