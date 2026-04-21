/**
 * UsageBadge — Shows remaining messages for the current user.
 */

"use client";

import { useEffect, useState } from "react";
import type { Tier } from "@/lib/tier-gate";

interface UsageBadgeProps {
  tier: Tier;
}

export function UsageBadge({ tier }: UsageBadgeProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const limit = tier === "premier" ? 15000 : tier === "pro" ? 1000 : 50;

  useEffect(() => {
    // Poll usage from agent periodically (simplified)
    // In production: read from agent response headers or a dedicated /api/usage endpoint
    const stored = sessionStorage.getItem("nimbus_remaining_msgs");
    if (stored) setRemaining(parseInt(stored, 10));
  }, []);

  const used = remaining !== null ? limit - remaining : null;
  const pct = used !== null ? (used / limit) * 100 : 0;

  let color = "text-text-muted";
  if (pct >= 90) color = "text-danger";
  else if (pct >= 60) color = "text-warning";

  return (
    <div className="flex items-center gap-2">
      <div className={`text-xs font-medium ${color}`}>
        {remaining !== null ? `${remaining} / ${limit}` : `${limit} free`}
      </div>
      {remaining !== null && (
        <div className="w-12 h-1 bg-surface-raised rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: pct >= 90 ? "var(--color-danger)" : pct >= 60 ? "var(--color-warning)" : "var(--color-success)",
            }}
          />
        </div>
      )}
    </div>
  );
}
