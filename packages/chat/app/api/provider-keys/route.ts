/**
 * API: /api/provider-keys
 *
 * BYOK (Bring Your Own Key) management.
 * Users can add their OpenAI, Anthropic, Google, Groq, DeepSeek API keys.
 * When a key is present, AI calls route to their provider instead of Workers AI.
 */

import { NextRequest, NextResponse } from "next/server";

// In production, validate Clerk session here
function getUserId(req: NextRequest): string | null {
  // TODO: Replace with Clerk auth validation
  // const { userId } = await auth();
  const header = req.headers.get("x-nimbus-user-id");
  return header;
}

/**
 * GET /api/provider-keys
 * List all provider keys for the current user (key names only, not values)
 */
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Fetch from agent worker (which has D1 access)
    const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL;
    const res = await fetch(`${agentUrl}/_provider-keys?userId=${encodeURIComponent(userId)}`, {
      method: "GET",
    });

    if (!res.ok) {
      return new NextResponse("Failed to fetch provider keys", { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("Provider keys GET error:", e);
    return new NextResponse("Internal error", { status: 500 });
  }
}

/**
 * POST /api/provider-keys
 * Add or update a provider key for the current user
 *
 * Body: { provider: "openai", apiKey: "sk-..." }
 */
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const { provider, apiKey } = body;

    if (!provider || !apiKey) {
      return new NextResponse("Missing provider or apiKey", { status: 400 });
    }

    const allowedProviders = ["openai", "anthropic", "google", "groq", "deepseek"];
    if (!allowedProviders.includes(provider)) {
      return new NextResponse(`Invalid provider. Allowed: ${allowedProviders.join(", ")}`, { status: 400 });
    }

    // Forward to agent worker for D1 storage
    const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL;
    const res = await fetch(`${agentUrl}/_provider-keys?userId=${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new NextResponse(err || "Failed to store provider key", { status: res.status });
    }

    return NextResponse.json({ success: true, provider });
  } catch (e) {
    console.error("Provider keys POST error:", e);
    return new NextResponse("Internal error", { status: 500 });
  }
}
