# NIMBUS — Migration Plan: Proper Cloudflare Agent

> Skip the v0.1 gap-filling. Go straight to extending `AIChatAgent`.

---

## Why

Half the v0.1 gaps exist because we're reimplementing what the Agents SDK already provides:
- D1/KV memory stubs → `this.sql` per-instance SQLite
- Context compilation skipping memory → `this.messages` auto-persisted  
- Custom streaming → WebSocket resumable streams
- No state between invocations → DO hibernation + state

The `.use(plugin)` pattern is the only thing worth keeping. Everything else is simpler when backed by a real Durable Object.

---

## Architecture After Migration

```
nimbus-agent/
├── src/
│   ├── nimbus-agent.ts          # NimbusChatAgent extends AIChatAgent
│   ├── plugin.ts                # .use(plugin) logic extracted
│   ├── tools.ts                 # Tool execution engine (keep)
│   ├── errors.ts                # Error hierarchy (keep)
│   ├── types.ts                 # Public types (keep, trim stale ones)
│   ├── models/
│   │   ├── workers-ai.ts        # workersAI() factory (keep)
│   │   └── unified.ts           # unified() factory (keep)
│   ├── presets/
│   │   ├── http.ts              # httpTools (implement for real)
│   │   └── data.ts              # dataTools (implement for real)
│   ├── testing/
│   │   └── mock.ts             # mockModel (keep)
│   └── index.ts                 # Public exports
├── tests/
│   ├── unit/
│   │   ├── nimbus-agent.test.ts # Agent class tests
│   │   ├── plugin.test.ts       # Plugin chain tests
│   │   └── models.test.ts       # Model resolver tests (keep)
│   └── e2e/
│       └── e2e.test.ts           # Full loop tests
├── wrangler.jsonc                # DO bindings + AI binding
└── package.json                  # agents + @cloudflare/ai-chat deps
```

---

## What We Keep

| Module | Why |
|--------|-----|
| `.use(plugin)` + `NimbusPlugin` type | The core architecture — plugins add tools + instructions |
| Tool execution engine (`tools.ts`) | Zod validation, ToolResult, error handling — works great |
| Model resolvers (`workersAI()`, `unified()`) | Parse/validate model refs — reused in `onChatMessage` |
| Error hierarchy | Same classes, just thrown from different places |
| Mock model + `registerMockResponses` | Testing infrastructure — adapt to class-based agent |
| Types (ToolDef, ToolCall, ToolResult, NimbusPlugin, NimbusTrace) | Exact same shapes |
| Trace structure | Still produce NimbusTrace[] — just now persisted via `this.sql` |

## What Dies

| Module | Why |
|--------|-----|
| `createNimbus()` factory | Replaced by `class extends NimbusChatAgent` |
| `nimbus.ts` (entire file) | Factory + mock loop → class-based agent |
| `run.ts` | Custom model loop → `onChatMessage` + AI SDK `streamText` |
| `context.ts` | Memory/compaction → `this.messages` + `pruneMessages` |
| `memory/d1.ts` | Replaced by `this.sql` |
| `memory/kv.ts` | Replaced by `this.sql` |
| `tracing/d1.ts` | Replaced by `this.sql` |
| D1/KV memory interfaces | `MemoryStore` → direct SQL in agent methods |

## What Changes

| Before | After |
|--------|-------|
| `createNimbus({ model }).use(plugin)` | `class MyAgent extends NimbusChatAgent { plugins = [treasuryPlugin] }` |
| `agent.run(question, { env })` | `agent.onChatMessage()` — triggered by `useAgentChat` |
| Manual context compilation | `this.messages` — auto-persisted by AIChatAgent |
| Custom SSE streaming | `streamText().toUIMessageStreamResponse()` |
| No client SDK | `useAgentChat` React hook |
| Cron triggers only | `this.schedule()` / `this.scheduleEvery()` |
| Manual D1 tables | `this.sql` embedded SQLite |

---

## Implementation Steps

### Step 1: Add dependencies

```bash
cd packages/agent
bun add agents @cloudflare/ai-chat
```

Update `wrangler.jsonc` with DO bindings + AI binding + migrations.

### Step 2: Create NimbusChatAgent class

```typescript
// src/nimbus-agent.ts
import { AIChatAgent } from "@cloudflare/ai-chat";
import { streamText, convertToModelMessages, tool as aiTool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { NimbusPlugin, ToolDef, NimbusTrace, ToolCall, ToolResult } from "./types";

export class NimbusChatAgent extends AIChatAgent {
  // Plugin registry
  private _plugins: NimbusPlugin[] = [];
  private _tools: Record<string, ToolDef> = {};
  private _instructions: string = "";

  maxPersistedMessages = 200;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  /** Add a plugin. Call in constructor or before super(). */
  use(plugin: NimbusPlugin): this {
    this._plugins.push(plugin);
    if (plugin.tools) Object.assign(this._tools, plugin.tools);
    if (plugin.instructions) {
      this._instructions = this._instructions
        ? `${this._instructions}\n\n--- ${plugin.name} ---\n${plugin.instructions}`
        : plugin.instructions;
    }
    return this;
  }

  /** List active plugins */
  plugins(): string[] {
    return this._plugins.map(p => p.name);
  }

  /** Get all tools as AI SDK tool objects */
  protected nimbusTools() {
    const tools: Record<string, ReturnType<typeof aiTool>> = {};
    for (const [name, def] of Object.entries(this._tools)) {
      tools[name] = aiTool({
        description: def.description,
        parameters: def.parameters as any,
        execute: async (args) => {
          const ctx = { env: this.env, step: 0, trace: [], abort: () => {} };
          return def.execute(args, ctx as any);
        },
      });
    }
    return tools;
  }

  async onChatMessage() {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const result = streamText({
      model: workersai(this.modelIdentifier()),
      system: this._instructions || undefined,
      messages: await convertToModelMessages(this.messages),
      tools: this.nimbusTools(),
      maxSteps: this.maxSteps ?? 10,
    });
    return result.toUIMessageStreamResponse();
  }

  /** Override to change model. Default: Workers AI glm-4.7-flash */
  protected modelIdentifier(): string {
    return "@cf/zai-org/glm-4.7-flash";
  }
}
```

### Step 3: Create the Worker entry point

```typescript
// src/worker.ts
import { NimbusChatAgent } from "./nimbus-agent";
import { routeAgentRequest } from "agents";

// User extends NimbusChatAgent with their plugins
export class FederalDataAgent extends NimbusChatAgent {
  constructor(ctx, env) {
    super(ctx, env);
    this.use(treasuryPlugin);
    this.use(weatherPlugin);
  }

  protected modelIdentifier() {
    return "@cf/zai-org/glm-4.7-flash";
  }
}

export default {
  async fetch(request, env) {
    return routeAgentRequest(request, env) || new Response("Not found", { status: 404 });
  },
};
```

### Step 4: Wire wrangler.jsonc

```jsonc
{
  "name": "nimbus-agent",
  "main": "src/worker.ts",
  "ai": { "binding": "AI" },
  "durable_objects": {
    "bindings": [{ "name": "FederalDataAgent", "class_name": "FederalDataAgent" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["FederalDataAgent"] }]
}
```

### Step 5: Testing with `@cloudflare/vitest-pool-workers`

Tests run in the Workers runtime with real DO bindings:

```typescript
// tests/e2e/agent.test.ts
import { describe, it, expect } from "vitest";
import { FederalDataAgent } from "../src/worker";
import { createWorkersAI } from "workers-ai-provider";

describe("NimbusChatAgent", () => {
  it("uses plugins in onChatMessage", async () => {
    const agent = new FederalDataAgent(ctx, env);
    expect(agent.plugins()).toEqual(["nimbus-treasury", "nimbus-weather"]);
  });
});
```

### Step 6: Delete dead code

- Delete `src/core/nimbus.ts` (factory)
- Delete `src/core/run.ts` (custom model loop)
- Delete `src/core/context.ts` (custom context compiler)
- Delete `src/memory/d1.ts`, `src/memory/kv.ts` (broken stubs)
- Delete `src/tracing/d1.ts` (broken stub)
- Keep `src/core/tools.ts` (tool execution)
- Keep `src/core/errors.ts` (error classes)
- Keep `src/models/` (resolvers)
- Keep `src/testing/mock.ts` (adapt for class)
- Keep `src/presets/` (implement for real)
- Keep `src/core/types.ts` (trim stale types like MemoryStore)

### Step 7: Update exports

```typescript
// src/index.ts
export { NimbusChatAgent } from "./nimbus-agent";
export type { NimbusPlugin, ToolDef, ToolCall, ToolResult, ToolContext, NimbusTrace } from "./types";
export { workersAI } from "./models/workers-ai";
export { unified } from "./models/unified";
export { mockModel, registerMockResponses } from "./testing/mock";
export { httpTools } from "./presets/http";
export { dataTools } from "./presets/data";
```

---

## Risk / Open Questions

1. **`use()` in constructor** — Agents SDK recommends setting up state in `onStart()`, not constructor. May need to defer plugin registration. Check if `.use()` in constructor works with DO hibernation.

2. **Testing** — `@cloudflare/vitest-pool-workers` can test DOs, but it's heavier than pure unit tests. Keep mock model for fast unit tests of tool execution logic.

3. **`maxSteps` in `streamText`** — The AI SDK's built-in `maxSteps` handles the tool-call loop. This replaces our custom `runMockLoop`. Need to verify it works identically.

4. **Tracing** — `NimbusTrace[]` is still valuable for observability, but the AI SDK doesn't produce our trace format natively. Need to hook into `onChunk` / `onFinish` callbacks to build traces.

5. **`this.env.AI` availability** — Workers AI binding is required. If someone wants to run without it (e.g., dev mode with mock), need a fallback path.

---

## Timeline Estimate

| Step | Time | Depends on |
|------|------|------------|
| Add deps + wrangler config | 15 min | — |
| NimbusChatAgent class | 2 hr | AI SDK tool calling patterns |
| Worker entry point + routing | 30 min | NimbusChatAgent |
| Wire testing | 1 hr | vitest-pool-workers setup |
| Delete dead code + update exports | 1 hr | New class working |
| Adapt mock model | 1 hr | New class API |
| Update Spec.md | 30 min | Implementation done |
| **Total** | **~6 hr** | |