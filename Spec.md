# NIMBUS — Spec.md

> The Cloudflare agent harness. Everything except the model.

---

## 1. Overview

### 1.1 Purpose

NIMBUS is a **Cloudflare agent harness** — the complete architectural system surrounding an LLM that manages the lifecycle of context: from intent capture through tool execution, verification, and persistence. It handles everything except the model itself.

An agent harness is not an agent. It's the infrastructure that *makes agents work*: tool execution, memory, context compilation, verification, and state. The model is the brain. The harness is everything else — the hands, the eyes, the memory, the guardrails.

Built on the Cloudflare Agents SDK (`AIChatAgent`), NIMBUS gives you per-instance SQLite, WebSocket persistence, resumable streaming, hibernation safety, and scheduling for free. The `.use(plugin)` pattern is how you add domain-specific tools and instructions — each plugin wires in a capability without rewriting the agent loop.

The harness often determines real-world effectiveness far more than incremental model gains. That's why `.use(plugin)` matters: it's how you give the model domain-specific tools, not just a bigger brain.

### 1.2 Target Users

| User | What they build |
|------|----------------|
| Cloudflare Workers developers | Data-querying agents, research bots, autonomous monitors |
| Cloudflare Agents SDK users | AIChatAgent subclasses with plugin-based tools and context |
| API builders | x402-gated NL query endpoints, semantic search services |
| Internal tool teams | Multi-step research agents, report generators, alert systems |
| Plugin authors | Domain-specific tool packages (treasury, weather, etc.) |

### 1.3 Out of Scope (0.x)

- **No model.** The harness wraps around a model — any model. It doesn't ship one, fine-tune one, or depend on a specific one.
- **No UI.** No chat interface, no React hooks (the Agents SDK provides `useAgentChat`).
- **No x402 or payments.** Payment gating is an app-level concern, not a harness concern.
- **No browser automation.** No headless Chrome, no Playwright. Give your agent HTTP tools instead.
- **No auth/user management.** The harness doesn't know who's calling. Identity is your problem.
- **No model training or fine-tuning.** We use pre-trained models.
- **No orchestration engine.** The harness executes tool calls; it doesn't decompose tasks or coordinate multiple agents. That's the orchestrator's job.

### 1.4 Design Principles

| Principle | Guideline |
|-----------|-----------|
| **Harness, not agent** | The harness wraps around any model. It doesn't replace the model, it empowers it. You bring the model; the harness provides tools, memory, verification, and persistence. |
| **One API: Workers AI + AI Gateway** | All models go through AI Gateway. Workers AI models are free/default. OpenAI/Anthropic/others route through the same gateway via unified API. One endpoint, any model. |
| **Plugins, not inheritance** | `.use(plugin)` adds tools. No class hierarchies beyond AIChatAgent. Domain logic ships as plugins, not agent subclasses. |
| **Tools as data, not code** | Tools are declared as JSON schema + handler functions. The model sees the schema. The harness executes the handler. No prompt injection, no eval, no code generation for tool calls. |
| **Fail visibly** | Every step produces a trace. Every tool call is logged. Every error has context. When an agent fails, you can see exactly where and why. |
| **Verify, don't trust** | Zod validates every tool call before execution. Malformed model outputs get caught. Errors feed back to the model for retry. |
| **Cloudflare-first** | Per-instance SQLite via AIChatAgent. Works best with D1/KV/Vectorize bindings. Falls back to in-memory when bindings aren't available. |

### 1.5 Harness Components

From [the agent harness definition](https://parallel.ai/articles/what-is-an-agent-harness): "the complete architectural system surrounding an LLM that manages the lifecycle of context: from intent capture through specification, compilation, execution, verification, and persistence."

| Harness Component | Nimbus Implementation | Source |
|-----------------|---------------------|--------|
| **Tool integration layer** | `.use(plugin)` + `nimbusTools()` → AI SDK `tool()` | Nimbus |
| **Tool call execution** | AI SDK built-in tool loop in `streamText({ tools })` | AI SDK |
| **Memory & state management** | `this.messages` + `this.sql` per-instance SQLite | Agents SDK |
| **Context compilation** | `this.messages` auto-persisted + `system` prompt from plugins | Agents SDK |
| **Context compaction** | `pruneMessages()` + `maxPersistedMessages` | AI SDK + Agents SDK |
| **Verification & guardrails** | Zod validation on every tool call, error feedback loop | Nimbus |
| **Long-horizon task management** | `this.schedule()`, `this.sql` state, hibernation safety | Agents SDK |
| **Completion & handoff** | Message persistence across sessions, WebSocket reconnection | Agents SDK |
| **Client SDK** | `useAgentChat` React hook | Agents SDK |

**~30% Nimbus, ~70% provided by Cloudflare's platform.** The harness is lean because the platform handles persistence, streaming, and state. Nimbus adds the domain composition layer (`.use(plugin)`), verification (Zod), and model resolution.

---

## 2. Package

### 2.1 Install

```bash
bun add nimbus-agent
# or
npm install nimbus-agent
```

### 2.2 Exports

```typescript
// Main entry
export { createNimbus } from "nimbus-agent";

// Types
export type {
  Nimbus,
  NimbusConfig,
  NimbusResult,
  NimbusTrace,
  NimbusPlugin,
  ToolDef,
  ToolCall,
  ToolResult,
  ToolContext,
  McpServerConfig,
  ResolvedTool,
  MemoryStore,
  TraceStore,
  ModelRef,
  Message,
  StreamChunk,
} from "nimbus-agent";

// Model providers
export { workersAI } from "nimbus-agent/models";
export { unified } from "nimbus-agent/models";

// Memory stores
export { d1Memory } from "nimbus-agent/memory";
export { kvMemory } from "nimbus-agent/memory";
export { inMemory } from "nimbus-agent/memory";

// Persistence
export { d1TraceStore } from "nimbus-agent/tracing";

// Testing
export { mockModel, registerMockResponses } from "nimbus-agent/testing";
export type { MockModelResponse } from "nimbus-agent/testing";

// Presets (pre-built tool sets for common patterns)
export { httpTools } from "nimbus-agent/presets";
export { dataTools } from "nimbus-agent/presets";
```

### 2.3 Environment

| Requirement | Value |
|------------|-------|
| Runtime | Cloudflare Workers (V8 isolates) — primary |
| Fallback | Bun / Node 18+ (dev mode, in-memory stores) |
| AI Provider | Workers AI binding OR AI Gateway unified API |
| Storage (optional) | D1, KV, Vectorize bindings |

---

## 3. Client API

### 3.1 Creating a Nimbus

```typescript
import { createNimbus, workersAI } from "nimbus-agent";
import { z } from "zod";

// Minimal: just a model
const agent = createNimbus({
  model: workersAI("@cf/zai-org/glm-4.7-flash"),
  instructions: "You analyze federal data.",
});

// Full config with tools, memory, and gateway
const agent = createNimbus({
  model: workersAI("@cf/zai-org/glm-4.7-flash"),

  // AI Gateway for caching, rate limiting, logging
  gateway: {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    gateway: "my-gateway",
    apiKey: env.CF_AIG_TOKEN,
  },

  instructions: "You are a federal spending data analyst.",

  tools: {
    treasury_debt: {
      description: "Get current U.S. national debt figures",
      parameters: z.object({ filter_date: z.string().optional() }),
      execute: async (params, ctx) => fetchTreasuryDebt(params.filter_date, ctx.env.DB),
    },
  },

  memory: d1Memory({ binding: "DB" }),
  tracing: d1TraceStore({ binding: "DB" }),
  maxSteps: 10,
  maxTokens: 4096,
  timeout: 30_000,
});
```

### 3.2 Adding Plugins — `.use(plugin)`

The `.use(plugin)` method is the *entire architecture*. Each plugin adds tools, instructions, and MCP servers. Chain them:

```typescript
import { createNimbus } from "nimbus-agent";
import { treasuryPlugin } from "nimbus-treasury";
import { weatherPlugin } from "nimbus-weather";

const nimbus = createNimbus({
  model: "mock",  // or workersAI("@cf/zai-org/glm-4.7-flash")
  instructions: "You are a data analyst.",
}).use(treasuryPlugin)
 .use(weatherPlugin);

console.log(nimbus.plugins()); // ["nimbus-treasury", "nimbus-weather"]
```

**Plugin interface:**

```typescript
interface NimbusPlugin {
  /** Plugin name (e.g. 'nimbus-treasury') */
  name: string;
  /** What this plugin provides */
  description?: string;
  /** Tools this plugin adds */
  tools?: Record<string, ToolDef>;
  /** MCP servers this plugin connects to */
  mcpServers?: McpServerConfig[];
  /** Additional system instructions when using this plugin */
  instructions?: string;
}
```

When you call `.use(plugin)`: tools get merged into the agent's tool registry, MCP servers are appended, and instructions are appended with a `--- plugin-name ---` separator. This is how projects like `nimbus-treasury` ship domain logic without creating separate agent classes.

### 3.3 Running a Nimbus

```typescript
const result = await nimbus.run("What is the current national debt per capita?", {
  env,                  // Cloudflare env (bindings)
  conversationId: "c1", // Optional: group messages for memory
});

// result.answer     → string: the model's final answer
// result.data       → unknown[]: structured data from tool results
// result.sources    → NimbusSource[]: which tools were called and what params
// result.trace      → NimbusTrace[]: full execution trace
// result.model      → string: which model was used
// result.cached     → boolean: served from AI Gateway cache?
// result.steps      → number: how many tool-call loops
// result.tokens     → { input, output, total }
// result.duration   → number: ms total
```

### 3.4 Multi-Step Execution (Automatic)

The harness handles the tool-call loop automatically:

```
User question
  ↓
Model call (generates tool calls)
  ↓
Harness parses tool calls from model output
  ↓
Harness executes each tool (Zod-validated handler)
  ↓
Harness feeds tool results back into model context
  ↓
Model call (may generate more tool calls OR final answer)
  ↓
... repeat until maxSteps or model gives final answer
  ↓
NimbusResult
```

### 3.5 Streaming

```typescript
const stream = await nimbus.stream("Explain the deficit trend", { env });

for await (const chunk of stream) {
  // chunk.type: "text" | "tool_call" | "tool_result" | "done"
  // chunk.content: string (for text) | ToolCall/ToolResult (for tool events)
  console.log(chunk);
}

const result = stream.result; // Final NimbusResult after stream completes
```

### 3.5 Context Management

The harness compiles the working context for each model call:

```typescript
const agent = createNimbus({
  model: workersAI("@cf/zai-org/glm-4.7-flash"),
  instructions: "You analyze federal data.",
  tools: { /* ... */ },

  // Context window configuration
  context: {
    // Include recent conversation history
    history: 10,           // Last N messages

    // Include memory summaries from previous conversations
    memory: true,

    // Max tokens for compiled context (leave room for model output)
    maxContextTokens: 8000,

    // Compaction: when context exceeds maxContextTokens, summarize older messages
    compaction: "summarize",  // "summarize" | "truncate" | "none"
  },
});
```

**Compaction strategies:**
- **summarize** (default): Older messages get summarized into a single "Previous context: ..." message. Best for long conversations.
- **truncate**: Drop oldest messages until within budget. Simple, loses information.
- **none**: Send full history. May exceed model context window → error.

### 3.6 Memory

```typescript
import { d1Memory, kvMemory, inMemory } from "@0xkobold/nimbus/memory";

// D1-backed: persists across Worker invocations, survives deploys
const memory = d1Memory({
  binding: "DB",
  ttl: 86400,    // Summaries expire after 24h
});

// KV-backed: fast reads, good for session state
const memory = kvMemory({
  binding: "CACHE",
  ttl: 3600,
});

// In-memory: dev mode, no bindings needed
const memory = inMemory();
```

**What memory stores:**
- Conversation summaries (compacted from previous sessions)
- Per-conversation tool call history (for "what did you look up last time?")
- User preferences learned from conversation patterns (optional)

### 3.7 Tracing

Every Nimbus run produces a trace — the full record of what happened:

```typescript
interface NimbusTrace {
  id: string;               // Unique trace ID
  timestamp: string;        // ISO datetime
  step: number;             // Step number (1 = first model call)
  type: "model_call" | "tool_call" | "tool_result" | "response";
  model: string;            // Which model was called
  input: {
    messages: Message[];     // Full context sent to model
    tools?: ToolSchema[];   // Tool schemas visible to model
  };
  output: {
    text?: string;          // Model's text response
    toolCalls?: ToolCall[];  // Tool calls the model made
  };
  toolResults?: ToolResult[];  // Results from tool execution
  duration: number;         // ms for this step
  tokens: {
    input: number;
    output: number;
  };
  cached: boolean;          // Was this model call served from AI Gateway cache?
}
```

**Why tracing matters:**
- Debug multi-step agent failures ("which tool call returned bad data?")
- Audit AI responses for accuracy ("what data did the model base its answer on?")
- Optimize costs ("which tool calls could be cached?")
- Verify sourcing for x402-gated endpoints ("prove this answer uses real data")

### 3.8 Model Fallbacks

```typescript
const agent = createNimbus({
  // Primary model
  model: workersAI("@cf/zai-org/glm-4.7-flash"),

  // Fallback chain (tries in order if primary fails)
  fallbacks: [
    workersAI("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
    unified("anthropic/claude-4-5-sonnet"),    // Through AI Gateway
  ],

  // Retry on transient errors
  retries: 2,
  retryDelay: 1000,  // ms, exponential backoff
});
```

### 3.9 Tool Design

Tools are the harness's hands. They're declared as JSON schema + handler:

```typescript
interface Tool<TParams, TResult> {
  // What the model sees — used in function calling
  description: string;
  parameters: ZodSchema;           // Zod schema → auto-converted to JSON Schema for model

  // What the model doesn't see — runs server-side
  execute: (params: TParams, ctx: ToolContext) => Promise<TResult>;
}

interface ToolContext {
  env: Record<string, unknown>;    // Cloudflare bindings (D1, KV, etc.)
  conversationId?: string;        // Current conversation
  step: number;                    // Current step in the loop
  trace: NimbusTrace[];            // Completed steps so far
  abort: (reason: string) => void; // Cancel entire run
}
```

**Why Zod for parameters:** The model needs JSON Schema to know what it can pass. Zod schemas generate JSON Schema automatically, AND they validate the model's tool call arguments at runtime. Catch malformed model outputs before they hit your handler.

### 3.10 Preset Tool Libraries

For common patterns, pre-built tool sets:

```typescript
import { httpTools } from "@0xkobold/nimbus/presets";

// HTTP tools: model can fetch URLs, read JSON APIs
const http = httpTools({
  allowedDomains: ["api.fiscaldata.treasury.gov", "api.usaspending.gov"],
  maxResponseSize: 1024 * 1024,  // 1MB
  headers: { "User-Agent": "nimbus-mono/1.0" },
});
// http.fetch — GET a URL, return parsed JSON
// http.search — GET with query params

import { dataTools } from "@0xkobold/nimbus/presets";

// Data tools: model can filter, aggregate, sort cached data
const data = dataTools();
// data.filter — filter array of objects by field
// data.aggregate — sum, count, average by group
// data.sort — sort array of objects
```

### 3.11 The `NimbusResult` Type

```typescript
interface NimbusResult {
  answer: string;                  // Model's final text response
  data: unknown[];                  // Structured data from tool results
  sources: NimbusSource[];          // Which tools were called
  trace: NimbusTrace[];             // Full execution trace
  model: string;                    // Final model used (may differ if fallback)
  cached: boolean;                  // Entire answer served from cache?
  steps: number;                    // Tool-call loops
  tokens: { input: number; output: number; total: number };
  duration: number;                 // Total ms
  conversationId?: string;          // For memory grouping
  mcpConnections?: McpConnectionSummary[]; // MCP server connections made
}

interface NimbusSource {
  tool: string;
  toolSource: "inline" | "mcp";
  mcpServer?: string;
  params: Record<string, unknown>;
  result?: unknown;
}
```

---

## 4. Zod Schemas / Types

### 4.1 Core Types

```typescript
import { z } from "zod";

// Model reference — Workers AI model name or AI Gateway unified path
export type ModelRef = string;

// Tool definition — passed directly or via plugins
export interface ToolDef<TParams = unknown, TResult = unknown> {
  description: string;
  parameters: ZodType<TParams>;
  execute: (params: TParams, ctx: ToolContext) => Promise<TResult>;
}

// A nimbus plugin — tools, instructions, and MCP servers added by host projects
export interface NimbusPlugin {
  /** Plugin name (e.g. 'nimbus-treasury') */
  name: string;
  /** What this plugin provides */
  description?: string;
  /** Tools this plugin adds */
  tools?: Record<string, ToolDef>;
  /** MCP servers this plugin connects to */
  mcpServers?: McpServerConfig[];
  /** Additional system instructions */
  instructions?: string;
}

// Tool call produced by the model
export interface ToolCall {
  id: string;
  tool: string;
  params: Record<string, unknown>;
}

// Result from executing a tool handler
export interface ToolResult {
  callId: string;
  tool: string;
  params: Record<string, unknown>;
  result: unknown;
  error: string | null;
  duration: number;
}

// Context passed to every tool execute() function
export interface ToolContext {
  env: Record<string, unknown>;
  conversationId?: string;
  step: number;
  trace: NimbusTrace[];
  abort: (reason: string) => void;
}

// MCP server config — connect to remote tool servers
export interface McpServerConfig {
  name: string;
  url: string;
  headers?: Record<string, string>;
}

// Messages
export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface SystemMessage { role: "system"; content: string; }
export interface UserMessage { role: "user"; content: string; }
export interface AssistantMessage { role: "assistant"; content: string; toolCalls?: ToolCall[]; }
export interface ToolMessage { role: "tool"; content: string; callId: string; }

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

// Streaming
export type StreamChunkType = "text" | "tool_call" | "tool_result" | "done";

export interface StreamChunk {
  type: StreamChunkType;
  content: string | ToolCall | ToolResult;
}

// Nimbus instance interface
export interface Nimbus {
  run: (question: string, options?: RunOptions) => Promise<NimbusResult>;
  stream: (question: string, options?: RunOptions) => Promise<StreamResponse>;
  /** Add a plugin. Returns self for chaining. */
  use: (plugin: NimbusPlugin) => Nimbus;
  /** List active plugins */
  plugins: () => string[];
}
```

### 4.2 Validation Behavior

| Scenario | Behavior |
|----------|----------|
| Model returns invalid tool call (wrong params) | Zod validates against tool schema. On failure → feed error back to model: "Tool call failed validation: {details}". Model may retry with correct params. |
| Model returns tool call for unknown tool | Feed error: "Unknown tool: {name}". Model should pick a known tool or answer directly. |
| Tool handler throws | Catch error, feed result: `ToolResult { error: message }`. Model sees the error and can retry or adjust. |
| Model gives no tool calls and no text (empty) | Retry once. If still empty → return `NimbusResult { answer: "", steps: N }`. |
| Model exceeds maxSteps | Force response: compile final answer from last model output + tool results so far. |
| Timeout exceeded | `abort("timeout")` → return partial result with `answer: "Request timed out after N steps."` |

---

## 5. Model Provider Architecture

### 5.1 Workers AI (Default, No API Key)

When running on Cloudflare Workers, the AI binding is available:

```typescript
import { workersAI } from "@0xkobold/nimbus/models";

// Uses env.AI binding (auto-detected in Worker context)
const model = workersAI("@cf/zai-org/glm-4.7-flash");
```

**Under the hood:** Calls `env.AI.run(model, { messages, tools, stream })` using the Workers AI binding. No HTTP, no API key — direct in-isolate call to Cloudflare's GPU network.

### 5.2 AI Gateway Unified API (Any Provider)

```typescript
import { unified } from "@0xkobold/nimbus/models";

// OpenAI through AI Gateway (stored keys in gateway)
const model = unified("openai/gpt-5.2");

// Anthropic through AI Gateway
const model = unified("anthropic/claude-4-5-sonnet");

// Workers AI through AI Gateway (gets caching + logging)
const model = unified("workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast");

// Dynamic routing through AI Gateway
const model = unified("dynamic/customer-support");
```

**Under the hood:** Uses `ai-gateway-provider` package + Vercel AI SDK `generateText`/`streamText`. All requests route through Cloudflare AI Gateway — unified billing, caching, rate limiting, logging across every provider.

### 5.3 Model Resolution Priority

```
1. Workers AI binding available? → Use workersAI() directly (fastest, no HTTP)
2. AI Gateway configured? → Route through gateway to any provider
3. Neither? → Throw config error with helpful message
```

### 5.4 Key Models for Agent Workloads

| Model | Route | Best For | Neurons/1K |
|-------|-------|----------|-----------|
| glm-4.7-flash | `workersAI("@cf/zai-org/glm-4.7-flash")` | Fast queries, translation, simple tools | Low |
| kimi-k2.5 | `workersAI("@cf/moonshot/kimi-k2.5")` | Deep analysis, 256K context, reasoning | High |
| llama-3.3-70b | `workersAI("@cf/meta/llama-3.3-70b-instruct-fp8-fast")` | General purpose, good tool calling | Medium |
| gpt-5.2 | `unified("openai/gpt-5.2")` | Needs OpenAI reasoning quality | AI Gateway |
| claude-4-5-sonnet | `unified("anthropic/claude-4-5-sonnet")` | Complex multi-step, long context | AI Gateway |
| bge-m3 | `workersAI("@cf/baai/bge-m3")` | Embeddings for Vectorize | Very low |
| flux | `workersAI("@cf/deepgram/flux")` | ASR (voice input) | Low |
| aura-2-en | `workersAI("@cf/deepgram/aura-2-en")` | TTS (voice output) | Low |

---

## 6. Harness Execution Lifecycle

This is the core loop — the "everything except the model" that makes agents work:

### 6.1 Steps

```
1. INTENT CAPTURE
   - Receive user question + optional conversation history
   - Compile working context (system prompt + history + memory summaries)
   - If context exceeds maxContextTokens → compact (summarize or truncate)

2. MODEL CALL
   - Send compiled context + tool schemas to model
   - Model returns: text response AND/OR tool calls
   - Record trace entry

3. TOOL EXECUTION (if model made tool calls)
   - Validate each tool call against its Zod schema
   - Execute each tool's handler function with validated params
   - Collect results (including errors)
   - Feed tool results back as "tool" role messages

4. LOOP CHECK
   - Did model ask for more tool calls? → Go to step 2 (increment step counter)
   - Did model give a final answer? → Go to step 5
   - Hit maxSteps? → Force summary from current state → Go to step 5
   - Hit timeout? → abort → Go to step 5

5. RESPONSE COMPILATION
   - Extract answer from model's final text
   - Collect data from tool results into structured `data` array
   - Build `sources` list from tool calls made
   - Compile full trace
   - Persist conversation summary to memory store

6. RETURN
   - NimbusResult with answer, data, sources, trace, metadata
```

### 6.2 Context Compilation

Before each model call, the harness compiles the working context:

```typescript
function compileContext(config: NimbusConfig, state: RunState): Message[] {
  const messages: Message[] = [];

  // 1. System prompt (always first)
  if (config.instructions) {
    messages.push({ role: "system", content: config.instructions });
  }

  // 2. Memory summaries (from previous conversations)
  if (config.context.memory && state.memorySummary) {
    messages.push({ role: "system", content: `Previous context:\n${state.memorySummary}` });
  }

  // 3. Recent conversation history (last N messages)
  messages.push(...state.history.slice(-config.context.history));

  // 4. Current tool results (from this run's tool execution)
  for (const result of state.pendingToolResults) {
    messages.push({ role: "tool", content: JSON.stringify(result.result), callId: result.callId });
  }

  // 5. Token budget check
  const totalTokens = estimateTokens(messages);
  if (totalTokens > config.context.maxContextTokens) {
    // Compact: summarize or truncate oldest messages
    return compactContext(messages, config.context);
  }

  return messages;
}
```

### 6.3 Tool Execution Loop

```typescript
async function executeTools(
  calls: ToolCall[],
  tools: Record<string, ToolDef>,
  ctx: ToolContext,
): Promise<ToolResult[]> {
  return Promise.all(calls.map(async (call) => {
    const tool = tools[call.tool];
    if (!tool) {
      return { callId: call.id, tool: call.tool, params: call.params, result: null, error: `Unknown tool: ${call.tool}`, duration: 0 };
    }

    const start = Date.now();
    try {
      // Validate params against Zod schema
      const validated = tool.parameters.parse(call.params);
      const result = await tool.execute(validated, ctx);
      return { callId: call.id, tool: call.tool, params: validated, result, error: null, duration: Date.now() - start };
    } catch (err) {
      const message = err instanceof z.ZodError
        ? `Validation error: ${err.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ")}`
        : String(err);
      return { callId: call.id, tool: call.tool, params: call.params, result: null, error: message, duration: Date.now() - start };
    }
  }));
}
```

---

## 7. Memory Stores

### 7.1 D1 Memory (Production)

```typescript
import { d1Memory } from "@0xkobold/nimbus/memory";

const memory = d1Memory({
  binding: "DB",    // D1 binding name in wrangler.jsonc
  ttl: 86400,       // Conversation summaries expire after 24h
});

// D1 tables created by migration:
// - nimbus_conversations (id, created_at, summary, metadata)
// - nimbus_messages (id, conversation_id, role, content, timestamp)
```

### 7.2 KV Memory (Fast Reads)

```typescript
import { kvMemory } from "@0xkobold/nimbus/memory";

const memory = kvMemory({
  binding: "CACHE",
  ttl: 3600,  // 1 hour
});
```

### 7.3 In-Memory (Dev)

```typescript
import { inMemory } from "@0xkobold/nimbus/memory";

const memory = inMemory();  // No persistence, pure Map
```

### 7.4 Memory Interface

All memory stores implement the same interface:

```typescript
interface MemoryStore {
  // Save a conversation summary
  saveSummary(conversationId: string, summary: string): Promise<void>;

  // Load the most recent summary for a conversation
  loadSummary(conversationId: string): Promise<string | null>;

  // Save individual messages
  saveMessages(conversationId: string, messages: Message[]): Promise<void>;

  // Load recent messages (up to limit)
  loadMessages(conversationId: string, limit: number): Promise<Message[]>;

  // Clear a conversation
  clear(conversationId: string): Promise<void>;
}
```

---

## 8. Error Handling

### 8.1 Error Hierarchy

```typescript
class NimbusError extends Error {
  constructor(
    message: string,
    public code: string,
    public step?: number,
    public trace?: NimbusTrace[],
  ) { super(message); }
}

class ModelError extends NimbusError {
  // Model returned error, timed out, or produced invalid output
  constructor(message: string, public model: string, step?: number) {
    super(message, "MODEL_ERROR", step);
  }
}

class ToolValidationError extends NimbusError {
  // Tool call params failed Zod validation
  constructor(message: string, public tool: string, public params: unknown, step?: number) {
    super(message, "TOOL_VALIDATION", step);
  }
}

class ToolExecutionError extends NimbusError {
  // Tool handler threw during execution
  constructor(message: string, public tool: string, step?: number) {
    super(message, "TOOL_EXECUTION", step);
  }
}

class ContextOverflowError extends NimbusError {
  // Compiled context exceeds model's context window even after compaction
  constructor(message: string, public tokenEstimate: number) {
    super(message, "CONTEXT_OVERFLOW");
  }
}

class TimeoutError extends NimbusError {
  // Run exceeded configured timeout
  constructor(message: string, public elapsedMs: number) {
    super(message, "TIMEOUT");
  }
}

class MaxStepsError extends NimbusError {
  // Run hit maxSteps without model producing a final answer
  constructor(message: string, public steps: number) {
    super(message, "MAX_STEPS");
  }
}
```

### 8.2 Error Recovery

| Scenario | Recovery |
|----------|----------|
| Model returns 429 (rate limited) | Retry with exponential backoff. Try fallback model if retries exhausted. |
| Model returns 500 | Retry once. Try fallback model. |
| Model returns malformed tool calls | Feed error back to model as tool result. Let model try again. |
| Zod validation fails on tool params | Feed validation errors back to model. Let model fix params. |
| Tool handler throws | Feed error message back to model. Let model try different approach. |
| All fallback models fail | Throw `ModelError` with full chain of failures. |
| Context overflow after compaction | Throw `ContextOverflowError`. Clear memory and retry with `history: 0`. |
| Timeout | Return partial result with whatever the model produced so far. |

---

## 9. Caching

### 9.1 AI Gateway Cache

AI Gateway caches model responses automatically when configured. This is the primary cache layer — identical prompts return cached results with no model invocation.

**Cache key:** Model + prompt hash (messages + tool schemas).  
**Configured in AI Gateway dashboard:** TTL, cache bypass headers.  
**Benefit for NIMBUS:** Same question → same answer → $0 AI cost. The harness doesn't need its own cache layer because AI Gateway handles it.

### 9.2 Tool Result Caching (App-Level)

The harness does NOT cache tool results. Tool handlers are responsible for their own caching — typically via D1 or KV lookup before hitting upstream APIs:

```typescript
// Example: Tool with D1 caching
const treasury_debt: Tool = {
  description: "Get current U.S. national debt",
  parameters: z.object({}),
  execute: async (_, ctx) => {
    // Check D1 cache first
    const cached = await ctx.env.DB.prepare(
      "SELECT * FROM debt_snapshots ORDER BY fetched_at DESC LIMIT 1"
    ).first();
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < 4 * 3600_000) {
      return cached; // 4h cache hit
    }
    // Fetch from upstream
    const data = await fetchTreasuryAPI("v2/accounting/od/debt_to_penny");
    await ctx.env.DB.prepare("INSERT INTO debt_snapshots ...").bind(...).run();
    return data;
  },
};
```

**Why not built-in caching:** Tool semantics vary wildly. A debt ticker can cache 4 hours. A stock price can cache 0 seconds. Only the tool author knows the right TTL.

---

## 10. Rate Limiting

### 10.1 AI Gateway Rate Limiting

Configure rate limits in AI Gateway dashboard. The harness doesn't do its own rate limiting against model providers — that's AI Gateway's job.

### 10.2 Tool Rate Limiting (App-Level)

Tools that call external APIs should implement their own rate limiting:

```typescript
// Simple token bucket in the tool handler
let lastCall = 0;
const MIN_INTERVAL = 200; // 5 req/s

const usaspending_search: Tool = {
  // ...
  execute: async (params, ctx) => {
    const elapsed = Date.now() - lastCall;
    if (elapsed < MIN_INTERVAL) {
      await new Promise(r => setTimeout(r, MIN_INTERVAL - elapsed));
    }
    lastCall = Date.now();
    return await fetchUSAspendingAPI(params);
  },
};
```

### 10.3 Harness-Level Limits

| Limit | Default | Purpose |
|-------|---------|---------|
| `maxSteps` | 10 | Prevent infinite tool-call loops |
| `timeout` | 30_000ms | Prevent runaway executions |
| `maxTokens` | 4_096 | Prevent oversized model outputs |

---

## 11. Testing Strategy

### 11.1 Unit Tests

| Suite | File | Tests | Covers |
|-------|------|-------:|--------|
| errors | `tests/unit/errors.test.ts` | 8 | Error hierarchy, codes, inheritance |
| nimbus (core) | `tests/unit/nimbus.test.ts` | 10 | createNimbus, .use(plugin), mock model, run loop, tool execution |
| models | `tests/unit/models.test.ts` | 43 | workersAI parse, unified parse, isWorkersAI/isUnified, resolver, fallback chains |
| **Total** | | **61** | |

### 11.2 End-to-End Tests

| Suite | File | Tests | Covers |
|-------|------|-------:|--------|
| e2e | `tests/e2e/e2e.test.ts` | 15 | Plugin chains, tool execution, stream, registerMockResponses, trace structure |
| **Total** | | **15** | |

**76 tests passing total.**

### 11.3 Integration Tests (Future — requires Workers AI / AI Gateway env)

| Test | What It Verifies |
|------|-------------------|
| Workers AI binding test | Real model call with tool definitions, verify tool call parsing |
| AI Gateway unified test | Route through gateway to Workers AI, verify caching headers |
| Multi-step agent test | 3+ tool call loop with real model, verify trace integrity |
| Fallback test | Primary model fails → fallback works → correct model in result |

### 11.4 Mock Strategy

```typescript
import { createNimbus } from "nimbus-agent";
import { mockModel, registerMockResponses } from "nimbus-agent/testing";
import { z } from "zod";

// Approach 1: mockModel() for quick inline testing
const model = mockModel([
  // Step 1: model calls a tool
  { toolCalls: [{ id: "c1", tool: "weather", params: { city: "SF" } }] },
  // Step 2: model gives final answer
  { text: "It's 72°F in San Francisco." },
]);

const agent = createNimbus({ model }).use({
  name: "test-plugin",
  tools: {
    weather: {
      description: "Get weather",
      parameters: z.object({ city: z.string() }),
      execute: async (params) => ({ temp: 72, city: params.city }),
    },
  },
});

// Approach 2: registerMockResponses() for named model IDs
registerMockResponses("my-test-model", [
  { text: "Registered response works!" },
]);

const agent2 = createNimbus({ model: "my-test-model" });

// Approach 3: "mock" string model (legacy test support)
const agent3 = createNimbus({ model: "mock" });
```

---

## 12. Project Structure

```
nimbus-mono/
├── packages/
│   └── agent/               # nimbus-agent package
│       ├── src/
│       │   ├── index.ts          # Public API exports
│       │   │
│       │   ├── core/
│       │   │   ├── nimbus.ts       # createNimbus() — main entry + .use(plugin)
│       │   │   ├── run.ts         # Execution loop (run + mock model loop)
│       │   │   ├── context.ts      # Context compilation + compaction
│       │   │   ├── tools.ts       # Tool execution engine (Zod validation)
│       │   │   ├── mcp.ts          # MCP server discovery (stub for v0.2)
│       │   │   ├── errors.ts       # Error hierarchy
│       │   │   └── types.ts       # All public type definitions
│       │   │
│       │   ├── models/
│       │   │   ├── index.ts          # Export workersAI, unified
│       │   │   ├── workers-ai.ts     # Workers AI binding provider
│       │   │   ├── unified.ts        # AI Gateway unified API provider
│       │   │   └── resolver.ts       # Model resolution + fallback chains
│       │   │
│       │   ├── memory/
│       │   │   ├── index.ts          # Export d1Memory, kvMemory, inMemory
│       │   │   ├── d1.ts             # D1-backed store
│       │   │   ├── kv.ts            # KV-backed store
│       │   │   └── in-memory.ts     # Dev/test store
│       │   │
│       │   ├── presets/
│       │   │   ├── index.ts          # Export httpTools, dataTools
│       │   │   ├── http.ts           # HTTP fetch tools (domain allowlist)
│       │   │   └── data.ts           # Data filter/aggregate/sort tools
│       │   │
│       │   ├── tracing/
│       │   │   ├── index.ts          # Export d1TraceStore
│       │   │   └── d1.ts             # D1 trace persistence
│       │   │
│       │   └── testing/
│       │       ├── index.ts          # Export mockModel, registerMockResponses
│       │       └── mock.ts           # Mock model provider for tests
│       │
│       ├── tests/
│       │   ├── unit/
│       │   │   ├── errors.test.ts       # 8 tests — error classes
│       │   │   ├── nimbus.test.ts        # 10 tests — core + .use(plugin)
│       │   │   └── models.test.ts         # 43 tests — model resolvers + fallback
│       │   └── e2e/
│       │       └── e2e.test.ts            # 15 tests — plugin chains, stream, trace
│       │
│       ├── package.json          # nimbus-agent v0.1.0
│       └── tsconfig.json
│
├── Spec.md          # This file
└── README.md         # Quick start + architecture overview
```

---

## 13. Usage Examples

### 13.1 Minimal: Single Question, Workers AI

```typescript
import { createNimbus, workersAI } from "@0xkobold/nimbus";

const agent = createNimbus({
  model: workersAI("@cf/zai-org/glm-4.7-flash"),
});

const result = await agent.run("What is 2+2?");
// result.answer → "4"
// result.steps → 0 (no tool calls)
```

### 13.2 With Tools: Federal Data Agent

```typescript
import { createNimbus, workersAI } from "@0xkobold/nimbus";
import { z } from "zod";

const agent = createNimbus({
  model: workersAI("@cf/zai-org/glm-4.7-flash"),
  instructions: "You are a federal spending analyst. Use tools to look up data. Always cite sources.",
  tools: {
    treasury_debt: {
      description: "Get U.S. national debt figures",
      parameters: z.object({ date: z.string().optional() }),
      execute: async (params, ctx) => fetchFromD1(ctx.env.DB, "debt_snapshots", params.date),
    },
    state_spending: {
      description: "Get federal spending by state with per-capita data",
      parameters: z.object({ fy: z.number() }),
      execute: async (params, ctx) => fetchFromD1(ctx.env.DB, "state_spending", params.fy),
    },
  },
  memory: d1Memory({ binding: "DB" }),
});

// Used in a Cloudflare Worker (x402 is handled at the route level, not here)
export default {
  async fetch(request, env) {
    const { question } = await request.json();
    const result = await agent.run(question, { env });
    return Response.json({
      answer: result.answer,
      sources: result.sources,
      data: result.data,
    });
  },
};
```

### 13.3 Multi-Provider via AI Gateway

```typescript
import { createNimbus, unified } from "nimbus-agent";

const agent = createNimbus({
  gateway: {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    gateway: "production",
    apiKey: env.CF_AIG_TOKEN,
  },

  // Use Claude for complex reasoning, fell back to Workers AI
  model: unified("anthropic/claude-4-5-sonnet"),
  fallbacks: [unified("workers-ai/@cf/zai-org/glm-4.7-flash")],
});
```

### 13.4 x402 + NIMBUS (The App Wires It, Not the Harness)

```typescript
// In treasury-gov app — the harness doesn't know about x402
import { createNimbus, workersAI } from "nimbus-agent";
import { treasuryPlugin } from "nimbus-treasury";

const agent = createNimbus({
  model: workersAI("@cf/zai-org/glm-4.7-flash"),
}).use(treasuryPlugin);

export default {
  async fetch(request, env) {
    // x402 check is app-level middleware
    const payment = request.headers.get("PAYMENT-SIGNATURE");
    if (!payment) {
      return new Response(JSON.stringify({
        accepts: [{ scheme: "exact", network: "base", amount: "0.002", token: "USDC", recipient: env.WALLET }]
      }), { status: 402 });
    }

    if (!await verifyX402(payment, env)) {
      return new Response("Invalid payment", { status: 402 });
    }

    // Payment verified — now run the harness
    const { question } = await request.json();
    const result = await agent.run(question, { env });

    return Response.json(result);
  },
};
```

**NIMBUS doesn't know about x402.** The app wraps its routes with payment logic. The harness just answers questions. This separation means you can use it in free endpoints, paid endpoints, cron jobs, or internal tools — without modifying the harness.

---

## 14. Security & Ethics

### 14.1 Tool Execution Security

- Tools run server-side with full access to `env` bindings. This is by design — tools need D1/KV/API access.
- HTTP tools enforce domain allowlists. No arbitrary outbound requests.
- Zod validation prevents malformed model outputs from causing havoc in tool handlers.
- `abort()` gives tools a way to kill the entire run (e.g., if a security check fails).

### 14.2 Model Output Safety

- Workers AI models have built-in content filtering.
- The harness doesn't add its own safety layer — that's the model provider's job.
- Tool results are data, not executable code. The harness never evals or executes model-generated code.
- Tracing provides full audit trail for any output.

### 14.3 Memory Privacy

- Memory stores conversation summaries, not raw PII.
- D1 data is encrypted at rest by Cloudflare.
- KV data has TTL-based expiry.
- Conversation IDs are opaque — no user identity stored in the harness.

---

## 15. Changelog & Versioning

### v0.1 — Launch
- `createNimbus()` with `workersAI()` and `unified()` model providers
- Tool execution with Zod validation
- Context compilation with 3 compaction strategies
- D1, KV, in-memory stores
- Streaming via `agent.stream()`
- Tracing with D1 persistence
- Preset tool libraries (http, data)
- Mock model for testing
- AI Gateway integration via `ai-gateway-provider`

### v0.2 — Next
- MCP discovery (currently a stub returning `[]`)
- Vectorize integration for RAG tools (semantic search)
- Batch execution (multiple questions in parallel)
- Conversation branching (fork a conversation from a mid-point)
- Token usage analytics helper

### Future Possibilities (Not Planned)

These are ideas that could make sense someday. None are on the roadmap.

- **Cloudflare Agents SDK integration:** `NimbusChatAgent extends AIChatAgent` with per-instance SQLite, WebSocket streaming, `useAgentChat` React hook, `@callable()` RPC
- **Voice tools:** ASR + TTS as built-in tool types
- **MCP server mode:** Expose harness tools to other agents via Model Context Protocol
- **LoRA fine-tune:** Support on Workers AI

---

## 16. Dependencies

| Package | Type | Purpose |
|---------|------|---------|
| `ai` | Runtime | Vercel AI SDK — `generateText`, `streamText`, `tool` helpers |
| `ai-gateway-provider` | Runtime | AI Gateway integration for Vercel AI SDK |
| `workers-ai-provider` | Runtime | Workers AI binding provider for Vercel AI SDK |
| `zod` | Runtime | Tool parameter validation + schema generation |
| `typescript` | Dev | Type checking |
| `vitest` | Dev | Test runner |

**Runtime deps: 4** (ai, ai-gateway-provider, workers-ai-provider, zod)  
**Why these:** All go through Vercel AI SDK → AI Gateway. One interface, any model, all Cloudflare.

**Optional peer dep:** `@modelcontextprotocol/sdk` — only needed for MCP server discovery.

---

## Appendix A: Agents SDK Design Sketch (Not Planned)

The [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) provides `Agent` (Durable Object base class), `AIChatAgent` (chat with persistence), and `useAgentChat` (React hook). If NIMBUS ever integrates with these, the `.use(plugin)` pattern stays unchanged. This appendix is a design sketch for reference — not a commitment.

### A.1 Why It Could Make Sense

| Agents SDK feature | What NIMBUS would gain |
|--------------------|-------------------|
| `AIChatAgent` + `this.messages` | Conversation persistence in per-instance SQLite |
| `useAgentChat` React hook | Real-time chat UI with resumable streams |
| `@callable()` methods | Typed RPC from browser to agent over WebSocket |
| `this.sql` per-instance | Fast SQL without shared D1 contention |
| Hibernation + eviction safety | State survives DO lifecycle |

### A.2 Architecture: Two Modes

```
Stateless mode (current)       Agents SDK mode (hypothetical)
+------------------+          +------------------------------+
| createNimbus()   |          | class MyAgent extends         |
|   .use(plugin)   |          |   NimbusChatAgent             |
|   .run(question) |          |   .use(plugin)                |
|                  |          |   .run(question)              |
| Memory: D1 / KV  |          | Memory: this.sql (per-instance)|
| Streaming: SSE    |          | Streaming: WebSocket (resumable)|
| Routing: Worker  |          | Routing: routeAgentRequest()  |
| State: stateless  |          | State: per-agent Durable Object|
+------------------+          +------------------------------+
```

### A.3 NimbusChatAgent

```typescript
import { NimbusChatAgent } from "nimbus-agent/agents";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages } from "ai";

export class FederalDataAgent extends NimbusChatAgent {
  maxPersistedMessages = 200;

  async onChatMessage(onFinish, options) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const result = streamText({
      model: workersai("@cf/zai-org/glm-4.7-flash"),
      messages: await convertToModelMessages(this.messages),
      tools: this.nimbusTools(), // tools from .use(plugin)
    });
    return result.toUIMessageStreamResponse();
  }
}
```

### A.4 Client: useAgentChat

```typescript
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";

function Chat() {
  const agent = useAgent({ agent: "FederalDataAgent", name: "user-123" });
  const { messages, sendMessage, status } = useAgentChat({ agent });
  // ... render messages, form with sendMessage
}
```

### A.5 Routing & Wrangler

```typescript
import { routeAgentRequest } from "agents";
export default {
  async fetch(request, env) {
    return routeAgentRequest(request, env) || new Response("Not found", { status: 404 });
  },
};
```

```jsonc
// wrangler.jsonc
{
  "ai": { "binding": "AI" },
  "durable_objects": {
    "bindings": [{ "name": "FederalDataAgent", "class_name": "FederalDataAgent" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["FederalDataAgent"] }]
}
```

### A.6 What Stays the Same

- `.use(plugin)` pattern — identical
- Tool definitions — same Zod schema + handler
- Model resolvers — same `workersAI()` and `unified()`
- Error hierarchy — same classes
- Testing — same `mockModel()` + `registerMockResponses()`

### A.7 What Changes

| Concern | Stateless (`createNimbus`) | Agents SDK (`NimbusChatAgent`) |
|----------|---------------------------|-------------------------------|
| Memory | D1 / KV / in-memory | `this.sql` (per-instance SQLite) |
| Streaming | SSE (request-response) | WebSocket (resumable, multi-client) |
| Persistence | Manual D1 calls | Automatic via `AIChatAgent` |
| Routing | Worker `fetch` handler | `routeAgentRequest()` |
| Client | `fetch()` + SSE parsing | `useAgentChat` React hook |
| State | None between invocations | `this.state` survives hibernation |

---

*NIMBUS: the storm around the model.* ⚡🐉
