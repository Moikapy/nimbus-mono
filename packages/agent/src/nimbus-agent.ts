/**
 * 0xNIMBUS — Cloudflare Agent
 *
 * NimbusChatAgent extends AIChatAgent from the Cloudflare Agents SDK.
 * Uses the same plugin logic as NimbusLocal (core/plugins.ts).
 *
 * Can't extend both AIChatAgent and NimbusBase (TS single inheritance),
 * so we compose: AIChatAgent is the base, plugin methods are inline
 * using the same shared functions.
 */

import { AIChatAgent } from "@cloudflare/ai-chat";
import { streamText, convertToModelMessages } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { NimbusPlugin, ToolContext } from "./core/types";
import {
  createPluginState,
  applyPlugin,
  getPluginNames,
  getInstructions,
  buildToolSet,
  type PluginState,
} from "./core/plugins";

export interface Env {
  AI: Ai;
  [key: string]: unknown;
}

/**
 * NimbusChatAgent — the Cloudflare-native AI agent.
 *
 * Extend this class and call .use(plugin) in your constructor.
 * The agent handles message persistence, streaming, and tool execution.
 */
export class NimbusChatAgent extends AIChatAgent<Env> {
  private _pluginState: PluginState = createPluginState();

  /** Maximum messages to persist in SQLite. Controls storage; not LLM context. */
  maxPersistedMessages = 200;

  /** Add a plugin. Returns this for chaining. */
  use(plugin: NimbusPlugin): this {
    this._pluginState = applyPlugin(this._pluginState, plugin);
    return this;
  }

  /** List active plugin names. */
  plugins(): string[] {
    return getPluginNames(this._pluginState);
  }

  /** Set the model reference. */
  setModel(model: string): this {
    this._pluginState = { ...this._pluginState, modelRef: model };
    return this;
  }

  /** Get the current model reference. */
  getModelRef(): string {
    return this._pluginState.modelRef;
  }

  /** Resolve model using Workers AI binding. */
  resolveModel() {
    return createWorkersAI({ binding: this.env.AI })(this._pluginState.modelRef);
  }

  /** Convert plugin tools to AI SDK ToolSet. */
  protected nimbusTools() {
    return buildToolSet(this._pluginState.tools, this.env as Record<string, unknown>);
  }

  /** Get merged system instructions. */
  protected getSystemInstructions(): string | undefined {
    return getInstructions(this._pluginState);
  }

  /** Core chat handler. Override for custom behavior. */
  async onChatMessage() {
    const result = streamText({
      model: this.resolveModel(),
      system: this.getSystemInstructions(),
      messages: await convertToModelMessages(this.messages),
      tools: this.nimbusTools(),
    });

    return result.toUIMessageStreamResponse();
  }
}