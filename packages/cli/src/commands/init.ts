/**
 * nimbus init — scaffold a new agent project
 */

import { mkdir, writeFile, cp } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { CommandContext } from "@moikapy/kapy";

export const initCommand = async (ctx: CommandContext): Promise<void> => {
  const rest = (ctx.args.rest || []) as string[];
  const name = rest[0];
  const template = (ctx.args.template || ctx.args.t || false) as boolean;

  if (!name) {
    ctx.error("Usage: nimbus init <name> [--template]");
    ctx.abort(2);
  }

  if (!/^[a-z0-9-]+$/.test(name)) {
    ctx.error(`Invalid project name: "${name}". Use lowercase letters, numbers, and hyphens only.`);
    ctx.abort(2);
  }

  const dir = resolve(process.cwd(), name);
  const spinner = ctx.spinner(`Scaffolding Nimbus project: ${name}`);
  spinner.start();

  try {
    await scaffold(name, dir, template);
    spinner.succeed(`Created ${name}`);

    console.log("\n" + "=".repeat(50));
    console.log("🌩️  Nimbus project created!");
    console.log("=".repeat(50));
    console.log(`\n  cd ${name}`);
    if (template) {
      console.log("  bun install");
      console.log("  nimbus dev          # Local server with Ollama");
      console.log("  nimbus deploy       # Deploy to Cloudflare");
    } else {
      console.log("  bun install");
      console.log("  nimbus dev          # Local server");
    }
    console.log("\n  Docs: https://github.com/Moikapy/nimbus-mono");
    console.log("=".repeat(50) + "\n");

    if (ctx.json) {
      console.log(JSON.stringify({ status: "success", project: name, path: dir }));
    }
  } catch (err) {
    spinner.fail(`Failed to create ${name}`);
    throw err;
  }
};

async function scaffold(name: string, dir: string, template: boolean): Promise<void> {
  // Directories
  await mkdir(join(dir, "src"), { recursive: true });
  await mkdir(join(dir, "src", "plugins"), { recursive: true });
  if (template) {
    await mkdir(join(dir, "migrations"), { recursive: true });
  }

  // Core files
  await writePackageJson(dir, name, template);
  await writeTsConfig(dir, template);
  await writeGitignore(dir);
  await writeAgentFile(dir);
  await writePluginExample(dir);

  if (template) {
    await writeWranglerConfig(dir, name);
    await writeWorkerEntry(dir);
    await writeMigration(dir);
  } else {
    await writeLocalEntry(dir);
  }
}

async function writePackageJson(dir: string, name: string, template: boolean): Promise<void> {
  const pkg: Record<string, unknown> = {
    name,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: template ? "wrangler dev" : "bun run src/index.ts",
      build: "tsc",
      deploy: "wrangler deploy",
    },
    dependencies: {
      "nimbus-agent": "^0.2.0-alpha.1",
      zod: "^4.3.6",
    },
    devDependencies: {
      typescript: "^5.8.0",
      "@types/bun": "^1.2.0",
    },
  };

  if (template) {
    (pkg.devDependencies as Record<string, string>)["wrangler"] = "^4.0.0";
    (pkg.devDependencies as Record<string, string>)["@cloudflare/workers-types"] = "^4.20250414.0";
  }

  await writeFile(join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
}

async function writeTsConfig(dir: string, template: boolean): Promise<void> {
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ES2022",
      moduleResolution: "bundler",
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      types: template ? ["@cloudflare/workers-types", "@types/bun"] : ["@types/bun"],
    },
    include: ["src"],
  };
  await writeFile(join(dir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2) + "\n");
}

async function writeGitignore(dir: string): Promise<void> {
  await writeFile(
    join(dir, ".gitignore"),
    `node_modules/
dist/
*.db
*.sqlite
.env
.DS_Store
.wrangler/
`
  );
}

async function writeAgentFile(dir: string): Promise<void> {
  const code = `import { z } from "zod";

/**
 * Example plugin — add your own tools here
 */
export const myPlugin = {
  name: "my-tools",
  description: "My custom tools",
  instructions: "When asked about time, use the get_time tool.",
  tools: {
    get_time: {
      description: "Get current Unix timestamp",
      parameters: z.object({}),
      execute: async () => Date.now(),
    },
  },
};
`;
  await writeFile(join(dir, "src", "plugins", "index.ts"), code);
}

async function writePluginExample(dir: string): Promise<void> {
  const code = `export * from "./index.js";
`;
  await writeFile(join(dir, "src", "plugins", "hello.ts"), code);
}

async function writeLocalEntry(dir: string): Promise<void> {
  const code = `/**
 * Local Nimbus Agent Server
 *
 * Run with: bun run src/index.ts
 */

import { serve, SqliteSessionStore, NimbusLocal } from "nimbus-agent/local";
import { createOllama } from "ollama-ai-provider-v2";
import { myPlugin } from "./plugins/index.js";

const ollama = createOllama({ baseURL: "http://localhost:11434/api" });

class MyAgent extends NimbusLocal {
  resolveModel() {
    return ollama("llama3.2:latest");
  }
}

const store = new SqliteSessionStore({ filename: "./sessions.db" });

serve({
  agent: MyAgent,
  store,
  port: 8787,
  onSessionCreate: (id) => console.log(\`Session: \${id}\`),
});

console.log("🌩️  Nimbus agent running on http://localhost:8787");
`;
  await writeFile(join(dir, "src", "index.ts"), code);
}

async function writeWranglerConfig(dir: string, name: string): Promise<void> {
  const config = {
    $schema: "node_modules/wrangler/config-schema.json",
    name,
    main: "src/worker.ts",
    compatibility_date: "2025-04-01",
    compatibility_flags: ["nodejs_compat"],
    ai: { binding: "AI" },
    d1_databases: [
      {
        binding: "DB",
        database_name: "nimbus-db",
        database_id: "__YOUR_D1_DATABASE_ID__",
      },
    ],
    durable_objects: {
      bindings: [
        {
          name: "MyAgent",
          class_name: "MyAgent",
        },
      ],
    },
    migrations: [
      {
        tag: "v1",
        new_classes: ["MyAgent"],
      },
    ],
  };

  await writeFile(join(dir, "wrangler.jsonc"), JSON.stringify(config, null, 2) + "\n");
}

async function writeWorkerEntry(dir: string): Promise<void> {
  const code = `/**
 * Cloudflare Worker Entry Point
 */

import { routeAgentRequest } from "agents";
import { NimbusChatAgent, workersAI } from "nimbus-agent";
import { myPlugin } from "./plugins/index.js";

export class MyAgent extends NimbusChatAgent {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.use(myPlugin);
  }

  resolveModel() {
    return workersAI("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const response = await routeAgentRequest(request, env);
    if (response) return response;

    if (new URL(request.url).pathname === "/") {
      return Response.json({ status: "ok", agent: "MyAgent" });
    }

    return new Response("Not Found", { status: 404 });
  },
};
`;
  await writeFile(join(dir, "src", "worker.ts"), code);
}

async function writeMigration(dir: string): Promise<void> {
  const sql = `-- Nimbus Agent tables
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_state (
  session_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
`;
  await writeFile(join(dir, "migrations", "0001_init.sql"), sql);
}
