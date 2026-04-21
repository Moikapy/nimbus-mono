/**
 * PricingModal — Free / Pro / Premier
 * Shown when user hits limits or clicks "Upgrade".
 * If showAuth is true, adds a sign-in call-to-action at the top.
 */

"use client";

import { X, Check, Zap, Crown, LogIn } from "lucide-react";
import type { Tier } from "@/lib/tier-gate";

interface PricingModalProps {
  onClose: () => void;
  currentTier: Tier;
  showAuth?: boolean;
}

const TIERS = [
  {
    id: "free" as Tier,
    label: "Free",
    price: 0,
    note: "Most Popular",
    description: "Small monthly limits for basic usage. Basic models only.",
    features: ["50 messages/month", "Basic models", "No web search", "No uploads", "No images"],
    cta: "Current plan",
  },
  {
    id: "pro" as Tier,
    label: "Pro",
    price: 8,
    note: null,
    description: "All models, uploads, search. The sweet spot.",
    features: ["1,000 messages/month", "All models", "Web search", "File uploads", "50 images"],
    cta: "$8/mo",
  },
  {
    id: "premier" as Tier,
    label: "Premier",
    price: 50,
    note: "10× Pro",
    description: "Power user tier with max limits.",
    features: ["15,000 messages/month", "All models", "Web search", "File uploads", "500 images", "5 concurrent images"],
    cta: "$50/mo",
  },
];

function priceLabel(cents: number): string {
  if (cents === 0) return "Free";
  return `$${cents}/mo`;
}

export function PricingModal({ onClose, currentTier, showAuth }: PricingModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-background border border-border rounded-2xl shadow-2xl">
        <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-surface-raised text-text-muted hover:text-text transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold tracking-tight">Choose your plan</h2>
            <p className="text-text-muted text-sm mt-2">Start free. Upgrade when you need more.</p>
          </div>

          {showAuth && (
            <div className="flex items-center gap-3 mb-6 p-4 border border-accent/20 bg-accent/5 rounded-xl">
              <LogIn className="w-5 h-5 text-accent shrink-0" />
              <p className="text-sm text-text-muted">
                You have used all 50 free messages this month.
                <span className="text-text font-medium"> Sign in</span> to continue chatting or upgrade.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {TIERS.map((tier) => {
              const isCurrent = tier.id === currentTier;
              return (
                <div
                  key={tier.id}
                  className={`relative border rounded-xl p-6 flex flex-col ${
                    isCurrent ? "border-accent bg-accent/5" : "border-border bg-surface hover:border-text-muted/30 transition-colors"
                  }`}
                >
                  {tier.note && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] px-3 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                      {tier.note}
                    </span>
                  )}

                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      {tier.id === "premier" && <Crown className="w-5 h-5 text-accent" />}
                      {tier.id === "pro" && <Zap className="w-5 h-5 text-success" />}
                      <h3 className="text-lg font-semibold">{tier.label}</h3>
                    </div>
                    <p className="text-text-muted text-xs">{tier.description}</p>
                  </div>

                  <div className="text-3xl font-bold mb-6">{priceLabel(tier.price)}</div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
                        <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    disabled={isCurrent}
                    onClick={() => console.log("Checkout:", tier.id)}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                      isCurrent
                        ? "bg-accent text-white cursor-default opacity-50"
                        : "bg-surface-raised border border-border text-text hover:bg-accent hover:text-white hover:border-accent"
                    }`}
                  >
                    {isCurrent ? "Current plan" : tier.cta}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
