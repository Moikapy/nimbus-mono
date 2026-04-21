/**
 * 0xNIMBUS — NimbusBase
 *
 * Abstract base class for all Nimbus agents (Cloudflare and Local).
 * Provides plugin composition, tool conversion, and model config.
 *
 * The shared logic lives in core/plugins.ts as pure functions.
 */

import type { LanguageModel } from "ai";
import type { NimbusPlugin } from "./core/types";
import {
  createPluginState,
  applyPlugin,
  getPluginNames,
  getInstructions,
  buildToolSet,
  type PluginState,
} from "./core/plugins";

/**
 * Abstract base class for Nimbus agents.
 * NimbusLocal extends this directly. NimbusChatAgent extends AIChatAgent
 * but uses the same plugin functions from core/plugins.ts.
 */
export abstract class NimbusBase {
  private _state: PluginState = createPluginState();

  /** Maximum messages to persist. */
  public maxPersistedMessages: number = 200;

  /** Add a plugin. Returns this for chaining. */
  use(plugin: NimbusPlugin): this {
    this._state = applyPlugin(this._state, plugin);
    return this;
  }

  /** List active plugin names. */
  plugins(): string[] {
    return getPluginNames(this._state);
  }

  /** Set model reference. */
  setModel(model: string): this {
    this._state = { ...this._state, modelRef: model };
    return this;
  }

  /** Get current model reference. */
  getModelRef(): string {
    return this._state.modelRef;
  }

  /** Resolve model reference to AI SDK LanguageModel. */
  abstract resolveModel(): LanguageModel;

  /** Get environment for tool execution. */
  protected abstract getEnv(): Record<string, unknown>;

  /** Convert plugin tools to AI SDK ToolSet. */
  protected nimbusTools() {
    return buildToolSet(this._state.tools, this.getEnv());
  }

  /** Get merged system instructions. */
  protected getSystemInstructions(): string | undefined {
    return getInstructions(this._state);
  }

  /** Get MCP servers from all plugins. */
  protected getMcpServers() {
    return this._state.plugins
      .filter((p) => p.mcpServers && p.mcpServers.length > 0)
      .flatMap((p) => p.mcpServers!);
  }
}