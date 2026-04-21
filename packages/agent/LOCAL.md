# Local Development with NimbusLocal

> Develop and test your Nimbus agents locally on Bun/Node. Same plugins. Same wire protocol. No Cloudflare account needed.

## Quick Start

```bash
# Install
bun add nimbus-agent

# Install Ollama for local models
ollama pull llama3.2:latest

# Run the demo
bun run demo/local-chat.ts
```

That's it. WebSocket server on `:8787`, SQLite sessions, streaming responses.

---

## Architecture

```
Client (useAgentChat or any WebSocket)
    ↓ ws://localhost:8787/agents/:name/:sessionId
Bun.serve (WebSocket)
    ↓ MessageType.CHAT_REQUEST
NimbusLocal
    ├── SqliteSessionStore (messages, chunks, state)
    ├── Plugin tools (Zod schemas + execute)
    ├── streamText() (AI SDK v6)
    └── textStream → CHAT_RESPONSE chunks
```

---

## 1. Install

```bash
bun add nimbus-agent ollama-ai-provider-v2 zod
```

If you plan to use `SqliteSessionStore` with Node.js, also install:

```bash
bun add better-sqlite3
```

(Bun users get `bun:sqlite` built-in — no extra dependency.)

---

## 2. Create an Agent

```typescript
// src/agent.ts
import { NimbusLocal } from "nimbus-agent/local";
import { z } from "zod";
import { createOllama } from "ollama-ai-provider-v2";

const ollama = createOllama({ baseURL: "http://localhost:11434/api" });

export class MyAgent extends NimbusLocal {
  /** Choose your model */
  resolveModel() {
    return ollama("llama3.2:latest");
  }
}

// Plugins (optional but recommended)
const mathPlugin = {
  name: "math",
  description: "Calculate math",
  instructions: "When asked to calculate, always use the calculator tool.",
  tools: {
    calc: {
      description: "Calculate arithmetic",
      parameters: z.object({ operation: z.enum(["add", "subtract", "multiply", "divide"]), a: z.number(), b: z.number() }),
      execute: async ({ operation, a, b }) => {
        if (operation === "add") return a + b;
        if (operation === "subtract") return a - b;
        if (operation === "multiply") return a * b;
        if (operation === "divide") return a / b;
      },
    },
  },
};

MyAgent.use(mathPlugin);
```

---

## 3. Start the Server

```typescript
// src/server.ts
import { serve, SqliteSessionStore } from "nimbus-agent/local";
import { MyAgent } from "./agent";

const store = new SqliteSessionStore({ filename: "./sessions.db" });

serve({
  agent: MyAgent,
  store,
  port: 8787,
  onSessionCreate: (id) => console.log(`Session: ${id}`),
});
```

```bash
bun run src/server.ts
```

### HTTP Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Health check `{ status: "ok", sessions: N }` |
| `/health` | GET | Same as `/` |
| `/get-messages` | GET | Load messages for current session |
| `/:agent/:sessionId` | WS | WebSocket — chat, messages, clear |

---

## 4. Connect a Client

### React (useAgentChat)

The same `useAgentChat` hook from `@cloudflare/ai-chat` works unchanged:

```tsx
// app/page.tsx
import { useAgentChat } from "@cloudflare/ai-chat";

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit } = useAgentChat({
    agent: "MyAgent",
    host: "ws://localhost:8787",
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id} className={m.role}>{m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask me anything..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

### Raw WebSocket (vanilla JS)

```javascript
const ws = new WebSocket("ws://localhost:8787/agents/MyAgent/demo-session");

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "cf_agent_use_chat_request",
    id: "msg-1",
    init: {
      body: JSON.stringify({
        messages: [{
          id: "user-1",
          role: "user",
          content: "What is 2+2?",
          parts: [{ type: "text", text: "What is 2+2?" }],
        }],
      }),
    },
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "cf_agent_use_chat_response") {
    if (msg.body) process.stdout.write(msg.body);
    if (msg.done) console.log("\n[done]");
  }
};
```

---

## 5. Session Persistence

### SqliteSessionStore (recommended)

```typescript
const store = new SqliteSessionStore({ filename: "./sessions.db" });
```

- Messages persisted across server restarts
- Stream chunks stored for resume on reconnect
- Agent state (arbitrary JSON) per session
- `bun:sqlite` on Bun, `better-sqlite3` fallback on Node.js

### FileSessionStore (development)

```typescript
import { FileSessionStore } from "nimbus-agent/local";
const store = new FileSessionStore({ dir: "./.sessions" });
```

- Zero dependencies, JSON files per session
- Not suitable for production

---

## 6. Wire Protocol

Same as Cloudflare. 14 message types:

| Type | Direction | Purpose |
|------|-----------|---------|
| `cf_agent_use_chat_request` | C→S | Start a chat |
| `cf_agent_use_chat_response` | S→C | Stream chunk |
| `cf_agent_chat_messages` | C↔S | Message list sync |
| `cf_agent_chat_clear` | C→S | Clear history |
| `cf_agent_chat_request_cancel` | C→S | Abort request |
| `cf_agent_stream_resume_request` | C→S | Check for resumable stream |
| `cf_agent_stream_resuming` | S→C | Resuming stream |
| `cf_agent_stream_resume_none` | S→C | No active stream |
| `cf_agent_tool_result` | C→S | Client-side tool result |
| `cf_agent_tool_approval` | C→S | Approve/deny tool |

---

## 7. Plugin API (local + Cloudflare)

```typescript
import { z } from "zod";

const myPlugin = {
  name: "my-tools",
  description: "Custom tools",
  instructions: "When asked about X, always use Y.",
  tools: {
    lookup: {
      description: "Look up data",
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }, ctx) => {
        // ctx has: agent, env, sessionId
        return { result: query.toUpperCase() };
      },
    },
  },
};

// Apply to any NimbusBase subclass
MyAgent.use(myPlugin);
```

---

## 8. Testing

```bash
# Unit tests (no DO needed)
cd packages/agent
npx vitest run tests/unit/

# Local e2e (spins up real server)
npx vitest run tests/e2e/local-e2e.test.ts
```

---

## 9. Deploying to Cloudflare

When you're ready, the same agent class works on Cloudflare with zero changes:

```typescript
// src/worker.ts (Cloudflare)
import { routeAgentRequest } from "agents";
import { MyAgent } from "./agent";
export { MyAgent };

export default {
  async fetch(request, env) {
    return (await routeAgentRequest(request, env))
      || new Response("Not Found", { status: 404 });
  },
};
```

See [`CLOUDFLARE.md`](./CLOUDFLARE.md) for the full deployment guide.

---

## 10. Troubleshooting

### "SqliteSessionStore requires bun:sqlite or better-sqlite3"

On Bun, this shouldn't happen — `bun:sqlite` is built-in. If it does, your runtime is likely Node.js, not Bun. Install `better-sqlite3` or switch to Bun.

### "WebSocket connection failed"

- Check Ollama is running: `ollama list`
- Check `http://localhost:11434` responds
- Check the server is up: `curl http://localhost:8787/health`

### Slow first response

Ollama loads models on first use. The first request may be slow (10-30s). Use `ollama run llama3.2:latest` to pre-warm the model.

---

## License

MIT

---

*Develop locally. Deploy globally. Fast as Kintoun.* ☁️⚡
