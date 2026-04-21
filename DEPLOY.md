# 0xNIMBUS — Deploy Guide

## Prerequisites

1. D1 database created:
```bash
wrangler d1 create nimbus-billing
# Copy the database_id into packages/billing/demo/wrangler.toml
```

2. Logged into Cloudflare:
```bash
wrangler login
```

## Deploy Worker (Agent)

```bash
cd packages/billing/demo

# Set secrets (interactive prompts, never commit these)
wrangler secret put STRIPE_SECRET_KEY
# paste: sk_live_...

wrangler secret put STRIPE_WEBHOOK_SECRET
# paste: whsec_...

wrangler secret put STRIPE_PRICE_PRO
# paste: price_...

wrangler secret put STRIPE_PRICE_PREMIER
# paste: price_...

# Deploy
wrangler deploy
```

## Deploy Pages (Chat)

```bash
cd packages/chat

# Install + build
bun install
bun run build

# Set secrets
wrangler pages secret put CLERK_SECRET_KEY --project-name nimbus-chat
wrangler pages secret put STRIPE_SECRET_KEY --project-name nimbus-chat
wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name nimbus-chat

# Deploy
wrangler pages deploy .vercel/output/static --project-name nimbus-chat
```

## Stripe Webhook

Set endpoint in Stripe dashboard:
```
https://nimbus-agent.workers.dev/_stripe
```

Enable events:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

## Live URLs

| Service | Default | Custom (later) |
|---------|---------|----------------|
| Chat | `https://nimbus-chat.pages.dev` | `chat.moikapy.dev` |
| Agent | `https://nimbus-agent.workers.dev` | `agent.moikapy.dev` |
| Webhook | `https://nimbus-agent.workers.dev/_stripe` | `agent.moikapy.dev/_stripe` |
