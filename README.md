# Nimbus ☁️⚡

> *The golden cloud that only the pure of heart can ride.*

Nimbus is the **Cloudflare agent harness** — everything except the model. Built on the Agents SDK, wired through AI Gateway, fast as Kintoun.

## What is Nimbus?

An **agent harness** is the complete architectural system surrounding an LLM that manages the lifecycle of context: from intent capture through tool execution, verification, and persistence. Nimbus handles everything except the model itself — tools, memory, context, verification, and state.

You extend `NimbusChatAgent`, add plugins for your domain with `.use(plugin)`, and deploy. No building agent loops from scratch. No vendor lock-in.

```typescript
import { NimbusChatAgent } from "nimbus-agent";
import { treasuryPlugin } from "nimbus-treasury";

export class FederalDataAgent extends NimbusChatAgent {
  constructor(ctx, env) {
    super(ctx, env);
    this.use(treasuryPlugin);
  }
}
```

That's it. One harness. Add plugins. Ship.

## Why "Nimbus"?

Goku's Flying Nimbus (筋斗雲, Kintoun) is a magical golden cloud. It's fast, it goes anywhere, and **only the pure of heart can ride it**. That's the philosophy:

- **Pure of heart** — Nimbus refuses harmful requests. Guard rails aren't optional, they're identity.
- **Rides the cloud** — Born on Cloudflare's Agents SDK. Per-instance SQLite, WebSocket streaming, hibernation safety.
- **Goes anywhere** — Workers AI, AI Gateway, OpenAI, Anthropic — one interface, any model.
- **One harness, many riders** — The harness is the cloud. Plugins are the passengers.

## Architecture

```
NimbusChatAgent (the harness ☁️)
├── extends AIChatAgent (Agents SDK)
│   ├── Per-instance SQLite (this.sql)
│   ├── Message persistence (this.messages)
│   ├── WebSocket streaming (resumable)
│   ├── Hibernation safety (state survives eviction)
│   └── useAgentChat (React hook)
├── .use(plugin) (the composition layer)
│   ├── Plugin tools → AI SDK tool() format
│   ├── Plugin instructions → system prompt merge
│   └── Plugin MCP servers → tool discovery
├── Tool execution (Zod validation + error feedback)
├── Model providers (which wind you ride)
│   ├── Workers AI (default — Cloudflare native)
│   └── AI Gateway (unified — any provider)
└── Presets (pre-built tools)
    ├── httpTools ← domain-allowlisted fetch
    └── dataTools ← filter, sort, aggregate
```

## Quick Start

### Install

```bash
bun add nimbus-agent
```

### Create an Agent

```typescript
import { NimbusChatAgent } from "nimbus-agent";
import { treasuryPlugin } from "nimbus-treasury";

// Extend the harness, add plugins
export class MyAgent extends NimbusChatAgent {
  constructor(ctx, env) {
    super(ctx, env);
    this.use(treasuryPlugin);
  }
}
```

### Add a Custom Plugin

```typescript
// A plugin is just { name, tools, instructions }
const myPlugin = {
  name: "my-tools",
  description: "Custom tools for my app",
  instructions: "When answering questions about X, always cite the source.",
  tools: {
    lookup_data: {
      description: "Look up data from my API",
      parameters: z.object({ query: z.string() }),
      execute: async (params, ctx) => fetch(`/api/data?q=${params.query}`).then(r => r.json()),
    },
  },
};

// Use it
this.use(myPlugin);
```

### Deploy

```typescript
// src/worker.ts
import { NimbusChatAgent } from "nimbus-agent";
import { routeAgentRequest } from "agents";

export class MyAgent extends NimbusChatAgent {
  constructor(ctx, env) { super(ctx, env); this.use(treasuryPlugin); }
}

export default {
  async fetch(request, env) {
    return routeAgentRequest(request, env) || new Response("Not found", { status: 404 });
  },
};
```
console.log(result.data);     // Raw data from tools
console.log(result.steps);    // How many tool-call iterations
console.log(result.tokens);   // Token usage
console.log(result.duration); // Time in ms
```

## Model Providers

### Workers AI (default)

Uses the `env.AI` binding in Cloudflare Workers. No API key needed.

```typescript
createNimbus({
  model: "workers-ai:@cf/zai-org/glm-4.7-flash",
});
```

### AI Gateway (unified)

Route any provider through Cloudflare AI Gateway. BYOK — bring your own keys, stored in the gateway.

```typescript
createNimbus({
  model: "unified:openai/gpt-5.2",
  gateway: {
    accountId: "your-account-id",
    gateway: "your-gateway-id",
    apiKey: "your-gateway-key",
  },
});
```

### Fallback Chain

Try the primary model, fall back if it fails:

```typescript
createNimbus({
  model: "unified:anthropic/claude-4-5-sonnet",
  fallbacks: ["workers-ai:@cf/zai-org/glm-4.7-flash"],
});
```

## Memory

### In-Memory (dev/test)

```typescript
import { inMemory } from "nimbus-agent/memory";

createNimbus({
  model: "workers-ai:...",
  memory: inMemory(),
});
```

### D1 (production)

```typescript
import { d1Memory } from "nimbus-agent/memory";

createNimbus({
  model: "workers-ai:...",
  memory: d1Memory(env.DB),
});
```

### KV (edge cache)

```typescript
import { kvMemory } from "nimbus-agent/memory";

createNimbus({
  model: "workers-ai:...",
  memory: kvMemory(env.CACHE),
});
```

## Preset Tools

### HTTP Tools

```typescript
import { httpTools } from "nimbus-agent/presets";

const nimbus = createNimbus({
  model: "workers-ai:...",
}).use({
  name: "http",
  tools: httpTools({ allowedDomains: ["api.example.com"] }),
});
```

### Data Tools

Filter, sort, aggregate, top-N tools for data the model already has:

```typescript
import { dataTools } from "nimbus-agent/presets";

// Adds data_filter, data_sort, data_aggregate, data_top
```

## Plugin API

A plugin adds tools, instructions, and/or MCP servers to the agent:

```typescript
interface NimbusPlugin {
  name: string;
  description?: string;
  tools?: Record<string, ToolDef>;
  mcpServers?: McpServerConfig[];
  instructions?: string;  // Added to the system prompt when this plugin is active
}
```

Chain them:

```typescript
const nimbus = createNimbus({ model, instructions })
  .use(treasuryPlugin)    // federal data tools
  .use(searchPlugin)      // web search
  .use(weatherPlugin);    // weather data

console.log(nimbus.plugins());
// ["nimbus-treasury", "nimbus-search", "nimbus-weather"]
```

Each plugin's instructions are appended to the system prompt under a `--- plugin-name ---` header. Tools merge. MCP servers accumulate. No conflicts, no overwrites.

## The Pure of Heart Clause

Nimbus refuses to:

- **Harm people** — no weapons, no surveillance, no exploitation
- **Deceive or manipulate** — no disinformation, no social engineering
- **Violate privacy** — no unauthorized data collection, no stalking
- **Build systems for evil** — even if profitable

This isn't a feature. It's identity. The Flying Nimbus only carries the pure of heart. If you can't ride it, the problem isn't the cloud.

## Deploying on Cloudflare

### Wrangler Setup

```jsonc
// wrangler.jsonc
{
  "ai": { "binding": "AI" },
  "d1_databases": [{ "binding": "DB", "database_name": "nimbus-db" }],
  "kv_namespaces": [{ "binding": "CACHE", "id": "your-kv-id" }]
}
```

### Worker Entry

```typescript
import { createNimbus } from "nimbus-agent";

export default {
  async fetch(request: Request, env: Record<string, unknown>) {
    const nimbus = createNimbus({
      model: "workers-ai:@cf/zai-org/glm-4.7-flash",
      memory: d1Memory(env.DB as D1Database),
    }).use(myPlugin);

    const { searchParams } = new URL(request.url);
    const question = searchParams.get("q") ?? "Hello";
    const result = await nimbus.run(question, { env });

    return Response.json(result);
  },
};
```

## API Reference

### `createNimbus(config)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | *required* | Model reference (e.g. `workers-ai:@cf/...` or `unified:provider/model`) |
| `instructions` | `string` | `""` | System prompt |
| `tools` | `Record<string, ToolDef>` | `{}` | Inline tool definitions |
| `mcpServers` | `McpServerConfig[]` | `[]` | Remote MCP tool servers |
| `fallbacks` | `string[]` | `[]` | Fallback model references |
| `memory` | `MemoryStore` | `null` | Conversation memory store |
| `tracing` | `TraceStore` | `null` | Trace storage |
| `context` | `object` | `{history:10, memory:true, maxContextTokens:8000, compaction:"summarize"}` | Context window config |
| `maxSteps` | `number` | `10` | Max tool-call iterations |
| `maxTokens` | `number` | `4096` | Max output tokens |
| `timeout` | `number` | `30000` | Request timeout (ms) |
| `retries` | `number` | `1` | Model call retries |
| `retryDelay` | `number` | `1000` | Retry delay (ms) |

### `nimbus.run(question, options?)`

Returns `Promise<NimbusResult>`:

| Field | Type | Description |
|-------|------|-------------|
| `answer` | `string` | The agent's final response |
| `data` | `unknown[]` | Raw data collected from tool calls |
| `sources` | `NimbusSource[]` | Which tools were used and what they returned |
| `trace` | `NimbusTrace[]` | Full execution trace for debugging |
| `model` | `string` | Which model was used |
| `steps` | `number` | Tool-call iterations executed |
| `tokens` | `{input, output, total}` | Token usage estimate |
| `duration` | `number` | Total execution time (ms) |

### `nimbus.use(plugin)`

Add a plugin. Returns `Nimbus` for chaining.

### `nimbus.plugins()`

List active plugin names.

## License

MIT

---

*Born on the cloud. Pure of heart. Fast as Kintoun.* ☁️⚡