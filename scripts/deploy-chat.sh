#!/usr/bin/env bash
# 0xNIMBUS — Deploy Chat Pages App
# Run from repo root.
#
# Usage:
#   ./scripts/deploy-chat.sh

set -e

echo "Building chat app..."
cd packages/chat || exit 1

# Install if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  bun install
fi

# Build Next.js static export
echo "Building Next.js static export..."
bun run build

# Set secrets via wrangler pages
echo "Setting Pages secrets..."
if [ -n "$CLERK_SECRET_KEY" ]; then
  printf '%s' "$CLERK_SECRET_KEY" | wrangler pages secret put CLERK_SECRET_KEY --project-name nimbus-chat
fi
if [ -n "$STRIPE_SECRET_KEY" ]; then
  printf '%s' "$STRIPE_SECRET_KEY" | wrangler pages secret put STRIPE_SECRET_KEY --project-name nimbus-chat
fi
if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
  printf '%s' "$STRIPE_WEBHOOK_SECRET" | wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name nimbus-chat
fi

# Deploy to Pages
echo "Deploying to Cloudflare Pages..."
wrangler pages deploy .vercel/output/static --project-name nimbus-chat

echo "Done."
echo ""
echo "Live URL: https://nimbus-chat.pages.dev"
echo "Custom domain: add chat.moikapy.dev in Cloudflare dashboard later"
echo ""
