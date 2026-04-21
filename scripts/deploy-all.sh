#!/usr/bin/env bash
# 0xNIMBUS — Deploy Full Stack
# Deploys billing worker + chat pages in sequence.
#
# Required env vars:
#   STRIPE_SECRET_KEY
#   STRIPE_WEBHOOK_SECRET
#   STRIPE_PRICE_PRO (optional)
#   STRIPE_PRICE_PREMIER (optional)
#   CLERK_SECRET_KEY (optional, for auth)
#
# Usage:
#   export STRIPE_SECRET_KEY=sk_live_...
#   export STRIPE_WEBHOOK_SECRET=whsec_...
#   ./scripts/deploy-all.sh

set -e

echo "🐉 Nimbus Deploy"
echo ""

# 1. Build billing package
echo "📦 Building nimbus-billing..."
cd packages/billing
bun run build
cd ../..

# 2. Deploy worker
echo ""
echo "☁️  Deploying agent worker..."
./scripts/deploy-billing.sh

# 3. Deploy pages
echo ""
echo "💬 Deploying chat app..."
./scripts/deploy-chat.sh

echo ""
echo "✅ All deployed!"
echo ""
echo "URLs:"
echo "  Chat:   https://nimbus-chat.pages.dev"
echo "  Agent:  https://nimbus-agent.workers.dev"
echo "  Stripe: https://nimbus-agent.workers.dev/_stripe"
