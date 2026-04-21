/**
 * API: /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for Pro or Premier upgrade.
 * Requires Clerk authentication.
 */

import { NextRequest, NextResponse } from "next/server";
// import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tier } = body;

    if (!tier || (tier !== "pro" && tier !== "premier")) {
      return new NextResponse("Invalid tier", { status: 400 });
    }

    // TODO: Validate Clerk session
    // const { userId } = await auth();
    // if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    // TODO: Create Stripe Checkout Session via nimbus-billing
    // const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    // const session = await createCheckoutSession(stripe, { ... });

    // For now, redirect to Stripe directly (dev placeholder)
    const priceId =
      tier === "pro"
        ? process.env.STRIPE_PRICE_PRO
        : process.env.STRIPE_PRICE_PREMIER;

    if (!priceId) {
      return new NextResponse("Stripe price not configured", { status: 500 });
    }

    return NextResponse.json({
      url: `https://checkout.stripe.com/pay/${priceId}?prefilled_email_user=user@example.com`,
      // TODO: Return real checkout session URL
    });
  } catch (e) {
    console.error("Checkout error:", e);
    return new NextResponse("Internal error", { status: 500 });
  }
}
