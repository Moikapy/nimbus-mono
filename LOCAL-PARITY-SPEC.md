# NIMBUS — Local Parity Spec

> 1:1 feature parity between Cloudflare (`NimbusChatAgent`) and Local (`NimbusLocal`).

---

## 1. Feature Parity Map

Every feature `AIChatAgent` provides on Cloudflare, mapped to its local equivalent.

### 1.1 Runtime & Isolation

| # | Cloudflare Feature | Source | Local Equivalent | Implementation |
|---|-------------------|--------|-------------------|---------------|
| 1 | Durable Object per session | Agents SDK | Session-scoped agent instance | Each `sessionId` → separate `NimbusLocal` instance with isolated state |
| 2 | `this.env` bindings (AI, D1, KV, R2) | Workers runtime | `this.config` object | `{ model: ModelRef, store: SessionStore, ... }` |
| 3 | `this.ctx` (DurableObjectState) | Workers runtime | `SessionContext` | `{ abort(signal), waitUntil(promise), storage: SessionStore }` |
| 4 | Per-instance SQLite (`this.sql`) | DO built-in | `SessionStore` interface | `SqliteSessionStore` (bun:sqlite / better-sqlite3), `FileSessionStore` (JSON) |

### 1.2 Messages & Persistence

| # | Cloudflare Feature | Source | Local Equivalent | Implementation |
|---|-------------------|--------|-------------------|---------------|
| 5 | `this.messages` (UIMessage[]) | AIChatAgent | `this.messages` | Loaded from `SessionStore.load()`, same `UIMessage` type from `ai` package |
| 6 | `persistMessages(messages)` | AIChatAgent | `sessionStore.save(sessionId, messages)` | Same UIMessage array, same persistence guarantee |
| 7 | `maxPersistedMessages` | AIChatAgent | `maxPersistedMessages` | Same default (200), same pruning logic |
| 8 | `pruneMessages()` | AI SDK | `pruneMessages()` | Same function from `ai` package |
| 9 | Automatic message persistence on stream end | AIChatAgent | Auto-save in `onChatMessage` | After stream completes, `sessionStore.save()` |

### 1.3 WebSocket & Transport

| # | Cloudflare Feature | Source | Local Equivalent | Implementation |
|---|-------------------|--------|-------------------|---------------|
| 10 | WebSocket upgrade (DO fetch) | Agents SDK | `Bun.serve({ websocket })` | Same WS upgrade pattern |
| 11 | Wire protocol (CF_AGENT_USE_CHAT_*) | ai-chat/types | Same wire protocol | `MessageType` enum re-exported, same JSON frames |
| 12 | `useAgentChat` React hook | @cloudflare/ai-chat/react | `useAgentChat` (same hook) | Point `useAgent` at `ws://localhost:PORT` instead of `wss://*.workers.dev` |
| 13 | `useAgent` (PartySocket) | agents/react | `useAgent` or direct `PartySocket` | PartySocket works with any WS server, not just Cloudflare |
| 14 | Multi-client broadcast | DO WebSocket | WS server broadcast | All connected clients for a session receive the same messages |
| 15 | Hibernation + reconnection | DO lifecycle | Session reconnection | Client reconnects, server loads session from store, client receives `CF_AGENT_CHAT_MESSAGES` |

### 1.4 Streaming & Resumption

| # | Cloudflare Feature | Source | Local Equivalent | Implementation |
|---|-------------------|--------|-------------------|---------------|
| 16 | `streamText().toUIMessageStreamResponse()` | AI SDK | Same AI SDK call | `streamText` + `toUIMessageStreamResponse` work with any model |
| 17 | Resumable streams | AIChatAgent (`_resumableStream`) | `ResumableStream` (same class) | Store chunks in session store, replay on reconnect |
| 18 | Stream chunk storage | AIChatAgent (`_storeStreamChunk`) | `sessionStore.saveChunks()` | Persist chunks per stream ID |
| 19 | `CF_AGENT_STREAM_RESUMING` | ai-chat/types | Same message type | Server sends this on reconnect when active stream exists |
| 20 | `CF_AGENT_STREAM_RESUME_ACK` | ai-chat/types | Same message type | Client acknowledges, requests chunk replay |
| 21 | `CF_AGENT_STREAM_RESUME_REQUEST` | ai-chat/types | Same message type | Client requests resume check after handler ready |
| 22 | `CF_AGENT_STREAM_RESUME_NONE` | ai-chat/types | Same message type | Server responds when no active stream |

### 1.5 Lifecycle Hooks

| # | Cloudflare Feature | Source | Local Equivalent | Implementation |
|---|-------------------|--------|-------------------|---------------|
| 23 | `onChatMessage(options)` | AIChatAgent | `onChatMessage(options)` | Same signature, same `OnChatMessageOptions` |
| 24 | `onChatResponse(result)` | AIChatAgent | `onChatResponse(result)` | Same `ChatResponseResult` type |
| 25 | `onChatRecovery(context)` | AIChatAgent | `onChatRecovery(context)` | Same `ChatRecoveryContext` type |
| 26 | `onConnect()` | Agent | `onConnect()` | Client WebSocket connected |
| 27 | `onClose()` | Agent | `onClose()` | Client WebSocket closed |

### 1.6 Concurrency & Abort

| # | Cloudflare Feature | Source | Local Equivalent | Implementation |
|---|-------------------|--------|-------------------|---------------|
| 28 | `messageConcurrency: "queue" \| "latest" \| "merge" \| "drop"` | AIChatAgent | Same `MessageConcurrency` type | Queue incoming messages, process by strategy |
| 29 | Per-request `AbortController` | AIChatAgent (`_abortRegistry`) | `AbortRegistry` (same pattern) | Map of requestId → AbortController |
| 30 | `CF_AGENT_CHAT_REQUEST_CANCEL` | ai-chat/types | Same message type | Client cancels, server aborts via controller |
| 31 | `options.abortSignal` in `onChatMessage` | AIChatAgent | Same signal | Passed from AbortController for the request |

### 1.7 Client-Side Tools

| # | Cloudflare Feature | Source | Local Equivalent | Implementation |
|---|-------------------|--------|-------------------|---------------|
| 32 | `CF_AGENT_TOOL_RESULT` (client → server) | ai-chat/types | Same message type | Client sends tool output back |
| 33 | `CF_AGENT_TOOL_APPROVAL` (client → server) | ai-chat/types | Same message type | Client approves/denies tool execution |
| 34 | Client tool schemas sent with request | ai-chat | Same wire format | `ClientToolSchema[]` in request |
| 35 | `autoContinue` after tool result | ai-chat | Same behavior | Server auto-continues conversation after receiving client tool result |

### 1.8 HTTP Endpoints

| # | Cloudflare Feature | Source | Local Equivalent | Implementation |
|---|-------------------|--------|-------------------|---------------|
| 36 | `routeAgentRequest(request, env)` | agents | `routeLocalRequest(request, config)` | Same routing logic, creates/finds session |
| 37 | `/get-messages` HTTP endpoint | ai-chat | Same endpoint | `GET /agents/:agent/:session/get-messages` returns message history |
| 38 | DO `fetch()` handler | Agent | Express/Bun.serve fetch handler | Same request → response pattern |

### 1.9 State & Scheduling

| # | Cloudflare Feature | Source | Local Equivalent | Implementation |
|---|-------------------|--------|-------------------|---------------|
| 39 | `this.state` (arbitrary DO state) | Agent | `this.state` | Stored in `SessionStore` alongside messages |
| 40 | `ctx.waitUntil()` | ExecutionContext | `sessionContext.waitUntil()` | Fire-and-forget promises |
| 41 | `this.schedule()` (alarms) | DO | `setTimeout` / cron | Simplified scheduling for local |
| 42 | `this.stash()` / `this.unstash()` (recovery) | AIChatAgent | `sessionStore.saveRecovery()` | Checkpoint data for stream recovery |

---

## 2. Architecture

### 2.1 Class Hierarchy

```
NimbusBase (abstract — all shared logic)
  ├── .use(plugin)                    # Plugin composition
  ├── .plugins()                       # List plugin names
  ├── .setModel(ref)                   # Set model reference
  ├── .resolveModel()                  # Resolve model (abstract)
  ├── .nimbusTools()                   # Convert plugins → AI SDK tools
  ├── .onChatMessage(options)          # Core chat handler
  ├── .onChatResponse(result)          # Post-turn hook
  ├── maxPersistedMessages            # Message cap
  ├── messages: UIMessage[]           # Abstract — subclasses provide
  ├── persistMessages(msgs)           # Abstract — subclasses provide
  ├── _instructions                    # Merged from plugins
  ├── _plugins: NimbusPlugin[]         # Plugin registry
  ├── _tools: Record<string, ToolDef>  # Tool registry

NimbusChatAgent extends NimbusBase + AIChatAgent   ← Cloudflare
  ├── messages → this.messages (AIChatAgent)
  ├── persistMessages → super.persistMessages (AIChatAgent)
  ├── resolveModel → createWorkersAI(this.env.AI)
  ├── WebSocket → DO fetch handler
  ├── this.sql → per-instance SQLite
  └── this.env → Workers bindings

NimbusLocal extends NimbusBase                     ← Local (Bun / Node)
  ├── messages → loaded from SessionStore
  ├── persistMessages → sessionStore.save()
  ├── resolveModel → createLocalModel(config)
  ├── WebSocket → Bun.serve / ws server
  ├── this.store → SessionStore
  └── this.config → LocalConfig
```

### 2.2 SessionStore Interface

The SessionStore replaces what Durable Object SQLite + AIChatAgent persistence provides:

```typescript
interface SessionStore {
  // ── Messages (replaces AIChatAgent's auto-persisted this.messages) ──

  /** Load all messages for a session (replaces AIChatAgent loading from SQLite on DO start) */
  loadMessages(sessionId: string): Promise<UIMessage[]>;

  /** Save all messages for a session (replaces AIChatAgent.persistMessages) */
  saveMessages(sessionId: string, messages: UIMessage[]): Promise<void>;

  // ── Stream chunks (replaces AIChatAgent's _storeStreamChunk) ──

  /** Store a stream chunk for resumption (replaces in-memory chunk buffer + SQLite) */
  saveStreamChunk(streamId: string, chunk: string): Promise<void>;

  /** Load stored chunks for a stream (replaces stream resumption replay) */
  loadStreamChunks(streamId: string): Promise<string[]>;

  /** Delete chunks after successful stream completion */
  deleteStreamChunks(streamId: string): Promise<void>;

  // ── Recovery data (replaces AIChatAgent's this.stash/unstash) ──

  /** Save recovery/checkpoint data for interrupted streams */
  saveRecoveryData(sessionId: string, data: unknown): Promise<void>;

  /** Load recovery data (passed to onChatRecovery) */
  loadRecoveryData(sessionId: string): Promise<unknown | null>;

  // ── State (replaces DO this.state) ──

  /** Save arbitrary agent state (replaces DO state persistence) */
  saveState(sessionId: string, state: unknown): Promise<void>;

  /** Load agent state (replaces DO state loading on connect) */
  loadState(sessionId: string): Promise<unknown | null>;

  // ── Session management ──

  /** List all session IDs (for admin/debug) */
  listSessions(): Promise<string[]>;

  /** Delete a session and all its data */
  deleteSession(sessionId: string): Promise<void>;
}
```

### 2.3 LocalConfig

```typescript
interface LocalConfig {
  /** Model provider — any function that returns an AI SDK LanguageModel */
  model: () => LanguageModel;

  /** Session store (defaults to SqliteSessionStore) */
  store?: SessionStore;

  /** WebSocket server port (default: 8787) */
  port?: number;

  /** Custom request handler for HTTP routes */
  fetch?: (request: Request, config: LocalConfig) => Promise<Response>;
}
```

### 2.4 SessionContext

Replaces `DurableObjectState` for local use:

```typescript
interface SessionContext {
  /** Session isolation — each session is a separate context */
  sessionId: string;

  /** Fire-and-forget promises (replaces ctx.waitUntil) */
  waitUntil(promise: Promise<unknown>): void;

  /** Access to session store */
  storage: SessionStore;

  /** Abort signal for the current request */
  abortSignal?: AbortSignal;
}
```

---

## 3. Wire Protocol Parity

The wire protocol is **identical** between Cloudflare and Local. Same JSON frames over WebSocket. Same `MessageType` enum. Same client hooks.

### 3.1 Client → Server Messages

| Message Type | Cloudflare | Local | Payload |
|-------------|-----------|-------|---------|
| `cf_agent_use_chat_request` | ✅ | ✅ | `{ id, init: { method, body, headers } }` |
| `cf_agent_chat_messages` | ✅ | ✅ | `{ messages: UIMessage[] }` |
| `cf_agent_chat_clear` | ✅ | ✅ | `{}` |
| `cf_agent_chat_request_cancel` | ✅ | ✅ | `{ id }` |
| `cf_agent_stream_resume_request` | ✅ | ✅ | `{}` |
| `cf_agent_stream_resume_ack` | ✅ | ✅ | `{ id }` |
| `cf_agent_tool_result` | ✅ | ✅ | `{ toolCallId, toolName, output, autoContinue? }` |
| `cf_agent_tool_approval` | ✅ | ✅ | `{ toolCallId, approved, autoContinue? }` |

### 3.2 Server → Client Messages

| Message Type | Cloudflare | Local | Payload |
|-------------|-----------|-------|---------|
| `cf_agent_chat_messages` | ✅ | ✅ | `{ messages: UIMessage[] }` |
| `cf_agent_use_chat_response` | ✅ | ✅ | `{ id, body, done, error?, continuation?, replay? }` |
| `cf_agent_chat_clear` | ✅ | ✅ | `{}` |
| `cf_agent_stream_resuming` | ✅ | ✅ | `{ id }` |
| `cf_agent_stream_resume_none` | ✅ | ✅ | `{}` |
| `cf_agent_message_updated` | ✅ | ✅ | `{ message: UIMessage }` |

### 3.3 Client Setup (Identical Hook, Different URL)

```tsx
// Cloudflare
const agent = useAgent({ agent: "FederalDataAgent", name: "user-123" });
// → connects to wss://my-app.workers.dev

// Local
const agent = useAgent({ agent: "FederalDataAgent", name: "user-123" });
// → connects to ws://localhost:8787

// Both use the same hook:
const { messages, sendMessage, status } = useAgentChat({ agent });
```

The only difference is the server URL. PartySocket (underlying `useAgent`) accepts any WebSocket URL.

---

## 4. Session Store Implementations

### 4.1 SqliteSessionStore (Default)

Local SQLite via `bun:sqlite` or `better-sqlite3`. 1:1 parity with DO's per-instance SQLite.

```typescript
import { SqliteSessionStore } from "nimbus-agent/local";

const store = new SqliteSessionStore({
  filename: "./data/sessions.db",   // or ":memory:" for tests
});

// Auto-creates tables on first use:
// - sessions (id, created_at, updated_at)
// - messages (id, session_id, role, content, parts, created_at)
// - stream_chunks (id, stream_id, chunk, created_at)
// - recovery_data (id, session_id, data, created_at)
// - agent_state (id, session_id, state, updated_at)
```

### 4.2 FileSessionStore

JSON files per session. Zero dependencies. Good for debugging.

```typescript
import { FileSessionStore } from "nimbus-agent/local";

const store = new FileSessionStore({
  directory: "./data/sessions",
  // Each session = one directory:
  //   sessions/abc123/messages.json
  //   sessions/abc123/chunks/stream-1.json
  //   sessions/abc123/recovery.json
  //   sessions/abc123/state.json
});
```

### 4.3 CapSessionStore

Integration with Capybara / Pi session format.

```typescript
import { CapSessionStore } from "nimbus-agent/local";

const store = new CapSessionStore({
  directory: "./data/cap-sessions",
  // Reads/writes in Cap's native format
});
```

---

## 5. NimbusLocal API

### 5.1 Creating a Local Agent

```typescript
import { NimbusLocal } from "nimbus-agent/local";
import { ollama } from "ollama-ai-provider";
import { treasuryPlugin } from "nimbus-treasury";

// Extend just like NimbusChatAgent
class FederalDataAgent extends NimbusLocal {
  constructor(sessionId: string, store: SessionStore) {
    super(sessionId, store);
    this.setModel("@cf/zai-org/glm-4.7-flash");
    this.use(treasuryPlugin);
  }

  resolveModel() {
    // Local: use Ollama, LM Studio, or any OpenAI-compatible API
    return ollama("llama3.3");
  }
}
```

### 5.2 Starting the Server

```typescript
import { serve } from "nimbus-agent/local";

serve({
  agent: FederalDataAgent,
  store: new SqliteSessionStore({ filename: "./sessions.db" }),
  port: 8787,
});
// → Bun.serve({ fetch, websocket }) on port 8787
// → Same wire protocol as Cloudflare DO
// → useAgentChat works unchanged from the React client
```

### 5.3 Programmatic Usage (No WebSocket)

```typescript
import { NimbusLocal } from "nimbus-agent/local";

const agent = new NimbusLocal("session-1", store);
agent.use(treasuryPlugin);

// Direct message — no WebSocket needed
const result = await agent.chat("What is the current national debt?", {
  body: { userId: "abc" },
});

// result is a UIMessage stream — same as onChatMessage returns
```

---

## 6. Parity Checklist

Every AIChatAgent feature and its local status:

| AIChatAgent Feature | Local Status | Notes |
|---------------------|-------------|-------|
| `this.messages` | ✅ Parity | Loaded from SessionStore |
| `persistMessages()` | ✅ Parity | Saves to SessionStore |
| `maxPersistedMessages` | ✅ Parity | Same default, same pruning |
| `onChatMessage()` | ✅ Parity | Same handler signature |
| `onChatResponse()` | ✅ Parity | Same result type |
| `onChatRecovery()` | ✅ Parity | Same context type |
| `this.stash() / this.unstash()` | ✅ Parity | Via SessionStore.saveRecoveryData |
| Resumable streams | ✅ Parity | Same protocol, chunks in SessionStore |
| Wire protocol (all MessageTypes) | ✅ Parity | Identical JSON frames |
| `useAgentChat` React hook | ✅ Parity | Same hook, different URL |
| WebSocket transport | ✅ Parity | Bun.serve / ws |
| Multi-client broadcast | ✅ Parity | WS server fanout |
| Hibernation + reconnect | ✅ Parity | Session persistence |
| `messageConcurrency` strategies | ✅ Parity | Same 4 strategies |
| Per-request AbortController | ✅ Parity | Same pattern |
| Client-side tools | ✅ Parity | Same wire protocol |
| Client tool approval | ✅ Parity | Same wire protocol |
| `autoContinue` | ✅ Parity | Same behavior |
| `/get-messages` HTTP endpoint | ✅ Parity | Same route |
| `routeAgentRequest()` | ✅ Parity | `routeLocalRequest()` |
| `this.state` | ✅ Parity | Via SessionStore |
| `ctx.waitUntil()` | ✅ Parity | SessionContext.waitUntil |
| `this.schedule()` | ⚠️ Simplified | `setTimeout` / cron, not DO alarms |
| MCP server discovery | ⏳ v0.3 | Same on both platforms |
| `this.sql` direct queries | ⚠️ Different | SessionStore abstracts; raw SQL via SqliteSessionStore.db |

---

## 7. What's Different by Design

Some features can't be identical, and that's OK:

| Cloudflare | Local | Why |
|-----------|-------|-----|
| `this.env.AI` (Workers AI binding) | `resolveModel()` returns any LanguageModel | Workers AI is a Cloudflare-specific binding. Local uses Ollama, OpenAI, etc. |
| DO alarm scheduling | `setTimeout` + cron | DO alarms survive hibernation. Local uses simpler scheduling. |
| Global edge network | localhost | Latency is lower locally, no cold starts. |
| Auto-scaling DOs | Single process | Local is one process. Scale with `cluster` if needed. |
| `this.sql` raw access | `store.db` on SqliteSessionStore | Exposed for advanced queries, not in the interface. |

---

## 8. Package Exports (Updated)

```typescript
// Cloudflare (existing)
export { NimbusChatAgent } from "nimbus-agent";

// Local (new)
export { NimbusLocal } from "nimbus-agent/local";
export type { LocalConfig, SessionStore, SessionContext } from "nimbus-agent/local";
export { SqliteSessionStore, FileSessionStore } from "nimbus-agent/local";
export { serve } from "nimbus-agent/local";

// Shared base (both inherit)
export type { NimbusPlugin, ToolDef, ToolContext } from "nimbus-agent";

// Model providers (work on both)
export { workersAI } from "nimbus-agent/models";   // Cloudflare only
export { unified } from "nimbus-agent/models";       // Both (if AI Gateway reachable)

// Testing
export { mockModel, MockModelRunner } from "nimbus-agent/testing";
```

---

## 9. File Structure (Updated)

```
packages/agent/src/
├── index.ts                    # Main exports (NimbusChatAgent + types)
├── nimbus-agent.ts             # NimbusChatAgent (Cloudflare)
├── nimbus-base.ts              # NimbusBase (shared abstract class)
├── worker.ts                   # Cloudflare Worker entry
│
├── core/
│   ├── types.ts                # Shared types
│   ├── errors.ts               # Error hierarchy
│   ├── tools.ts                # Tool execution engine
│   └── index.ts
│
├── local/                      # NEW — Local runtime
│   ├── index.ts                 # Exports: NimbusLocal, serve, stores
│   ├── nimbus-local.ts          # NimbusLocal class
│   ├── server.ts                # Bun.serve WebSocket + HTTP server
│   ├── session-store.ts         # SessionStore interface
│   ├── stores/
│   │   ├── sqlite.ts            # SqliteSessionStore (bun:sqlite / better-sqlite3)
│   │   ├── file.ts              # FileSessionStore (JSON per session)
│   │   └── cap.ts               # CapSessionStore (Capybara format)
│   ├── wire-protocol.ts         # MessageType enum + serialization
│   └── abort-registry.ts        # Per-request AbortController management
│
├── models/
│   ├── index.ts
│   ├── workers-ai.ts            # Cloudflare Workers AI
│   └── unified.ts               # AI Gateway unified
│
├── presets/
│   ├── index.ts
│   ├── http.ts
│   └── data.ts
│
└── testing/
    ├── index.ts
    └── mock.ts
```

---

*Same harness. Same protocol. Any runtime.* ⚡🐉