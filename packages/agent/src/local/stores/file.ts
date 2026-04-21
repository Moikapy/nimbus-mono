/**
 * 0xNIMBUS — File Session Store
 *
 * Zero-dependency file-based session store. Each session is a directory
 * with JSON files. Good for development and debugging.
 * Not suitable for production — use SqliteSessionStore instead.
 */

import type { UIMessage } from "ai";
import type { SessionStore } from "../session-store";
import { mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export class FileSessionStore implements SessionStore {
  constructor(private options: { directory: string } = { directory: "./data/sessions" }) {
    if (!existsSync(options.directory)) {
      mkdir(options.directory, { recursive: true });
    }
  }

  private dir(sessionId: string): string {
    return join(this.options.directory, sessionId);
  }

  private async ensureDir(sessionId: string): Promise<void> {
    if (!existsSync(this.dir(sessionId))) {
      await mkdir(this.dir(sessionId), { recursive: true });
    }
  }

  async loadMessages(sessionId: string): Promise<UIMessage[]> {
    try {
      const data = await readFile(join(this.dir(sessionId), "messages.json"), "utf-8");
      return JSON.parse(data) as UIMessage[];
    } catch {
      return [];
    }
  }

  async saveMessages(sessionId: string, messages: UIMessage[]): Promise<void> {
    await this.ensureDir(sessionId);
    await writeFile(
      join(this.dir(sessionId), "messages.json"),
      JSON.stringify(messages, null, 2),
    );
  }

  async saveStreamChunk(sessionId: string, streamId: string, chunk: string): Promise<void> {
    await this.ensureDir(sessionId);
    const chunksDir = join(this.dir(sessionId), "chunks");
    if (!existsSync(chunksDir)) await mkdir(chunksDir, { recursive: true });
    await writeFile(join(chunksDir, `${streamId}-${Date.now()}.json`), chunk);
  }

  async loadStreamChunks(sessionId: string, streamId: string): Promise<string[]> {
    try {
      const files = await readdir(join(this.dir(sessionId), "chunks"));
      return files
        .filter((f) => f.startsWith(streamId))
        .sort()
        .map((f) => readFile(join(this.dir(sessionId), "chunks", f), "utf-8"))
        .reduce<Promise<string[]>>(async (acc, p) => {
          const a = await acc;
          a.push(await p);
          return a;
        }, Promise.resolve([]));
    } catch {
      return [];
    }
  }

  async deleteStreamChunks(sessionId: string, streamId: string): Promise<void> {
    try {
      const chunksDir = join(this.dir(sessionId), "chunks");
      const files = await readdir(chunksDir);
      await Promise.all(
        files.filter((f) => f.startsWith(streamId)).map((f) => rm(join(chunksDir, f))),
      );
    } catch { /* dir doesn't exist */ }
  }

  async saveRecoveryData(sessionId: string, data: unknown): Promise<void> {
    await this.ensureDir(sessionId);
    await writeFile(
      join(this.dir(sessionId), "recovery.json"),
      JSON.stringify(data, null, 2),
    );
  }

  async loadRecoveryData(sessionId: string): Promise<unknown | null> {
    try {
      const data = await readFile(join(this.dir(sessionId), "recovery.json"), "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveState(sessionId: string, state: unknown): Promise<void> {
    await this.ensureDir(sessionId);
    await writeFile(
      join(this.dir(sessionId), "state.json"),
      JSON.stringify(state, null, 2),
    );
  }

  async loadState(sessionId: string): Promise<unknown | null> {
    try {
      const data = await readFile(join(this.dir(sessionId), "state.json"), "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async listSessions(): Promise<string[]> {
    try {
      const entries = await readdir(this.options.directory);
      return entries.filter((e) => existsSync(join(this.options.directory, e, "messages.json")));
    } catch {
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await rm(this.dir(sessionId), { recursive: true, force: true });
    } catch { /* dir doesn't exist */ }
  }
}