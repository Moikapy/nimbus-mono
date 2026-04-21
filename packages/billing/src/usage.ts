/**
 * 0xNIMBUS — Usage Tracking
 *
 * Helpers for checking and incrementing usage against tier limits.
 * All operations go through D1 for persistence.
 */

import type { BillingEnv, GatedFeature, Tier, UsageCheckResult } from "./types";
import { TIER_LIMITS } from "./tiers";

/**
 * Get current usage count for a feature in the current billing period.
 * Billing period = current month (resets on the 1st).
 */
export async function getCurrentUsage(
  userId: string,
  feature: GatedFeature,
  db: D1Database,
): Promise<number> {
  const periodStart = getBillingPeriodStart();

  const result = await db
    .prepare(
      `SELECT COUNT(*) as count FROM usage_logs 
       WHERE user_id = ? AND feature = ? AND created_at >= ?`,
    )
    .bind(userId, feature, periodStart)
    .first<{ count: number }>();

  return result?.count ?? 0;
}

/**
 * Check if a user is allowed to use a feature.
 * Returns a detailed result with remaining count and upgrade URL.
 */
export async function checkUsageLimit(
  userId: string,
  feature: GatedFeature,
  tier: Tier,
  db: D1Database,
  upgradeUrl?: string,
): Promise<UsageCheckResult> {
  const limits = TIER_LIMITS[tier];
  const limit = getFeatureLimit(limits, feature);

  // Features that are boolean-gated (web search, file upload)
  if (feature === "webSearch" || feature === "fileUpload") {
    const enabled = getBooleanFeature(limits, feature);
    return {
      allowed: enabled,
      remaining: enabled ? 1 : 0,
      limit: enabled ? 1 : 0,
      tier,
      feature,
      upgradeUrl: enabled ? undefined : upgradeUrl ?? "/pricing",
    };
  }

  const currentUsage = await getCurrentUsage(userId, feature, db);
  const remaining = Math.max(0, limit - currentUsage);

  return {
    allowed: currentUsage < limit,
    remaining,
    limit,
    tier,
    feature,
    upgradeUrl: currentUsage >= limit ? (upgradeUrl ?? "/pricing") : undefined,
  };
}

/**
 * Increment usage for a feature. Call AFTER a successful operation.
 */
export async function incrementUsage(
  userId: string,
  feature: GatedFeature,
  db: D1Database,
  meta?: { model?: string; tokensIn?: number; tokensOut?: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO usage_logs (user_id, feature, model, tokens_in, tokens_out, created_at) 
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    )
    .bind(userId, feature, meta?.model ?? null, meta?.tokensIn ?? null, meta?.tokensOut ?? null)
    .run();
}

/**
 * Bulk increment: record one usage entry with token counts.
 * More efficient for message tracking where you know tokens upfront.
 */
export async function recordMessageUsage(
  userId: string,
  model: string,
  tokensIn: number,
  tokensOut: number,
  db: D1Database,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO usage_logs (user_id, feature, model, tokens_in, tokens_out, created_at) 
       VALUES (?, 'messages', ?, ?, ?, datetime('now'))`,
    )
    .bind(userId, model, tokensIn, tokensOut)
    .run();
}

/**
 * Get the start of the current billing period (1st of current month).
 */
function getBillingPeriodStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Get numeric limit for a feature from tier config.
 */
function getFeatureLimit(limits: (typeof TIER_LIMITS)[Tier], feature: GatedFeature): number {
  switch (feature) {
    case "messages":
      return limits.monthlyMessages;
    case "imageGeneration":
      return limits.imageGeneration;
    case "concurrentImages":
      return limits.concurrentImages;
    default:
      return 0;
  }
}

/**
 * Get boolean feature flag from tier config.
 */
function getBooleanFeature(
  limits: (typeof TIER_LIMITS)[Tier],
  feature: "webSearch" | "fileUpload",
): boolean {
  return limits[feature];
}