/**
 * 0xNIMBUS — Billing Worker Entrypoint
 *
 * Deploy this Worker standalone. It serves the BillingChatAgent DO.
 */

import { BillingChatAgent } from "./agent";

export { BillingChatAgent };

import { applyMigrations } from "../src/d1-schema";

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

/** CORS headers for chat frontends */
function corsHeaders(origin?: string): Record<string, string> {
  const allowed = origin || "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") || undefined;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Stripe webhooks
    if (url.pathname === "/_stripe" && request.method === "POST") {
      const { handleSubscriptionWebhook, verifyWebhookSignature } = await import("../src/stripe");
      const body = await request.text();
      const sig = request.headers.get("stripe-signature") || "";
      const event = await verifyWebhookSignature(body, sig, env.STRIPE_WEBHOOK_SECRET);
      await handleSubscriptionWebhook(event, env as any);
      return new Response(null, { status: 200 });
    }

    // Chat: get or create DO
    const userId = url.searchParams.get("userId") || "";
    if (!userId) {
      return new Response("Missing userId", { status: 400, headers: corsHeaders(origin) });
    }

    const id = env.BillingChatAgent.idFromName(userId);
    const stub = env.BillingChatAgent.get(id);

    // AIChatAgent expects WebSocket upgrade for useAgentChat compat
    if (request.headers.get("upgrade") === "websocket") {
      return stub.fetch(request);
    }

    // HTTP fallback (for direct calls from Pages)
    const modifiedRequest = new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers),
        "x-nimbus-user-id": userId,
      },
    });
    const response = await stub.fetch(modifiedRequest);

    // Add CORS headers to the response
    const newHeaders = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      newHeaders.set(k, v);
    }
    return new Response(response.body, { status: response.status, headers: newHeaders });
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await applyMigrations(env.DB);
  },
};
