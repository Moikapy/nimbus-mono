/**
 * 0xNIMBUS — Cloudflare Agent
 *
 * NimbusChatAgent extends AIChatAgent from the Cloudflare Agents SDK.
 * Uses the same plugin logic as NimbusLocal (core/plugins.ts).
 *
 * AI Gateway Support:
 * Set env.AI_GATEWAY to your gateway ID (e.g. "my-gateway") to route
 * all Workers AI calls through Cloudflare AI Gateway with free caching.
 * Same question twice = second call costs zero neurons.
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
  /** Optional: AI Gateway ID for caching (e.g. "my-gateway") */
  AI_GATEWAY?: string;
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

  /**
   * Resolve model using Workers AI binding.
   * If AI_GATEWAY is configured, routes through gateway for free caching.
   */
  resolveModel() {
    const gatewayId = this.env.AI_GATEWAY;
    if (gatewayId) {
      // Use AI Gateway for caching + observability
      return createWorkersAI({
        binding: this.env.AI,
        gateway: { id: gatewayId },
      })(this._pluginState.modelRef);
    }
    // Direct Workers AI (no caching)
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
