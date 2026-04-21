/**
 * 0xNIMBUS — Anonymous User Tracking
 *
 * Free tier uses client-side fingerprints (UUID in localStorage)
 * instead of Clerk user IDs. These are stored as `anon:<uuid>`
 * in D1 and behave identically to authenticated users for usage
 * enforcement, except their tier is always "free".
 *
 * When a user upgrades, the anonymous fingerprint is linked to
 * their Clerk account during the checkout flow.
 */

import type { BillingEnv, Tier } from "./types";

const ANON_PREFIX = "anon:";

/** Check if a user ID is anonymous */
export function isAnonymous(userId: string): boolean {
  return userId.startsWith(ANON_PREFIX);
}

/** Build an anonymous user ID from the fingerprint */
export function toAnonId(fingerprint: string): string {
  return `${ANON_PREFIX}${fingerprint}`;
}

/**
 * Get tier for any user — anonymous or authenticated.
 * Anonymous users are always free tier.
 */
export async function getAnyUserTier(userId: string, db: D1Database): Promise<Tier> {
  if (isAnonymous(userId)) {
    return "free";
  }

  // Authenticated: check subscriptions table
  const result = await db
    .prepare(
      `SELECT tier FROM subscriptions 
       WHERE user_id = ? AND status IN ('active', 'trialing') 
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(userId)
    .first<{ tier: Tier }>();

  return result?.tier ?? "free";
}

/**
 * Get remaining usage for a feature, handling both anonymous
 * and authenticated users. Returns { remaining, limit, used }.
 */
export async function getRemainingUsage(
  userId: string,
  feature: "messages",
  db: D1Database,
): Promise<{ remaining: number; limit: number; used: number }> {
  const tier = await getAnyUserTier(userId, db);
  const limit = tier === "premier" ? 15000 : tier === "pro" ? 1000 : 50;
  const periodStart = getBillingPeriodStart();

  const result = await db
    .prepare(
      `SELECT COUNT(*) as count FROM usage_logs 
       WHERE user_id = ? AND feature = ? AND created_at >= ?`,
    )
    .bind(userId, feature, periodStart)
    .first<{ count: number }>();

  const used = result?.count ?? 0;
  return { remaining: Math.max(0, limit - used), limit, used };
}

function getBillingPeriodStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Link an anonymous fingerprint to an authenticated user.
 * Called after sign-up to migrate usage history.
 */
export async function linkAnonymousUser(
  anonFingerprint: string,
  clerkUserId: string,
  db: D1Database,
): Promise<void> {
  const anonId = toAnonId(anonFingerprint);

  // Update all usage_logs from anon ID to real user ID
  await db
    .prepare(`UPDATE usage_logs SET user_id = ? WHERE user_id = ?`)
    .bind(clerkUserId, anonId)
    .run();

  // Optional: insert a link record
  await db
    .prepare(
      `INSERT INTO users (id, email, clerk_id, tier, stripe_customer_id, created_at)
       SELECT ?, email, ?, tier, stripe_customer_id, created_at FROM users WHERE id = ?
       ON CONFLICT DO NOTHING`,
    )
    .bind(clerkUserId, clerkUserId, anonId)
    .run();
}