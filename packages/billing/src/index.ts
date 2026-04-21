/**
 * 0xNIMBUS — Billing Plugin
 *
 * Stripe billing & usage enforcement plugin for Nimbus agents.
 * Free/Pro/Premier tier management, usage tracking, and model gating.
 *
 * Usage:
 *   import { billingPlugin } from "nimbus-billing";
 *   export class MyAgent extends NimbusChatAgent {
 *     constructor(ctx, env) {
 *       super(ctx, env);
 *       this.use(billingPlugin);
 *     }
 *   }
 */

// Plugin
export { billingPlugin } from "./plugin";

// Tier configuration
export {
  TIER_LIMITS,
  TIER_PRICES,
  TIER_LABELS,
  TIER_DESCRIPTIONS,
  buildTierConfigs,
  isModelAllowed,
  getAllowedModels,
  formatPrice,
} from "./tiers";

// Usage tracking
export {
  checkUsageLimit,
  incrementUsage,
  recordMessageUsage,
  getCurrentUsage,
} from "./usage";

// Stripe helpers
export {
  createStripeClient,
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  getUserTier,
  upsertUser,
  updateUserTier,
  handleSubscriptionWebhook,
  verifyWebhookSignature,
  cancelSubscription,
} from "./stripe";

// Anonymous user tracking
export { isAnonymous, toAnonId, getAnyUserTier, getRemainingUsage, linkAnonymousUser } from "./anon";

// Database
export { applyMigrations, MIGRATIONS } from "./d1-schema";

// Types
export type {
  Tier,
  GatedFeature,
  SubscriptionStatus,
  PriceIds,
  UsageCheckResult,
  UsageRecord,
  SubscriptionRow,
  UsageLogRow,
  UserRow,
  BillingEnv,
  TierLimits,
  TierConfig,
} from "./types";