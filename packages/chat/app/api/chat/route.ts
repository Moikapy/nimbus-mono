/**
 * API: /api/chat
 * Proxies streaming requests to the standalone NimbusChatAgent Worker.
 * Passes userId (anonymous fingerprint or Clerk ID) in the URL.
 */

import { NextRequest, NextResponse } from "next/server";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL;

export async function POST(req: NextRequest) {
  if (!AGENT_URL) {
    return new NextResponse("Agent URL not configured", { status: 500 });
  }

  try {
    const body = await req.json();
    const userId = body.userId || body.anonId || "anon:guest";

    // Clean up body before forwarding
    const { userId: _u, anonId: _a, ...agentBody } = body;

    const res = await fetch(`${AGENT_URL}?userId=${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agentBody),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(err || "Agent error", { status: res.status });
    }

    // Stream back to client
    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("Chat proxy error:", e);
    return new NextResponse("Internal error", { status: 500 });
  }
}
