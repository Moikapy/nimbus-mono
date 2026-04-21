/**
 * AI Gateway unified API model provider.
 * Routes to Workers AI, OpenAI, Anthropic, Google, etc. through a single gateway.
 * Requires AI Gateway configured in Cloudflare dashboard.
 *
 * Uses ai-gateway-provider package to create a Vercel AI SDK compatible provider.
 */

import { createAiGateway } from "ai-gateway-provider";
import type { AiGateway } from "ai-gateway-provider";
import type { ModelRef } from "../core/types";

export type { AiGateway };

export interface UnifiedConfig {
  /** API key for the upstream provider (stored in AI Gateway if not provided) */
  apiKey?: string;
}

/**
 * Create a unified API model reference through AI Gateway.
 *
 * Examples:
 * - unified("openai/gpt-5.2")
 * - unified("anthropic/claude-4-5-sonnet")
 * - unified("google/gemini-2.5-pro")
 * - unified("workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast")
 * - unified("dynamic/customer-support")  // AI Gateway dynamic routing
 *
 * @param model Unified model path: "provider/model-name"
 * @param config Optional config (API key for BYOK)
 * @returns ModelRef string that createNimbus resolves to AI Gateway
 *
 * @example
 * ```ts
 * const model = unified("anthropic/claude-4-5-sonnet");
 * const agent = createNimbus({
 *   model,
 *   gateway: {
 *     accountId: env.CLOUDFLARE_ACCOUNT_ID,
 *     gateway: "my-gateway",
 *     apiKey: env.CF_AIG_TOKEN,
 *   }
 * });
 * ```
 */
export function unified(model: string, config?: UnifiedConfig): ModelRef {
  return `unified:${model}${config?.apiKey ? `::${config.apiKey}` : ""}`;
}

/**
 * Check if a ModelRef is a unified API reference.
 */
export function isUnified(model: ModelRef): boolean {
  return model.startsWith("unified:");
}

/**
 * Parse a unified ModelRef into its components.
 *
 * @param model ModelRef string
 * @returns Object with provider, modelName, and optional apiKey
 * @throws Error if not a valid unified reference
 */
export function parseUnified(model: ModelRef): {
  provider: string;
  modelName: string;
  apiKey?: string;
} {
  if (!isUnified(model)) {
    throw new Error(
      `Invalid unified model reference: ${model}. ` +
      "Expected format: unified:provider/model-name or unified:provider/model-name::apiKey"
    );
  }
  const prefix = "unified:";
  const rest = model.slice(prefix.length);
  const [providerModel, apiKey] = rest.split("::");
  const slashIndex = providerModel.indexOf("/");
  if (slashIndex === -1) {
    throw new Error(
      `Invalid unified model path: ${providerModel}. ` +
      "Expected format: provider/model-name"
    );
  }
  const provider = providerModel.slice(0, slashIndex);
  const modelName = providerModel.slice(slashIndex + 1);
  return { provider, modelName, apiKey: apiKey || undefined };
}

/**
 * Create an AI Gateway provider instance.
 * This is used internally by the resolver but can be used directly if needed.
 *
 * @param config AI Gateway configuration
 * @returns AI Gateway provider for use with Vercel AI SDK
 */

// For backward compatibility with tests that expect createAIGateway
export function createAIGatewayProvider(config: {
  accountId: string;
  gatewayName: string;
  apiKey: string;
  providerApiKey?: string;
}): AiGateway {
  return createAiGateway({
    accountId: config.accountId,
    gateway: config.gatewayName,
    apiKey: config.apiKey,
    ...(config.providerApiKey && { providerApiKey: config.providerApiKey }),
  });
}

// Re-export for testing compatibility
export { createAiGateway as createAIGateway };
