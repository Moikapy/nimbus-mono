/**
 * 0xNIMBUS — D1 Schema Migrations
 *
 * SQL migrations for the billing system tables.
 * Apply these in order using wrangler d1 migrations.
 */

/** Migration 001: Create users, subscriptions, usage_logs tables */
export const MIGRATION_001 = `
-- Users table: links Clerk auth to subscription tier
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  clerk_id TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'premier')),
  stripe_customer_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Subscriptions: mirrors Stripe subscription state
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'premier')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Usage logs: tracks per-feature usage per billing period
CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  feature TEXT NOT NULL,
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fast lookup: how much of feature X has user Y used this billing period?
CREATE INDEX IF NOT EXISTS idx_usage_user_feature_period ON usage_logs(user_id, feature, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_user_model ON usage_logs(user_id, model, created_at);
`;

/** All migrations in order */
export const MIGRATIONS = [MIGRATION_001] as const;

/**
 * Apply all migrations to a D1 database.
 * Safe to call multiple times (uses IF NOT EXISTS).
 */
export async function applyMigrations(db: D1Database): Promise<void> {
  for (const migration of MIGRATIONS) {
    await db.exec(migration);
  }
}