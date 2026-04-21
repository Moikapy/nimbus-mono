# Nimbus ☁️⚡

> *The golden cloud that only the pure of heart can ride.*

Nimbus is the **AI agent harness** — everything except the model. One harness, many plugins. Run on Cloudflare or locally.

## Install

```bash
bun add nimbus-agent
```

## Two Runtimes, Same Code

### Cloudflare Workers (Production)

```typescript
import { NimbusChatAgent } from "nimbus-agent";

export class MyAgent extends NimbusChatAgent {
  resolveModel() {
    return this.workersAI("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  }
}
```

See [`CLOUDFLARE.md`](./CLOUDFLARE.md) for full deployment guide.

### Local Bun (Development)

```typescript
import { NimbusLocal, serve, SqliteSessionStore } from "nimbus-agent/local";

const store = new SqliteSessionStore({ filename: "./sessions.db" });

serve({ agent: MyLocalAgent, store, port: 8787 });
```

Same plugins. Same wire protocol. Same client hooks.

---

## Quick Start: Plugin

```typescript
import { z } from "zod";

const myPlugin = {
  name: "my-tools",
  description: "Custom tools",
  instructions: "When answering questions about X, always cite the source.",
  tools: {
    lookup: {
      description: "Look up data",
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ result: query.toUpperCase() }),
    },
  },
};

// Use it
agent.use(myPlugin);
```

---

## Quick Start: Model

### Workers AI (Cloudflare, free tier)

```typescript
resolveModel() {
  return this.workersAI("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
}
```

### AI Gateway (any provider)

```typescript
resolveModel() {
  return this.unified("openai/gpt-4o", {
    gateway: { accountId: "...", gateway: "...", apiKey: "..." },
  });
}
```

### Ollama (local)

```typescript
import { createOllama } from "ollama-ai-provider-v2";
const ollama = createOllama({ baseURL: "http://localhost:11434/api" });

resolveModel() {
  return ollama("llama3.2:latest");
}
```

---

## Preset Tools

```typescript
import { httpTools, dataTools } from "nimbus-agent/presets";

agent.use({ name: "http", tools: httpTools({ allowedDomains: ["api.example.com"] }) });
agent.use({ name: "data", tools: dataTools });
```

---

## Architecture

```
NimbusBase (shared)
├── .use(plugin) — composition
├── .plugins() — list active
├── .nimbusTools() — merged tool schemas
└── getSystemInstructions() — merged prompts

NimbusChatAgent (Cloudflare)
├── extends AIChatAgent (Agents SDK)
├── Per-instance SQLite (this.sql)
├── WebSocket streaming (resumable)
└── Hibernation safety

NimbusLocal (Bun/Node)
├── SessionStore interface
├── SqliteSessionStore / FileSessionStore
├── Bun.serve WebSocket server
└── Same wire protocol as Cloudflare
```

---

## The Pure of Heart Clause

Nimbus refuses to harm people, deceive, violate privacy, or build systems for evil. This isn't a feature — it's identity. The Flying Nimbus only carries the pure of heart.

---

## Status

| | |
|---|---|
| Version | `0.2.0-alpha.1` |
| Install | `npm install nimbus-agent@alpha` |
| Tests | 61 passing |
| Cloudflare | ✅ Durable Objects + Workers AI |
| Local | ✅ Bun + SQLite + WebSocket |
| Ollama | ✅ `ollama-ai-provider-v2` |

## License

MIT

---

*Born on the cloud. Pure of heart. Fast as Kintoun.* ☁️⚡
