# Nimbus CLI

> The fastest way to scaffold, develop, and deploy Nimbus agents.

## Install

```bash
bun add -g @nimbus/cli
```

Or run directly:
```bash
bunx @nimbus/cli init my-agent
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

### `nimbus plugin-add <name>` — Add a plugin
```bash
nimbus plugin-add http     # Built-in plugin
nimbus plugin-add stripe   # Built-in plugin
```

### `nimbus plugin-list` — List plugins
```bash
nimbus plugin-list       # Human readable
nimbus plugin-list -j    # JSON output
```

### `nimbus model-list` — List AI models
```bash
nimbus model-list                    # All models
nimbus model-list -p workers-ai     # Filter by provider
nimbus model-list -j                # JSON output
```

### `nimbus model-use <id>` — Set default model
```bash
nimbus model-use llama3.2:latest
nimbus model-use @cf/meta/llama-3.3-70b-instruct-fp8-fast
```

### `nimbus logs` — Tail Cloudflare logs
```bash
nimbus logs      # Follow logs
nimbus logs -f   # Same (default)
```

### `nimbus version` — Show version
```bash
nimbus version
```

## Quick Workflow

```bash
# 1. Create project
nimbus init my-agent

# 2. Start developing
cd my-agent
bun install
nimbus dev          # Local server with Ollama

# 3. Deploy
cd my-agent
nimbus deploy       # Cloudflare Workers
```

## License

MIT
