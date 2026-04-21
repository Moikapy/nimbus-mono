# Stripe Product / Price Checklist

## Products Created (by you)

| Tier | Product ID |
|------|-----------|
| Pro ($8/mo) | `prod_UNDlJcLPM4h8nh` |
| Premier ($50/mo) | `prod_UNDmH7NGBQ7GPC` |

## What You Still Need

Stripe checkout requires `price_` IDs (not product IDs).

Go to Stripe dashboard → Products → Click each product → "Add price"
- Create a **recurring monthly** price for Pro ($8)
- Create a **recurring monthly** price for Premier ($50)

Then copy the `price_` IDs and set them as secrets:

```bash
cd packages/billing/demo
wrangler secret put STRIPE_PRICE_PRO
# paste: price_...

wrangler secret put STRIPE_PRICE_PREMIER
# paste: price_...
```

## Why This Matters

`createCheckoutSession()` in `packages/billing/src/stripe.ts` line ~40 needs a `price_` ID:

```ts
line_items: [{ price: priceId, quantity: 1 }]
```

`prod_` IDs won't work here.

## Quick Verification

In Stripe dashboard:
1. Products → Pro → Prices tab
2. Should show `price_...` under each price
3. Those are the values you paste into wrangler secrets.
