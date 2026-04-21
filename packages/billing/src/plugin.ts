/**
 * 0xNIMBUS — Billing Plugin
 *
 * The NimbusPlugin that gates features by subscription tier.
 * Drop it into any NimbusChatAgent via .use(billingPlugin).
 *
 * Usage:
 *   import { billingPlugin } from "nimbus-billing";
 *   export class MyAgent extends NimbusChatAgent {
 *     constructor(ctx, env) {
 *       super(ctx, env);
 *       this.use(billingPlugin);
 *     }
 *   }
 *
 * The plugin adds two tools:
 * - checkUsageLimit: Check if the user can use a feature
 * - checkModelAccess: Check if the user can access a model
 *
 * These tools are called by the agent's onChatMessage handler or
 * by other tools that need to gate access.
 */

import { z } from "zod";
import type { NimbusPlugin, ToolDef, ToolContext } from "../../agent/src/core/types";
import type { BillingEnv, GatedFeature, Tier } from "./types";
import { TIER_LIMITS, isModelAllowed } from "./tiers";
import { checkUsageLimit, incrementUsage, recordMessageUsage } from "./usage";
import { getUserTier } from "./stripe";

/**
 * Check if the current user can use a feature.
 * The agent calls this tool before executing gated actions.
 */
const checkUsageLimitTool: ToolDef = {
  description:
    "Check if the user has remaining usage for a feature this billing period. Returns remaining count and upgrade URL if limit reached.",
  parameters: z.object({
    feature: z.enum(["messages", "imageGeneration", "webSearch", "fileUpload", "concurrentImages"]).describe(
      "The feature to check usage for",
    ),
  }),
  execute: async (params: { feature: GatedFeature }, ctx: ToolContext) => {
    const env = ctx.env as unknown as BillingEnv;
    const userId = (env as any).userId as string;

    if (!userId) {
      return { allowed: false, reason: "not_authenticated", upgradeUrl: "/sign-in" };
    }

    const tier = await getUserTier(userId, env.DB);
    const result = await checkUsageLimit(userId, params.feature, tier, env.DB, env.UPGRADE_URL);

    return result;
  },
};

/**
 * Check if the current user can access a specific model.
 * Free tier users can only use basic models.
 */
const checkModelAccessTool: ToolDef = {
  description:
    "Check if the user's tier allows access to a specific model. Returns whether access is allowed and the user's tier.",
  parameters: z.object({
    model: z.string().describe("The model reference to check access for"),
  }),
  execute: async (params: { model: string }, ctx: ToolContext) => {
    const env = ctx.env as unknown as BillingEnv;
    const userId = (env as any).userId as string;

    if (!userId) {
      return { allowed: false, reason: "not_authenticated", tier: "free" };
    }

    const tier = await getUserTier(userId, env.DB);
    const allowed = isModelAllowed(params.model, tier);

    return {
      allowed,
      tier,
      model: params.model,
      ...(allowed ? {} : { upgradeUrl: env.UPGRADE_URL ?? "/pricing" }),
    };
  },
};

/**
 * Record message usage after a successful response.
 * Called by the agent's post-processing, not as a user-facing tool.
 */
const recordUsageTool: ToolDef = {
  description: "Record usage after a successful message or action. Internal bookkeeping.",
  parameters: z.object({
    feature: z.enum(["messages", "imageGeneration", "webSearch", "fileUpload"]),
    model: z.string().optional().describe("The model used, if applicable"),
    tokensIn: z.number().optional().describe("Input tokens consumed"),
    tokensOut: z.number().optional().describe("Output tokens produced"),
  }),
  execute: async (
    params: { feature: GatedFeature; model?: string; tokensIn?: number; tokensOut?: number },
    ctx: ToolContext,
  ) => {
    const env = ctx.env as unknown as BillingEnv;
    const userId = (env as any).userId as string;

    if (!userId) return { recorded: false, reason: "not_authenticated" };

    if (params.feature === "messages" && params.model && params.tokensIn !== undefined && params.tokensOut !== undefined) {
      await recordMessageUsage(userId, params.model, params.tokensIn, params.tokensOut, env.DB);
    } else {
      await incrementUsage(userId, params.feature, env.DB, {
        model: params.model,
        tokensIn: params.tokensIn,
        tokensOut: params.tokensOut,
      });
    }

    return { recorded: true };
  },
};

/**
 * The billing plugin. Add to any NimbusChatAgent via .use(billingPlugin).
 *
 * Provides:
 * - checkUsageLimit: Gate features by tier
 * - checkModelAccess: Gate models by tier
 * - recordUsage: Post-action usage logging
 *
 * Instructions remind the agent to check limits before actions.
 */
export const billingPlugin: NimbusPlugin = {
  name: "nimbus-billing",
  description: "Stripe billing & usage enforcement. Gates features by subscription tier.",
  tools: {
    checkUsageLimit: checkUsageLimitTool,
    checkModelAccess: checkModelAccessTool,
    recordUsage: recordUsageTool,
  },
  instructions: `You have access to billing tools. Before performing any action that consumes resources:
1. Call checkModelAccess for the model you're about to use
2. Call checkUsageLimit for the feature category (messages, imageGeneration, webSearch, fileUpload)
3. If either returns allowed: false, inform the user they've reached their limit and provide the upgrade URL
4. After completing the action, call recordUsage to log the usage

Tier limits:
- Free: 50 messages/mo, basic models only, no images/search/uploads
- Pro ($8/mo): 1000 messages/mo, all models, web search, file uploads, 50 images
- Premier ($50/mo): 15000 messages/mo, all models, all features, 500 images, 5 concurrent`,
};