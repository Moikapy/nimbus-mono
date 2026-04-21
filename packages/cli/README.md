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

## Quick Start

```bash
# 1. Create a project
nimbus init my-agent && cd my-agent && bun install

# 2. Start local server
nimbus local

# 3. Chat with your agent (in another terminal)
nimbus chat
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

### `nimbus login` — Authenticate
```bash
nimbus login cloudflare         # Save Cloudflare API token
nimbus login openai             # Save OpenAI API key
nimbus login anthropic          # Save Anthropic API key
nimbus login ollama             # Configure local Ollama URL
```

### `nimbus config` — Manage profiles
```bash
nimbus config show                    # Show all profiles
nimbus config set profile cloudflare  # Switch to cloudflare profile
nimbus config set baseUrl wss://...   # Set WebSocket endpoint
nimbus config set agent my-agent      # Set default agent name
nimbus config set model @cf/...       # Set default model
```

Profiles are stored in `~/.nimbus/config.json`. Credentials (API keys, tokens) are stored in `~/.nimbus/credentials.json` with `0600` permissions.

### `nimbus chat` — Terminal chat with any agent
```bash
nimbus chat                                    # Uses active profile
nimbus chat --profile=cloudflare              # Switch profile for this command
nimbus chat --session=my-session              # Custom session
nimbus chat --agent=my-agent --session=s1     # Custom agent + session
nimbus chat --base=wss://agent.moikas.com     # Remote base URL
nimbus chat --url=wss://agent.moikas.com/agents/a/s # Full override
```

### `nimbus deploy` — Deploy to Cloudflare Workers
```bash
nimbus deploy          # Deploy to production
nimbus deploy -e dev   # Deploy to dev environment
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

## Configuration

### Profiles

The CLI supports multiple profiles stored in `~/.nimbus/config.json`:

```json
{
  "version": 1,
  "activeProfile": "cloudflare",
  "profiles": [
    { "name": "local", "baseUrl": "ws://localhost:8787", "agent": "demo" },
    { "name": "cloudflare", "accountId": "...", "agent": "my-worker" }
  ]
}
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `NIMBUS_WS_URL` | Default WebSocket base URL |
| `NIMBUS_AGENT` | Default agent name |
| `NIMBUS_SESSION` | Default session ID |

## License
MIT
