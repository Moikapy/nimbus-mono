# Nimbus CLI

> The fastest way to scaffold, develop, and deploy Nimbus agents.

## Install

```bash
bun add -g @moikapy/nimbus-cli
```

Or run directly:
```bash
bunx @moikapy/nimbus-cli init my-agent
```

## Commands

### `nimbus init <name>` — Scaffold a new project
```bash
nimbus init my-agent        # Local project
nimbus init my-agent -t     # With Cloudflare deploy template
```

### `nimbus dev` — Run development server
```bash
cd my-agent
nimbus dev   # Hot reload with Bun --watch
```

### `nimbus local` — Run production local server
```bash
nimbus local -p 8787 -s sqlite    # Port 8787, SQLite store
nimbus local -p 3000 -s file      # Port 3000, file store
```

### `nimbus deploy` — Deploy to Cloudflare Workers
```bash
nimbus deploy          # Deploy to production
nimbus deploy -e dev   # Deploy to dev environment
```

### `nimbus chat` — Terminal chat with any agent
```bash
nimbus chat                                    # Default: ws://localhost:8787/agents/demo/demo-session
nimbus chat --session my-session              # Custom session
nimbus chat --agent my-agent --session s1     # Custom agent + session
nimbus chat --base wss://agent.moikas.com     # Remote base URL
nimbus chat -u wss://agent.moikas.com/agents/a/s # Full override
```

### `nimbus plugin` — Plugin management
```bash
nimbus plugin add <name>      # Install plugin
nimbus plugin list            # List installed
```

### `nimbus model` — AI model management
```bash
nimbus model list             # List available models
nimbus model use <name>       # Set default
```

### `nimbus logs` — Tail Cloudflare logs
```bash
nimbus logs -f                # Follow logs
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NIMBUS_WS_URL` | Default WebSocket base URL |
| `NIMBUS_AGENT` | Default agent name |
| `NIMBUS_SESSION` | Default session ID |

## License
MIT
