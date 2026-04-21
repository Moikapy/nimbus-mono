/**
 * 0xNIMBUS — Local Agent
 *
 * NimbusLocal extends NimbusBase for local Bun/Node runtime.
 * Same .use(plugin) pattern, same wire protocol, same client hooks.
 * Constructor takes (sessionId, store) positional args for server compat.
 */

import { streamText, convertToModelMessages, type UIMessage, type LanguageModel } from "ai";
import { NimbusBase } from "../nimbus-base";
import type { SessionStore } from "./session-store";

export interface LocalConfig {
  sessionId: string;
  store: SessionStore;
  env?: Record<string, unknown>;
  maxPersistedMessages?: number;
  modelResolver?: () => LanguageModel;
}

/**
 * NimbusLocal — the local-first AI agent.
 */
export class NimbusLocal extends NimbusBase {
  public readonly sessionId: string;
  public readonly store: SessionStore;
  private _env: Record<string, unknown>;
  private _modelResolver?: () => LanguageModel;
  private _messages: UIMessage[] = [];
  private _agentState: unknown = null;

  constructor(
    sessionId: string | LocalConfig,
    store?: SessionStore,
    env?: Record<string, unknown>,
    maxPersistedMessages?: number,
    modelResolver?: () => LanguageModel,
  ) {
    super();

    // Support both positional args (server) and config object (programmatic)
    if (typeof sessionId === "string") {
      this.sessionId = sessionId;
      this.store = store!;
      this._env = env ?? {};
      this.maxPersistedMessages = maxPersistedMessages ?? 200;
      this._modelResolver = modelResolver;
    } else {
      const config = sessionId;
      this.sessionId = config.sessionId;
      this.store = config.store;
      this._env = config.env ?? {};
      this.maxPersistedMessages = config.maxPersistedMessages ?? 200;
      this._modelResolver = config.modelResolver;
    }
  }

  // ── Environment ────────────────────────────────────────────────────────────

  protected getEnv(): Record<string, unknown> {
    return this._env;
  }

  setEnv(env: Record<string, unknown>): this {
    this._env = env;
    return this;
  }

  // ── Model ──────────────────────────────────────────────────────────────────

  resolveModel(): LanguageModel {
    if (this._modelResolver) {
      return this._modelResolver();
    }
    throw new Error(
      "NimbusLocal: No model resolver configured. Pass modelResolver in config or override resolveModel()."
    );
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  get messages(): UIMessage[] {
    return this._messages;
  }

  set messages(msgs: UIMessage[]) {
    this._messages = msgs;
  }

  async persistMessages(messages: UIMessage[]): Promise<void> {
    const pruned = messages.length > this.maxPersistedMessages
      ? messages.slice(-this.maxPersistedMessages)
      : messages;
    this._messages = pruned;
    await this.store.saveMessages(this.sessionId, pruned);
  }

  async loadMessages(): Promise<UIMessage[]> {
    this._messages = await this.store.loadMessages(this.sessionId);
    return this._messages;
  }

  // ── State ──────────────────────────────────────────────────────────────────

  get state(): unknown {
    return this._agentState;
  }

  async setState(state: unknown): Promise<void> {
    this._agentState = state;
    await this.store.saveState(this.sessionId, state);
  }

  async loadState(): Promise<unknown | null> {
    this._agentState = await this.store.loadState(this.sessionId);
    return this._agentState;
  }

  // ── Internal access (for server) ───────────────────────────────────────────

  callGetSystemInstructions(): string | undefined {
    return this.getSystemInstructions();
  }

  callNimbusTools() {
    return this.nimbusTools();
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  async onChatMessage() {
    const result = streamText({
      model: this.resolveModel(),
      system: this.getSystemInstructions(),
      messages: await convertToModelMessages(this.messages as any),
      tools: this.nimbusTools(),
    });
    return result.toUIMessageStreamResponse();
  }

  async init(): Promise<void> {
    await this.loadMessages();
    await this.loadState();
  }
}
