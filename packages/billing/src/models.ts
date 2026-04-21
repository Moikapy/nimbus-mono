/**
 * 0xNIMBUS — Model Registry
 *
 * Maps AI Gateway / Workers AI model references to tiers.
 * Free users get "flavor of the month" — a curated smaller model
 * that changes periodically to keep things fresh.
 *
 * Model cost estimates (neurons per 1K tokens):
 * - Small (7-8B): ~500-1,200 neurons → ~$0.005-0.013/query
 * - Medium (35-70B): ~2,000-4,500 neurons → ~$0.022-0.050/query
 * - Large ( reasoning/180B+): ~8,000+ neurons → ~$0.088+/query
 */

import type { Tier } from "./types";

export interface ModelInfo {
  id: string;
  name: string;
  provider: "cloudflare" | "openai" | "anthropic" | "google" | "groq" | "deepseek";
  size: "small" | "medium" | "large";
  capabilities: string[];
  costPerQuery: number; // estimated in USD
  description: string;
}

/**
 * All available models across providers.
 * These are resolved through Cloudflare AI Gateway.
 */
export const ALL_MODELS: ModelInfo[] = [
  // ─── Small Models (Free Tier + Pro + Premier) ───
  {
    id: "@cf/meta/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B",
    provider: "cloudflare",
    size: "small",
    capabilities: ["chat", "code"],
    costPerQuery: 0.002,
    description: "Fast, efficient for everyday questions and light coding",
  },
  {
    id: "@cf/google/gemma-2-9b-it",
    name: "Gemma 2 9B",
    provider: "cloudflare",
    size: "small",
    capabilities: ["chat", "code", "math"],
    costPerQuery: 0.002,
    description: "Google's efficient model, great for reasoning tasks",
  },
  {
    id: "@cf/mistral/mistral-7b-instruct-v0.2",
    name: "Mistral 7B",
    provider: "cloudflare",
    size: "small",
    capabilities: ["chat", "code"],
    costPerQuery: 0.003,
    description: "Solid all-rounder with strong instruction following",
  },
  {
    id: "@hf/nousresearch/hermes-2-pro-mistral-7b",
    name: "Hermes 2 Pro 7B",
    provider: "cloudflare",
    size: "small",
    capabilities: ["chat", "code", "function-calling"],
    costPerQuery: 0.003,
    description: "Tool-use champion — perfect for agent workflows",
  },

  // ─── Medium Models (Pro + Premier only) ───
  {
    id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    name: "Llama 3.3 70B Fast",
    provider: "cloudflare",
    size: "medium",
    capabilities: ["chat", "code", "analysis"],
    costPerQuery: 0.035,
    description: "Meta's flagship — fast, capable, balanced",
  },
  {
    id: "@cf/qwen/qwen2.5-72b-instruct",
    name: "Qwen 2.5 72B",
    provider: "cloudflare",
    size: "medium",
    capabilities: ["chat", "code", "analysis", "math"],
    costPerQuery: 0.035,
    description: "Alibaba's powerhouse — exceptional at coding and math",
  },

  // ─── Large Models (Pro + Premier only) ───
  {
    id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    name: "DeepSeek R1 32B",
    provider: "cloudflare",
    size: "large",
    capabilities: ["chat", "code", "reasoning", "analysis"],
    costPerQuery: 0.050,
    description: "Reasoning specialist — step-by-step problem solving",
  },
  {
    id: "@cf/nousresearch/nous-hermes-llama2-70b",
    name: "Hermes Llama 2 70B",
    provider: "cloudflare",
    size: "medium",
    capabilities: ["chat", "code", "analysis"],
    costPerQuery: 0.035,
    description: "Nous Research tuned — excellent creative writing",
  },
];

/**
 * "Flavor of the Month" — the single model available to free users.
 * Rotate this monthly to keep free users engaged.
 *
 * Rules for picking the FOTM:
 * 1. Must be a "small" model (cheap to run)
 * 2. Must be capable enough that users feel the product is quality
 * 3. Rotate every 30 days, announce on X/Twitter
 * 4. Pick models that have buzz (new release, benchmark win)
 */
export const FLAVOR_OF_THE_MONTH: string = "@cf/google/gemma-2-9b-it";

/**
 * Default model per tier when user hasn't explicitly selected one.
 */
export function getDefaultModel(tier: Tier): string {
  switch (tier) {
    case "free":
      return FLAVOR_OF_THE_MONTH;
    case "pro":
      return "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    case "premier":
      return "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";
  }
}

/**
 * Check if a model is available for a given tier.
 * Free: only FOTM
 * Pro/Premier: all models
 */
export function isModelAllowedForTier(modelId: string, tier: Tier): boolean {
  if (tier === "free") return modelId === FLAVOR_OF_THE_MONTH;
  return ALL_MODELS.some((m) => m.id === modelId);
}

/**
 * Get the list of models a tier can access.
 */
export function getModelsForTier(tier: Tier): ModelInfo[] {
  if (tier === "free") {
    return ALL_MODELS.filter((m) => m.id === FLAVOR_OF_THE_MONTH);
  }
  return ALL_MODELS;
}

/**
 * Estimated monthly AI cost based on tier and expected usage.
 * Uses average query cost × message limit.
 */
export function estimateAICost(tier: Tier): number {
  const limits = {
    free: { messages: 50, model: FLAVOR_OF_THE_MONTH },
    pro: { messages: 1000, model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
    premier: { messages: 15000, model: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b" },
  };

  const info = ALL_MODELS.find((m) => m.id === limits[tier].model)!;
  return info.costPerQuery * limits[tier].messages;
}
