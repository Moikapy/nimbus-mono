/**
 * 0xNIMBUS — Shared Plugin Logic
 *
 * Functions shared between NimbusChatAgent (Cloudflare) and NimbusLocal.
 * Both agents need the same plugin composition, tool conversion, and
 * instruction merging — but they extend different base classes
 * (AIChatAgent vs plain class).
 *
 * This module provides the shared logic as pure functions.
 * Both NimbusBase and NimbusChatAgent call these functions.
 */

import { tool as aiTool, type ToolSet } from "ai";
import type { NimbusPlugin, ToolDef, ToolContext } from "../core/types";

/**
 * Plugin state — maintained per-agent instance.
 */
export interface PluginState {
  plugins: NimbusPlugin[];
  tools: Record<string, ToolDef>;
  instructions: string;
  modelRef: string;
}

/**
 * Create initial plugin state.
 */
export function createPluginState(): PluginState {
  return {
    plugins: [],
    tools: {},
    instructions: "",
    modelRef: "@cf/zai-org/glm-4.7-flash",
  };
}

/**
 * Apply a plugin to the state. Returns new state (immutable).
 */
export function applyPlugin(state: PluginState, plugin: NimbusPlugin): PluginState {
  return {
    plugins: [...state.plugins, plugin],
    tools: plugin.tools ? { ...state.tools, ...plugin.tools } : state.tools,
    instructions: plugin.instructions
      ? state.instructions
        ? `${state.instructions}\n\n--- ${plugin.name} ---\n${plugin.instructions}`
        : plugin.instructions
      : state.instructions,
    modelRef: state.modelRef,
  };
}

/**
 * Get plugin names.
 */
export function getPluginNames(state: PluginState): string[] {
  return state.plugins.map((p) => p.name);
}

/**
 * Get merged system instructions.
 */
export function getInstructions(state: PluginState): string | undefined {
  return state.instructions || undefined;
}

/**
 * Convert registered tools to AI SDK ToolSet format.
 */
export function buildToolSet(
  tools: Record<string, ToolDef>,
  env: Record<string, unknown>,
): ToolSet {
  const result: ToolSet = {};
  for (const [name, def] of Object.entries(tools)) {
    const executeFn = async (args: any): Promise<any> => {
      const ctx: ToolContext = {
        env,
        conversationId: undefined,
        step: 0,
        trace: [],
        abort: (reason: string) => {
          throw new Error(`Aborted: ${reason}`);
        },
      };
      return def.execute(args, ctx);
    };
    result[name] = aiTool({
      description: def.description,
      parameters: def.parameters as any,
      execute: executeFn,
    } as any);
  }
  return result;
}

/**
 * Collect MCP servers from all plugins.
 */
export function collectMcpServers(state: PluginState) {
  return state.plugins
    .filter((p) => p.mcpServers && p.mcpServers.length > 0)
    .flatMap((p) => p.mcpServers!);
}