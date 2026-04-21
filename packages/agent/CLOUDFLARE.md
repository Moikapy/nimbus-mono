# Deploying Nimbus on Cloudflare Workers

> Get an AI agent running on the edge in 5 minutes.

## Overview

Nimbus on Cloudflare uses **`NimbusChatAgent`** — it extends `AIChatAgent` from the Agents SDK. Each agent is a Durable Object with:

- **Per-instance SQLite** — `this.sql` for state, messages, streams
- **WebSocket streaming** — `useAgentChat()` in React connects automatically
- **Hibernation safety** — state survives DO eviction
- **Plugin composition** — `.use(plugin)` for tools + instructions

Prerequisites: `bun`, `wrangler`, a Cloudflare account.

---

## 1. Install

```bash
bun add nimbus-agent
```

Dev dependencies:

```bash
bun add -D wrangler typescript @cloudflare/workers-types vitest
```

---

## 2. Create Your Agent

```typescript
// src/agent.ts
import { NimbusChatAgent } from "nimbus-agent";
import { z } from "zod";

const weatherPlugin = {
  name: "weather",
  description: "Get weather data",
  instructions: "When asked about weather, always use the weather plugin.",
  tools: {
    get_weather: {
      description: "Get current weather for a location",
      parameters: z.object({ city: z.string() }),
      execute: async ({ city }) => {
        const res = await fetch(`https://wttr.in/${city}?format=j1`);
        return res.json();
      },
    },
  },
};

export class WeatherAgent extends NimbusChatAgent {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.use(weatherPlugin);
  }

  /**
   * Tell Nimbus which model to use.
   * Runs on Workers AI (free tier: 10k req/day).
   */
  resolveModel() {
    return this.workersAI("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  }
}
```

---

## 3. Worker Entry Point

```typescript
// src/worker.ts
import { routeAgentRequest } from "agents";
import { WeatherAgent } from "./agent";

export { WeatherAgent };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Route /agents/:name and WebSocket upgrades to the DO
    const response = await routeAgentRequest(request, env);
    if (response) return response;

    // Fallback: health check
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return Response.json({ status: "ok", agent: "WeatherAgent" });
    }

    return new Response("Not Found", { status: 404 });
  },
};
```

---

## 4. Wrangler Config

```jsonc
// wrangler.jsonc
{
  "name": "weather-agent",
  "main": "src/worker.ts",
  "compatibility_date": "2025-04-20",
  "compatibility_flags": ["nodejs_compat"],

  // Workers AI binding (free tier)
  "ai": {
    "binding": "AI"
  },

  // Durable Object definition
  "durable_objects": {
    "bindings": [
      {
        "name": "WeatherAgent",
        "class_name": "WeatherAgent"
      }
    ]
  },

  // Migrations (required for Durable Objects)
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["WeatherAgent"]
    }
  ]
}
```

---

## 5. Type Definitions

```typescript
// src/types.ts
export interface Env {
  AI: Ai;
  WeatherAgent: DurableObjectNamespace<WeatherAgent>;
}
```

If you don't have `@cloudflare/workers-types`, add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  }
}
```

---

## 6. Deploy

```bash
# Authenticate (one-time)
wrangler login

# Deploy
wrangler deploy

# Watch logs
wrangler tail
```

Your agent is live at `https://weather-agent.your-subdomain.workers.dev`.

---

## 7. Connect a React Client

The Agents SDK provides `useAgentChat()` — it works identically with Nimbus.

```tsx
// app/page.tsx
import { useAgentChat } from "@cloudflare/ai-chat";

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit } = useAgentChat({
    agent: "WeatherAgent",
    host: "wss://weather-agent.your-subdomain.workers.dev",
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id} className={m.role}>
          {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="Ask about weather..." />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

That's it. The client speaks the same wire protocol whether backend is Cloudflare or local Bun.

---

## Model Providers

### Workers AI (default, free)

```typescript
resolveModel() {
  return this.workersAI("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
}
```

No API key. 10k requests/day on free tier. [Model list](https://developers.cloudflare.com/workers-ai/models/)

### AI Gateway (any provider)

```typescript
resolveModel() {
  return this.unified("openai/gpt-4o", {
    gateway: {
      accountId: "your-account-id",
      gateway: "your-gateway-name",
      apiKey: "your-gateway-key", // stored in gateway, not in code
    },
  });
}
```

---

## Multiple Agents

```typescript
// src/worker.ts
import { routeAgentRequest } from "agents";
import { WeatherAgent } from "./weather-agent";
import { FinanceAgent } from "./finance-agent";

export { WeatherAgent, FinanceAgent };

export default {
  async fetch(request, env) {
    return (await routeAgentRequest(request, env))
      || new Response("Not Found", { status: 404 });
  },
};
```

```jsonc
// wrangler.jsonc
{
  "durable_objects": {
    "bindings": [
      { "name": "WeatherAgent", "class_name": "WeatherAgent" },
      { "name": "FinanceAgent", "class_name": "FinanceAgent" }
    ]
  },
  "migrations": [
    { "tag": "v1", "new_classes": ["WeatherAgent", "FinanceAgent"] }
  ]
}
```

Each agent class gets its own Durable Object namespace. Clients connect to `/agents/WeatherAgent/:sessionId` or `/agents/FinanceAgent/:sessionId`.

---

## Environment Variables

Sensitive config goes in `wrangler secret`:

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
```

Access in your agent:

```typescript
resolveModel() {
  const key = this.env.OPENAI_API_KEY;
  return this.unified("openai/gpt-4o", { apiKey: key });
}
```

---

## Testing

```bash
# Unit tests (no DO required)
npx vitest run tests/unit/

# E2E tests (requires wrangler dev)
npx vitest run --config vitest.config.e2e.ts tests/e2e/
```

---

## Architecture Reminder

```
Client (useAgentChat)
    ↓ WebSocket
Cloudflare Edge
    ↓ Upgrade
Durable Object (NimbusChatAgent)
    ├── SQLite (this.sql) — messages, state, streams
    ├── AI SDK streamText() — model + tools
    └── Plugins — .use(plugin) merges tools + instructions
```

The Durable Object is the unit of compute. One chat session = one DO instance. It hibernates when idle, wakes on WebSocket message. State persists in SQLite across evictions.

---

*Deploy in 5 minutes. Scale to millions. Pure of heart.* ☁️⚡
