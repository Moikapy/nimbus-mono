#!/usr/bin/env bash
# 0xNIMBUS — Deploy Billing Worker with secrets
# Run from repo root.
#
# Usage:
#   export STRIPE_SECRET_KEY="sk_live_..."
#   export STRIPE_WEBHOOK_SECRET="whsec_..."
#   export STRIPE_PRICE_PRO="price_..."
#   export STRIPE_PRICE_PREMIER="price_..."
#   ./scripts/deploy-billing.sh

echo "Deploying nimbus-agent billing worker..."

cd packages/billing/demo || exit 1

if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "Error: STRIPE_SECRET_KEY env var not set"
  exit 1
fi

if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
  echo "Error: STRIPE_WEBHOOK_SECRET env var not set"
  exit 1
fi

echo "Setting Cloudflare secrets..."
printf '%s' "$STRIPE_SECRET_KEY" | wrangler secret put STRIPE_SECRET_KEY --name nimbus-agent
printf '%s' "$STRIPE_WEBHOOK_SECRET" | wrangler secret put STRIPE_WEBHOOK_SECRET --name nimbus-agent

if [ -n "$STRIPE_PRICE_PRO" ]; then
  printf '%s' "$STRIPE_PRICE_PRO" | wrangler secret put STRIPE_PRICE_PRO --name nimbus-agent
fi

if [ -n "$STRIPE_PRICE_PREMIER" ]; then
  printf '%s' "$STRIPE_PRICE_PREMIER" | wrangler secret put STRIPE_PRICE_PREMIER --name nimbus-agent
fi

echo "Deploying worker..."
wrangler deploy

echo "Done."
echo ""
echo "Live URLs:"
echo "  Agent:    https://nimbus-agent.workers.dev"
echo "  Webhook:  https://nimbus-agent.workers.dev/_stripe"
echo ""
echo "Clear terminal:  clear"
