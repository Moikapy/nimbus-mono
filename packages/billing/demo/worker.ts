/**
 * 0xNIMBUS — Billing Worker Entrypoint
 *
 * Deploy this Worker standalone. It serves the BillingChatAgent DO.
 *
 * wrangler.toml setup:
 *   [durable_objects]
 *   bindings = [ { name = "BillingChatAgent", class_name = "BillingChatAgent" } ]
 *
 *   [[d1_databases]]
 *   binding = "DB"
 *   database_name = "nimbus-billing"
 *   database_id = "your-db-id"
 */

import { BillingChatAgent } from "./agent";

export { BillingChatAgent };

import { applyMigrations } from "nimbus-billing/d1-schema";

export interface Env {
  BillingChatAgent: DurableObjectNamespace<BillingChatAgent>;
  AI: Ai;
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_PRO: string;
  STRIPE_PRICE_PREMIER: string;
  UPGRADE_URL?: string;
}

/**
 * Simple HTTP handler for the billing agent.
 * POST /?userId=anon:xxx → creates/finds DO and forwards chat.
 * Also handles Stripe webhooks at POST /_stripe.
 *
 * AIChatAgent expects WebSocket connections for streaming.
 * This minimal entrypoint lets pages proxy through.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Stripe webhooks
    if (url.pathname === "/_stripe" && request.method === "POST") {
      const { handleSubscriptionWebhook, verifyWebhookSignature } = await import("nimbus-billing/stripe");
      const body = await request.text();
      const sig = request.headers.get("stripe-signature") || "";
      const event = await verifyWebhookSignature(body, sig, env.STRIPE_WEBHOOK_SECRET);
      await handleSubscriptionWebhook(event, env as any);
      return new Response(null, { status: 200 });
    }

    // Chat: get or create DO
    const userId = url.searchParams.get("userId") || "";
    if (!userId) {
      return new Response("Missing userId", { status: 400 });
    }

    // Use userId as DO id so conversation persists per user
    const id = env.BillingChatAgent.idFromName(userId);
    const stub = env.BillingChatAgent.get(id);

    // AIChatAgent expects WebSocket upgrade for useAgentChat compat
    if (request.headers.get("upgrade") === "websocket") {
      return stub.fetch(request);
    }

    // HTTP fallback (for proxied requests from Pages)
    // Override env.userId so the agent knows who is chatting
    const modifiedRequest = new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers),
        "x-nimbus-user-id": userId,
      },
    });
    return stub.fetch(modifiedRequest);
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    // Optional: run migrations on cron
    await applyMigrations(env.DB);
  },
};
