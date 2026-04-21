/**
 * Workers AI model provider — uses env.AI binding directly (no HTTP, no API key).
 *
 * Uses workers-ai-provider package to create a Vercel AI SDK compatible provider.
 */

import { createWorkersAI } from "workers-ai-provider";
import type { WorkersAI } from "workers-ai-provider";
import type { ModelRef } from "../core/types";

export type { WorkersAI };

export interface WorkersAIConfig {
  /** Workers AI binding name in wrangler.jsonc (default: "AI") */
  binding?: string;
}

/**
 * Create a Workers AI model reference.
 * Uses the env.AI binding at runtime — no API key needed.
 *
 * @param model Workers AI model name, e.g. "@cf/zai-org/glm-4.7-flash"
 * @param config Optional config (binding name)
 * @returns ModelRef string that createNimbus resolves to Workers AI
 *
 * @example
 * ```ts
 * const model = workersAI("@cf/zai-org/glm-4.7-flash");
 * const agent = createNimbus({ model });
 * ```
 */
export function workersAI(model: string, config?: WorkersAIConfig): ModelRef {
  return `workers-ai:${model}${config?.binding ? `:${config.binding}` : ""}`;
}

/**
 * Check if a ModelRef is a Workers AI reference.
 */
export function isWorkersAI(model: ModelRef): boolean {
  return model.startsWith("workers-ai:");
}

/**
 * Parse a Workers AI ModelRef into its components.
 *
 * @param model ModelRef string
 * @returns Object with model name and binding name
 * @throws Error if not a valid Workers AI reference
 */
export function parseWorkersAI(model: ModelRef): { model: string; binding: string } {
  if (!isWorkersAI(model)) {
    throw new Error(
      `Invalid Workers AI model reference: ${model}. ` +
        "Expected format: workers-ai:@cf/provider/model-name or workers-ai:@cf/provider/model-name:binding"
    );
  }
  const parts = model.split(":");
  return {
    model: parts[1],
    binding: parts[2] ?? "AI",
  };
}

/**
 * Create a Workers AI provider instance from environment binding.
 * This is used internally by the resolver but can be used directly if needed.
 *
 * @param env Cloudflare environment with AI binding
 * @param bindingName Name of the AI binding (default: "AI")
 * @returns Workers AI provider for use with Vercel AI SDK
 * @throws Error if binding is not found
 */
export function createWorkersAIProvider(
  env: Record<string, unknown>,
  bindingName: string = "AI"
): WorkersAI {
  const binding = env[bindingName];
  if (!binding) {
    throw new Error(
      `Workers AI binding "${bindingName}" not found in environment. ` +
        "Make sure it's configured in wrangler.jsonc"
    );
  }
  return createWorkersAI({ binding: binding as Ai });
}
