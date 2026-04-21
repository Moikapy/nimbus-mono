/**
 * API: /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for self-serve management.
 * User clicks "Manage subscription" and gets a Stripe-hosted portal.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // TODO: Validate Clerk session, get userId
    // const { userId } = await auth();
    // if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    // TODO: Look up stripe_customer_id from D1
    // const user = await getUser(userId, env.DB);
    // if (!user?.stripeCustomerId) return new NextResponse("No subscription", { status: 404 });

    // TODO: Create portal session via nimbus-billing
    // const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    // const session = await createPortalSession(stripe, { ... });

    return NextResponse.json({
      url: "https://billing.stripe.com/portal", // placeholder
    });
  } catch (e) {
    console.error("Portal error:", e);
    return new NextResponse("Internal error", { status: 500 });
  }
}
