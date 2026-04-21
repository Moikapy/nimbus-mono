/**
 * 0xNIMBUS — Billing Plugin
 *
 * The NimbusPlugin that gates features by subscription tier.
 * Drop it into any NimbusChatAgent via .use(billingPlugin).
 */

import { z } from "zod";
import type { NimbusPlugin, ToolDef, ToolContext } from "nimbus-agent";
import type { BillingEnv, GatedFeature } from "./types";
import { isModelAllowed } from "./tiers";
import { checkUsageLimit, incrementUsage, recordMessageUsage } from "./usage";
import { getUserTier } from "./stripe";

const checkUsageLimitTool = {
  description:
    "Check if the user has remaining usage for a feature this billing period. Returns remaining count and upgrade URL if limit reached.",
  parameters: z.object({
    feature: z.enum(["messages", "imageGeneration", "webSearch", "fileUpload", "concurrentImages"]).describe("The feature to check usage for"),
  }),
  execute: async (params: unknown, ctx: ToolContext) => {
    const { feature } = params as { feature: GatedFeature };
    const env = ctx.env as unknown as BillingEnv;
    const userId = (env as any).userId as string;

    if (!userId) {
      return { allowed: false, reason: "not_authenticated", upgradeUrl: "/sign-in" };
    }

    const tier = await getUserTier(userId, env.DB);
    return checkUsageLimit(userId, feature, tier, env.DB, env.UPGRADE_URL);
  },
} as ToolDef;

const checkModelAccessTool = {
  description:
    "Check if the user's tier allows access to a specific model. Returns whether access is allowed and the user's tier.",
  parameters: z.object({
    model: z.string().describe("The model reference to check access for"),
  }),
  execute: async (params: unknown, ctx: ToolContext) => {
    const { model } = params as { model: string };
    const env = ctx.env as unknown as BillingEnv;
    const userId = (env as any).userId as string;

    if (!userId) {
      return { allowed: false, reason: "not_authenticated", tier: "free" };
    }

    const tier = await getUserTier(userId, env.DB);
    const allowed = isModelAllowed(model, tier);

    return {
      allowed,
      tier,
      model,
      ...(allowed ? {} : { upgradeUrl: env.UPGRADE_URL ?? "/pricing" }),
    };
  },
} as ToolDef;

const recordUsageTool = {
  description: "Record usage after a successful message or action. Internal bookkeeping.",
  parameters: z.object({
    feature: z.enum(["messages", "imageGeneration", "webSearch", "fileUpload"]),
    model: z.string().optional().describe("The model used, if applicable"),
    tokensIn: z.number().optional().describe("Input tokens consumed"),
    tokensOut: z.number().optional().describe("Output tokens produced"),
  }),
  execute: async (params: unknown, ctx: ToolContext) => {
    const { feature, model, tokensIn, tokensOut } = params as { feature: GatedFeature; model?: string; tokensIn?: number; tokensOut?: number };
    const env = ctx.env as unknown as BillingEnv;
    const userId = (env as any).userId as string;

    if (!userId) return { recorded: false, reason: "not_authenticated" };

    if (feature === "messages" && model && tokensIn !== undefined && tokensOut !== undefined) {
      await recordMessageUsage(userId, model, tokensIn, tokensOut, env.DB);
    } else {
      await incrementUsage(userId, feature, env.DB, { model, tokensIn, tokensOut });
    }

    return { recorded: true };
  },
} as ToolDef;

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
