/**
 * 0xNIMBUS — Billing Types
 *
 * Shared types for the billing plugin. Consumers depend on these shapes.
 */

/** Subscription tier levels */
export type Tier = "free" | "pro" | "premier";

/** Features that can be gated by tier */
export type GatedFeature =
  | "messages"
  | "imageGeneration"
  | "webSearch"
  | "fileUpload"
  | "concurrentImages";

/** Subscription status from Stripe */
export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

/** Stripe price IDs mapped to tiers */
export interface PriceIds {
  free: string;
  pro: string;
  premier: string;
}

/** Result of checking a usage limit */
export interface UsageCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  tier: Tier;
  feature: GatedFeature;
  /** If limit reached, URL to upgrade */
  upgradeUrl?: string;
}

/** Usage record for logging */
export interface UsageRecord {
  userId: string;
  feature: GatedFeature;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  createdAt: string;
}

/** D1 row shape for subscriptions table */
export interface SubscriptionRow {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  tier: Tier;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

/** D1 row shape for usage_logs table */
export interface UsageLogRow {
  id: number;
  userId: string;
  feature: string;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  createdAt: string;
}

/** D1 row shape for users table */
export interface UserRow {
  id: string;
  email: string;
  tier: Tier;
  clerkId: string;
  stripeCustomerId: string | null;
  createdAt: string;
}

/** Environment bindings required by the billing plugin */
export interface BillingEnv {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_IDS: PriceIds;
  /** Optional: override the default upgrade URL */
  UPGRADE_URL?: string;
  [key: string]: unknown;
}

/** Tier limits configuration */
export interface TierLimits {
  monthlyMessages: number;
  imageGeneration: number;
  webSearch: boolean;
  fileUpload: boolean;
  concurrentImages: number;
  /** "all" = all models available; string[] = whitelist */
  models: "all" | string[];
}

/** Full tier configuration including price */
export interface TierConfig extends TierLimits {
  price: number;
  priceId: string;
  label: string;
  description: string;
}