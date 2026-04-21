/**
 * 0xNIMBUS — Model Registry v2
 *
 * Now includes BYOK (Bring Your Own Key) models.
 * When a user adds an OpenAI/Anthropic/Groq key, those models appear
 * in the selector. They pay for their own AI usage, we handle infra.
 */

import type { Tier } from "./types";

export interface ModelInfo {
  id: string;
  name: string;
  provider: "cloudflare" | "openai" | "anthropic" | "google" | "groq" | "deepseek";
  size: "small" | "medium" | "large";
  capabilities: string[];
  /** Cost per query in USD (estimated) */
  costPerQuery: number;
  description: string;
  /** Whether this model requires BYOK */
  byok?: boolean;
}

// ─── Workers AI Models (hosted by us) ───
export const WORKERS_AI_MODELS: ModelInfo[] = [
  {
    id: "@cf/google/gemma-2-9b-it",
    name: "Gemma 2 9B",
    provider: "cloudflare",
    size: "small",
    capabilities: ["chat", "code"],
    costPerQuery: 0.002,
    description: "Fast, efficient for everyday questions and light coding",
  },
  {
    id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    name: "Llama 3.3 70B",
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
  {
    id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    name: "DeepSeek R1 32B",
    provider: "cloudflare",
    size: "large",
    capabilities: ["chat", "code", "reasoning", "analysis"],
    costPerQuery: 0.050,
    description: "Reasoning specialist — step-by-step problem solving",
  },
];

// ─── BYOK Models (user provides their own API key) ───
export const BYOK_MODELS: ModelInfo[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    size: "large",
    capabilities: ["chat", "code", "vision", "analysis"],
    costPerQuery: 0.005,
    description: "OpenAI's flagship — multimodal, fast, powerful",
    byok: true,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    size: "small",
    capabilities: ["chat", "code"],
    costPerQuery: 0.00015,
    description: "OpenAI's cheapest model — great for quick tasks",
    byok: true,
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    size: "large",
    capabilities: ["chat", "code", "reasoning", "writing"],
    costPerQuery: 0.003,
    description: "Anthropic's best coder — exceptional at complex reasoning",
    byok: true,
  },
  {
    id: "claude-3-haiku",
    name: "Claude 3 Haiku",
    provider: "anthropic",
    size: "small",
    capabilities: ["chat", "code"],
    costPerQuery: 0.00025,
    description: "Anthropic's fastest model — instant responses",
    byok: true,
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "google",
    size: "large",
    capabilities: ["chat", "code", "vision", "long-context"],
    costPerQuery: 0.0035,
    description: "Google's best — 2M token context window",
    byok: true,
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B (Groq)",
    provider: "groq",
    size: "medium",
    capabilities: ["chat", "code"],
    costPerQuery: 0.0003,
    description: "Groq inference — 800+ tokens/sec blazing fast",
    byok: true,
  },
  {
    id: "deepseek-chat",
    name: "DeepSeek V3",
    provider: "deepseek",
    size: "large",
    capabilities: ["chat", "code", "reasoning"],
    costPerQuery: 0.00014,
    description: "DeepSeek's best — cheap, capable, open weights",
    byok: true,
  },
];

/** Flavor of the Month for free users */
export let FLAVOR_OF_THE_MONTH = "@cf/google/gemma-2-9b-it";

/** Rotate FOTM — call monthly */
export function setFlavorOfTheMonth(modelId: string): void {
  FLAVOR_OF_THE_MONTH = modelId;
}

/** All models a user sees (Workers AI + BYOK they have keys for) */
export function getAllModelsForUser(hasKeys: string[] = []): ModelInfo[] {
  const byokAvailable = BYOK_MODELS.filter((m) => hasKeys.includes(m.provider));
  return [...WORKERS_AI_MODELS, ...byokAvailable];
}

/** Get default model for a tier */
export function getDefaultModel(tier: Tier, hasKeys: string[] = []): string {
  if (tier === "free") return FLAVOR_OF_THE_MONTH;
  if (hasKeys.includes("openai")) return "gpt-4o";
  return "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
}

/** Check if model is available for tier + user keys */
export function isModelAvailable(
  modelId: string,
  tier: Tier,
  hasKeys: string[] = []
): boolean {
  const model = getAllModelsForUser(hasKeys).find((m) => m.id === modelId);
  if (!model) return false;

  if (tier === "free") {
    // Free: only FOTM or BYOK models (if they have the key)
    return model.id === FLAVOR_OF_THE_MONTH || model.byok === true;
  }

  return true; // Pro/Premier get everything
}

/** Get models organized by category for the UI */
export function getModelCategories(hasKeys: string[] = []) {
  const all = getAllModelsForUser(hasKeys);
  return {
    hosted: all.filter((m) => !m.byok),
    byok: all.filter((m) => m.byok),
  };
}

/** Estimated cost per tier with message limits */
export function estimateAICost(tier: Tier, hasKeys: string[] = []): number {
  const limits = {
    free: { messages: 50, model: FLAVOR_OF_THE_MONTH },
    pro: { messages: 1000, model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
    premier: { messages: 15000, model: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b" },
  };

  const info = getAllModelsForUser(hasKeys).find((m) => m.id === limits[tier].model);
  if (!info) return 0;
  return info.costPerQuery * limits[tier].messages;
}
