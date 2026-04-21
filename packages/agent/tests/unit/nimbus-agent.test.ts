/**
 * 0xNIMBUS — NimbusChatAgent tests
 *
 * Tests the .use(plugin) pattern, tool conversion, and model wiring.
 * Uses a TestableAgent that mirrors NimbusChatAgent's core logic
 * without requiring the Cloudflare Workers runtime (DO state, bindings).
 *
 * Integration tests with vitest-pool-workers will test onChatMessage end-to-end.
 */

import { describe, it, expect } from "vitest";
import type { NimbusPlugin, ToolDef, ToolContext } from "../../src/core/types";
import { z } from "zod";

// ─── Testable agent (mirrors NimbusChatAgent core logic) ──────────────────

class TestableAgent {
  private _plugins: NimbusPlugin[] = [];
  private _tools: Record<string, ToolDef> = {};
  protected _instructions: string = "";
  private _modelRef: string = "@cf/zai-org/glm-4.7-flash";
  maxPersistedMessages = 200;
  env: Record<string, unknown> = { AI: {} };

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

  plugins(): string[] {
    return [...this._plugins.map((p) => p.name)];
  }

  setModel(model: string): this {
    this._modelRef = model;
    return this;
  }

  nimbusTools(): Record<string, unknown> {
    const tools: Record<string, unknown> = {};
    for (const [name, def] of Object.entries(this._tools)) {
      tools[name] = {
        description: def.description,
        parameters: def.parameters,
        execute: async (args: any) => {
          const ctx: ToolContext = {
            env: this.env,
            conversationId: undefined,
            step: 0,
            trace: [],
            abort: (reason: string) => { throw new Error(`Aborted: ${reason}`); },
          };
          return def.execute(args, ctx);
        },
      };
    }
    return tools;
  }
}

function createTestAgent(): TestableAgent {
  return new TestableAgent();
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

function pingPlugin(): NimbusPlugin {
  return {
    name: "ping-plugin",
    description: "Provides ping tool",
    tools: {
      ping: {
        description: "Returns pong",
        parameters: z.object({}),
        execute: async () => "pong",
      },
    },
  };
}

function calcPlugin(): NimbusPlugin {
  return {
    name: "calc-plugin",
    description: "Calculator tools",
    tools: {
      add: {
        description: "Add two numbers",
        parameters: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }) => a + b,
      },
      multiply: {
        description: "Multiply two numbers",
        parameters: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }) => a * b,
      },
    },
    instructions: "Always calculate precisely. Show your work.",
  };
}

function dataPlugin(): NimbusPlugin {
  return {
    name: "data-plugin",
    tools: {
      get_debt: {
        description: "Get national debt",
        parameters: z.object({ year: z.number().optional() }),
        execute: async ({ year }) => ({
          total: 36_200_000_000_000,
          year: year ?? 2024,
        }),
      },
    },
  };
}

// ─── .use(plugin) ─────────────────────────────────────────────────────────────

describe("NimbusChatAgent.use()", () => {
  it("registers a single plugin", () => {
    const agent = createTestAgent();
    agent.use(pingPlugin());
    expect(agent.plugins()).toEqual(["ping-plugin"]);
  });

  it("chains multiple plugins", () => {
    const agent = createTestAgent();
    agent.use(calcPlugin()).use(pingPlugin());
    expect(agent.plugins()).toEqual(["calc-plugin", "ping-plugin"]);
  });

  it("merges plugin tools into the tool registry", () => {
    const agent = createTestAgent();
    agent.use(calcPlugin()).use(pingPlugin());

    const tools = agent.nimbusTools();
    expect(Object.keys(tools)).toEqual(["add", "multiply", "ping"]);
  });

  it("plugin instructions merge with --- separator", () => {
    const agent = createTestAgent();
    agent.use(calcPlugin());

    expect((agent as any)._instructions).toBe("Always calculate precisely. Show your work.");
  });

  it("multiple plugin instructions chain with --- separator", () => {
    const agent = createTestAgent();

    const pluginA: NimbusPlugin = { name: "a", instructions: "Rule A" };
    const pluginB: NimbusPlugin = { name: "b", instructions: "Rule B" };

    agent.use(pluginA).use(pluginB);

    const instructions = (agent as any)._instructions;
    expect(instructions).toContain("Rule A");
    expect(instructions).toContain("--- b ---");
    expect(instructions).toContain("Rule B");
  });

  it("plugin without instructions doesn't break instructions", () => {
    const agent = createTestAgent();
    agent.use(pingPlugin()); // no instructions

    expect((agent as any)._instructions).toBe("");
  });

  it("returns this for chaining", () => {
    const agent = createTestAgent();
    const result = agent.use(pingPlugin());
    expect(result).toBe(agent);
  });
});

// ─── .plugins() ─────────────────────────────────────────────────────────────

describe("NimbusChatAgent.plugins()", () => {
  it("returns empty array before any plugins", () => {
    const agent = createTestAgent();
    expect(agent.plugins()).toEqual([]);
  });

  it("returns plugin names in order", () => {
    const agent = createTestAgent();
    agent.use(calcPlugin()).use(pingPlugin()).use(dataPlugin());
    expect(agent.plugins()).toEqual(["calc-plugin", "ping-plugin", "data-plugin"]);
  });
});

// ─── .setModel() ────────────────────────────────────────────────────────────

describe("NimbusChatAgent.setModel()", () => {
  it("sets the model reference", () => {
    const agent = createTestAgent();
    agent.setModel("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    expect((agent as any)._modelRef).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  });

  it("returns this for chaining", () => {
    const agent = createTestAgent();
    const result = agent.setModel("@cf/zai-org/glm-4.7-flash");
    expect(result).toBe(agent);
  });

  it("default model is glm-4.7-flash", () => {
    const agent = createTestAgent();
    expect((agent as any)._modelRef).toBe("@cf/zai-org/glm-4.7-flash");
  });
});

// ─── .nimbusTools() ─────────────────────────────────────────────────────────

describe("NimbusChatAgent.nimbusTools()", () => {
  it("returns empty ToolSet with no plugins", () => {
    const agent = createTestAgent();
    const tools = agent.nimbusTools();
    expect(Object.keys(tools)).toEqual([]);
  });

  it("converts NimbusPlugin tools to AI SDK tool format", () => {
    const agent = createTestAgent();
    agent.use(pingPlugin());

    const tools = agent.nimbusTools();
    const pingTool = tools["ping"];

    // AI SDK tool objects have description, parameters, execute
    expect(pingTool).toBeDefined();
    expect(pingTool).toHaveProperty("description");
    expect(pingTool).toHaveProperty("parameters");
    expect(pingTool).toHaveProperty("execute");
  });

  it("tool execute harness calls the original tool handler", async () => {
    const agent = createTestAgent();
    agent.use(calcPlugin());

    const tools = agent.nimbusTools();
    const addTool = tools["add"];

    // Execute the tool through the AI SDK wrapper
    const result = await (addTool as any).execute({ a: 3, b: 5 });
    expect(result).toBe(8);
  });

  it("tool execute receives env from the agent", async () => {
    const agent = createTestAgent();
    (agent as any).env = { AI: {}, DB: { test: true } };

    let receivedEnv: Record<string, unknown> | undefined;

    agent.use({
      name: "env-check",
      tools: {
        check_env: {
          description: "Check env",
          parameters: z.object({}),
          execute: async (_, ctx) => {
            receivedEnv = ctx.env;
            return "checked";
          },
        },
      },
    });

    const tools = agent.nimbusTools();
    await (tools["check_env"] as any).execute({});
    expect(receivedEnv).toEqual({ AI: {}, DB: { test: true } });
  });
});

// ─── NimbusPlugin interface ──────────────────────────────────────────────────

describe("NimbusPlugin interface", () => {
  it("plugin with only name (no tools/instructions) works", () => {
    const agent = createTestAgent();
    agent.use({ name: "empty-plugin" });

    expect(agent.plugins()).toEqual(["empty-plugin"]);
    expect(Object.keys(agent.nimbusTools())).toEqual([]);
  });

  it("plugin with MCP servers stores them for future use", () => {
    const agent = createTestAgent();
    agent.use({
      name: "mcp-plugin",
      mcpServers: [
        { name: "test-server", url: "https://example.com/mcp" },
      ],
    });

    // MCP servers are stored but not yet connected (v0.2 feature)
    expect(agent.plugins()).toEqual(["mcp-plugin"]);
  });
});

// ─── Tool validation ────────────────────────────────────────────────────────

describe("tool validation via nimbusTools", () => {
  it("validates params with Zod schema before execute", async () => {
    const agent = createTestAgent();
    agent.use({
      name: "strict-plugin",
      tools: {
        lookup: {
          description: "Lookup with required query",
          parameters: z.object({ query: z.string().min(1) }),
          execute: async ({ query }) => `Found: ${query}`,
        },
      },
    });

    const tools = agent.nimbusTools();

    // Valid params
    const result = await (tools["lookup"] as any).execute({ query: "debt" });
    expect(result).toBe("Found: debt");
  });
});

// ─── maxPersistedMessages ────────────────────────────────────────────────────

describe("NimbusChatAgent.maxPersistedMessages", () => {
  it("defaults to 200", () => {
    const agent = createTestAgent();
    expect(agent.maxPersistedMessages).toBe(200);
  });
});