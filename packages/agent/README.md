# nimbus-agent

> 0xNIMBUS — Cloudflare-native AI agent with local-first runtime.

One harness. Many plugins. Run everywhere.

## Install

```bash
npm install nimbus-agent
```

## Cloudflare Workers

```typescript
import { NimbusChatAgent } from "nimbus-agent";

export class MyAgent extends NimbusChatAgent {
  resolveModel() {
    return workersAI("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  }
}
```

## Local Runtime (Bun)

```typescript
import { NimbusLocal, serve, SqliteSessionStore } from "nimbus-agent/local";

const store = new SqliteSessionStore({ filename: "./sessions.db" });

serve({ agent: MyAgent, store, port: 8787 });
```

## Plugins

```typescript
import { calculator, httpTools } from "nimbus-agent/presets";

agent.use(calculator);
agent.use(httpTools);
```

## License

MIT
