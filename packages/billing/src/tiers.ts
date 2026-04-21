/**
 * 0xNIMBUS — Tier Configuration
 *
 * Defines the three billing tiers and their limits.
 * Free: Basic usage for trying things out.
 * Pro: The sweet spot — all models, uploads, search.
 * Premier: Power user tier with 10x+ Pro limits.
 */

import type { Tier, TierConfig, TierLimits } from "./types";

/** Limits per tier. Extend here to add new gated features. */
export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    monthlyMessages: 50,
    imageGeneration: 0,
    webSearch: false,
    fileUpload: false,
    concurrentImages: 0,
    models: ["@cf/zai-org/glm-4.7-flash"],
  },
  pro: {
    monthlyMessages: 1000,
    imageGeneration: 50,
    webSearch: true,
    fileUpload: true,
    concurrentImages: 1,
    models: "all",
  },
  premier: {
    monthlyMessages: 15000,
    imageGeneration: 500,
    webSearch: true,
    fileUpload: true,
    concurrentImages: 5,
    models: "all",
  },
};

/** Prices in USD cents per month */
export const TIER_PRICES: Record<Tier, number> = {
  free: 0,
  pro: 800, // $8.00
  premier: 5000, // $50.00
};

/** Human-readable labels */
export const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  premier: "Premier",
};

/** Descriptions for each tier */
export const TIER_DESCRIPTIONS: Record<Tier, string> = {
  free: "Small monthly limits for basic usage. Basic models only.",
  pro: "Expanded monthly limits for more flexibility. Access to all models, file uploads, and web search.",
  premier: "Over 10x Pro limits for power users. Includes concurrent image generations.",
};

/**
 * Build a full TierConfig by merging limits with price IDs.
 * Call this at runtime with your actual Stripe price IDs.
 */
export function buildTierConfigs(priceIds: Record<Tier, string>): Record<Tier, TierConfig> {
  const tiers: Record<Tier, TierConfig> = {} as any;
  for (const tier of Object.keys(TIER_LIMITS) as Tier[]) {
    tiers[tier] = {
      ...TIER_LIMITS[tier],
      price: TIER_PRICES[tier],
      priceId: priceIds[tier],
      label: TIER_LABELS[tier],
      description: TIER_DESCRIPTIONS[tier],
    };
  }
  return tiers;
}

/**
 * Check if a model is allowed for a given tier.
 */
export function isModelAllowed(model: string, tier: Tier): boolean {
  const limits = TIER_LIMITS[tier];
  if (limits.models === "all") return true;
  return limits.models.includes(model);
}

/**
 * Get the list of allowed models for a tier.
 * Returns null if all models are allowed (avoids maintaining a full model list).
 */
export function getAllowedModels(tier: Tier): string[] | null {
  const limits = TIER_LIMITS[tier];
  if (limits.models === "all") return null;
  return limits.models;
}

/**
 * Format price in USD.
 */
export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  const dollars = cents / 100;
  return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}/mo`;
}