/**
 * 0xNIMBUS — BillingDemo Agent
 *
 * A standalone deployable Worker that adds Stripe billing / usage gating
 * to any NimbusChatAgent. Works with both anonymous (free) and
 * authenticated (paid) users.
 *
 * Deploy as its own Worker so it's reusable across projects.
 */

import { NimbusChatAgent } from "nimbus-agent";
import { billingPlugin } from "../src/plugin";
import { getUserTier } from "../src/stripe";
import { getAnyUserTier, isAnonymous } from "../src/anon";
import { incrementUsage, checkUsageLimit } from "../src/usage";
import { TIER_LIMITS, isModelAllowed } from "../src/tiers";
import { getDefaultModel } from "../src/models";

interface BillingEnv {
  AI: Ai;
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_PRO: string;
  STRIPE_PRICE_PREMIER: string;
  UPGRADE_URL?: string;
  /** AI Gateway ID for free caching (e.g. "nimbus-gateway") */
  AI_GATEWAY?: string;
}

export class BillingChatAgent extends NimbusChatAgent {
  constructor(ctx: DurableObjectState, env: BillingEnv) {
    super(ctx, env as any);
    this.use(billingPlugin);
  }

  /**
   * Override onChatMessage to enforce usage + model tier limits
   * before streaming the AI response.
   *
   * Supports:
   * - Anonymous users: `env.userId` prefixed with "anon:"
   * - Authenticated users: `env.userId` is their Clerk ID
   */
  async onChatMessage() {
    const env = (this as any).env as BillingEnv;
    const userId = env.userId as string | undefined;

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: "missing_user_id",
          message: "Missing user identifier. Reload the page and try again.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const tier = isAnonymous(userId) ? "free" : await getUserTier(userId, env.DB);

    // 1. Message count check (monthly)
    const usage = await checkUsageLimit(userId, "messages", tier, env.DB, env.UPGRADE_URL);
    if (!usage.allowed) {
      const isAnon = isAnonymous(userId);
      return new Response(
        JSON.stringify({
          error: "limit_reached",
          message: isAnon
            ? "You've used all 50 free messages this month. Sign in to upgrade for more."
            : "You've reached your monthly message limit.",
          tier,
          remaining: 0,
          upgradeUrl: usage.upgradeUrl!,
          showAuthPrompt: isAnon,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Set model based on tier (Pro/Premier can choose, Free gets FOTM)
    const requestedModel = (this.getModelRef?.() || "") || getDefaultModel(tier);
    if (!isModelAllowed(requestedModel, tier)) {
      return new Response(
        JSON.stringify({
          error: "model_not_allowed",
          message: `The model '${requestedModel}' is not available on your ${tier} plan.`,
          tier,
          model: requestedModel,
          upgradeUrl: env.UPGRADE_URL ?? "/pricing",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }
    this.setModel(requestedModel || getDefaultModel(tier));

    // 3. Stream the response
    const result = await super.onChatMessage();

    // 4. Record usage asynchronously (fire-and-forget)
    incrementUsage(userId, "messages", env.DB, { model: requestedModel }).catch((err: unknown) =>
      console.error("Usage tracking failed:", err),
    );

    return result;
  }
}
