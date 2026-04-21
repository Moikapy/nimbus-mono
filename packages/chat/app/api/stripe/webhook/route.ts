/**
 * API: /api/stripe/webhook
 *
 * Receives Stripe webhooks and updates D1 subscription records.
 *
 * Stripe forwards events here. We verify the signature, then process:
 * - checkout.session.completed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_failed
 */

import { NextRequest, NextResponse } from "next/server";
// TODO: import nimbus-billing helpers once build system is ready
// import { handleSubscriptionWebhook, verifyWebhookSignature } from "nimbus-billing";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature") || "";

    if (!STRIPE_WEBHOOK_SECRET) {
      console.error("Missing STRIPE_WEBHOOK_SECRET");
      return new NextResponse("Webhook secret not configured", { status: 500 });
    }

    // TODO: Verify webhook signature
    // const event = await verifyWebhookSignature(body, sig, STRIPE_WEBHOOK_SECRET);
    // await handleSubscriptionWebhook(event, env);

    console.log("Stripe webhook received (not processing yet — wire up nimbus-billing)");

    return new NextResponse(null, { status: 200 });
  } catch (e) {
    console.error("Stripe webhook error:", e);
    return new NextResponse("Webhook error", { status: 400 });
  }
}
