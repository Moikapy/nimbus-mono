/**
 * 0xNIMBUS — Stripe Integration
 *
 * Helpers for creating checkout sessions, managing subscriptions,
 * and verifying webhooks. Designed for Cloudflare Workers + D1.
 *
 * Usage:
 *   const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
 *   const session = await createCheckoutSession(stripe, { ... });
 */

import Stripe from "stripe";
import type { BillingEnv, Tier, SubscriptionRow, SubscriptionStatus } from "./types";

/**
 * Create a configured Stripe client.
 * Use API version 2024-12-18.acacia for latest features.
 */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2024-12-18.acacia",
    httpClient: Stripe.createFetchHttpClient(), // Works in Workers
  });
}

/**
 * Create a Stripe Checkout Session for subscription signup.
 * After payment, Stripe redirects to successUrl.
 */
export async function createCheckoutSession(
  stripe: Stripe,
  opts: {
    priceId: string;
    customerId?: string;
    customerEmail?: string;
    successUrl: string;
    cancelUrl: string;
    userId: string;
    tier: Tier;
  },
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: opts.priceId,
        quantity: 1,
      },
    ],
    ...(opts.customerId && { customer: opts.customerId }),
    ...(!opts.customerId && opts.customerEmail && {
      customer_email: opts.customerEmail,
    }),
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: {
      userId: opts.userId,
      tier: opts.tier,
    },
    subscription_data: {
      metadata: {
        userId: opts.userId,
        tier: opts.tier,
      },
    },
  });
}

/**
 * Create a Stripe Customer Portal session for self-serve subscription management.
 * Users can upgrade, downgrade, or cancel from here.
 */
export async function createPortalSession(
  stripe: Stripe,
  opts: {
    customerId: string;
    returnUrl: string;
  },
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: opts.customerId,
    return_url: opts.returnUrl,
  });
}

/**
 * Get a user's subscription from D1.
 * Returns the most recent active/trialing subscription, or null.
 */
export async function getSubscription(
  userId: string,
  db: D1Database,
): Promise<SubscriptionRow | null> {
  const result = await db
    .prepare(
      `SELECT * FROM subscriptions 
       WHERE user_id = ? AND status IN ('active', 'trialing') 
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(userId)
    .first<SubscriptionRow>();

  return result ?? null;
}

/**
 * Get a user's current tier from D1.
 * Falls back to 'free' if no subscription found.
 */
export async function getUserTier(userId: string, db: D1Database): Promise<Tier> {
  const sub = await getSubscription(userId, db);
  return sub?.tier ?? "free";
}

/**
 * Upsert a user in D1. Called on first login or webhook.
 */
export async function upsertUser(
  userId: string,
  email: string,
  clerkId: string,
  db: D1Database,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, email, clerk_id, tier, created_at) 
       VALUES (?, ?, ?, 'free', datetime('now'))
       ON CONFLICT(id) DO UPDATE SET email = ?`,
    )
    .bind(userId, email, clerkId, email)
    .run();
}

/**
 * Update a user's tier in D1. Called when subscription changes.
 */
export async function updateUserTier(
  userId: string,
  tier: Tier,
  stripeCustomerId: string | null,
  db: D1Database,
): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET tier = ?, stripe_customer_id = COALESCE(?, stripe_customer_id) WHERE id = ?`,
    )
    .bind(tier, stripeCustomerId, userId)
    .run();
}

/**
 * Handle a Stripe subscription webhook event.
 * Updates D1 to mirror Stripe's source of truth.
 *
 * Supported events:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_failed
 */
export async function handleSubscriptionWebhook(
  event: Stripe.Event,
  env: BillingEnv,
): Promise<void> {
  const db = env.DB;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.userId;
      const tier = subscription.metadata.tier as Tier;
      const priceId = subscription.items.data[0]?.price.id;

      if (!userId || !tier) {
        console.error("Missing metadata on subscription", subscription.id);
        return;
      }

      // Upsert subscription record
      await db
        .prepare(
          `INSERT INTO subscriptions (id, user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, tier, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
           ON CONFLICT(stripe_subscription_id) DO UPDATE SET 
             tier = ?, status = ?, stripe_price_id = ?, current_period_start = ?, current_period_end = ?, cancel_at_period_end = ?, updated_at = datetime('now')`,
        )
        .bind(
          subscription.id,
          userId,
          subscription.customer as string,
          subscription.id,
          priceId ?? "",
          tier,
          subscription.status,
          new Date(subscription.current_period_start * 1000).toISOString(),
          new Date(subscription.current_period_end * 1000).toISOString(),
          subscription.cancel_at_period_end ? 1 : 0,
          tier,
          subscription.status,
          priceId ?? "",
          new Date(subscription.current_period_start * 1000).toISOString(),
          new Date(subscription.current_period_end * 1000).toISOString(),
          subscription.cancel_at_period_end ? 1 : 0,
        )
        .run();

      // Update user's tier
      const subscriptionStatus = subscription.status as SubscriptionStatus;
      if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
        await updateUserTier(userId, tier, subscription.customer as string, db);
      }

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.userId;

      if (!userId) return;

      // Mark subscription as canceled
      await db
        .prepare(
          `UPDATE subscriptions SET status = 'canceled', updated_at = datetime('now') 
           WHERE stripe_subscription_id = ?`,
        )
        .bind(subscription.id)
        .run();

      // Downgrade user to free
      await updateUserTier(userId, "free", null, db);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      if (!subscriptionId) return;

      // Mark subscription as past_due
      await db
        .prepare(
          `UPDATE subscriptions SET status = 'past_due', updated_at = datetime('now') 
           WHERE stripe_subscription_id = ?`,
        )
        .bind(subscriptionId)
        .run();
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

/**
 * Verify a Stripe webhook signature.
 * Returns the parsed event or throws if invalid.
 */
export async function verifyWebhookSignature(
  body: string,
  signature: string,
  webhookSecret: string,
): Promise<Stripe.Event> {
  const stripe = createStripeClient(""); // Secret not needed for verification
  return stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
}

/**
 * Cancel a subscription. Sets cancel_at_period_end by default (user keeps access until period ends).
 */
export async function cancelSubscription(
  stripe: Stripe,
  subscriptionId: string,
  immediately = false,
): Promise<Stripe.Subscription> {
  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId);
  }
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}