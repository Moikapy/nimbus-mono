/**
 * 0xNIMBUS — NimbusLocal + SessionStore tests
 *
 * Tests the local agent class, plugin composition, and session store.
 * These run in plain vitest (no Workers runtime needed).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NimbusLocal } from "../../src/local/nimbus-local";
import { FileSessionStore } from "../../src/local/stores/file";
import { NimbusBase } from "../../src/nimbus-base";
import type { NimbusPlugin, ToolDef } from "../../src/core/types";
import { z } from "zod";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ─── FileSessionStore fixtures ────────────────────────────────────────────────

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "nimbus-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ─── NimbusBase (via NimbusLocal) ────────────────────────────────────────────

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
    },
    instructions: "Always calculate precisely. Show your work.",
  };
}

function createLocalAgent(sessionId = "test-session"): NimbusLocal {
  const store = new FileSessionStore({ directory: join(tempDir, "sessions") });
  return new NimbusLocal({
    sessionId,
    store,
    env: { test: true },
    modelResolver: () => {
      throw new Error("No model configured for test");
    },
  });
}

// ─── .use(plugin) ─────────────────────────────────────────────────────────────

describe("NimbusLocal.use()", () => {
  it("registers a single plugin", () => {
    const agent = createLocalAgent();
    agent.use(pingPlugin());
    expect(agent.plugins()).toEqual(["ping-plugin"]);
  });

  it("chains multiple plugins", () => {
    const agent = createLocalAgent();
    agent.use(calcPlugin()).use(pingPlugin());
    expect(agent.plugins()).toEqual(["calc-plugin", "ping-plugin"]);
  });

  it("plugin instructions merge with --- separator", () => {
    const agent = createLocalAgent();
    agent.use(calcPlugin());
    expect(agent.getSystemInstructions()).toBe("Always calculate precisely. Show your work.");
  });

  it("multiple plugin instructions chain", () => {
    const agent = createLocalAgent();
    agent.use({ name: "a", instructions: "Rule A" });
    agent.use({ name: "b", instructions: "Rule B" });
    const instructions = agent.getSystemInstructions()!;
    expect(instructions).toContain("Rule A");
    expect(instructions).toContain("--- b ---");
    expect(instructions).toContain("Rule B");
  });

  it("returns this for chaining", () => {
    const agent = createLocalAgent();
    const result = agent.use(pingPlugin());
    expect(result).toBe(agent);
  });
});

// ─── .setModel() ────────────────────────────────────────────────────────────

describe("NimbusLocal.setModel()", () => {
  it("sets the model reference", () => {
    const agent = createLocalAgent();
    agent.setModel("ollama/llama3.3");
    expect(agent.getModelRef()).toBe("ollama/llama3.3");
  });

  it("default model is glm-4.7-flash", () => {
    const agent = createLocalAgent();
    expect(agent.getModelRef()).toBe("@cf/zai-org/glm-4.7-flash");
  });
});

// ─── .resolveModel() ─────────────────────────────────────────────────────────

describe("NimbusLocal.resolveModel()", () => {
  it("throws if no model resolver configured", () => {
    const agent = new NimbusLocal({
      sessionId: "test",
      store: new FileSessionStore({ directory: tempDir }),
    });
    expect(() => agent.resolveModel()).toThrow("No model resolver configured");
  });

  it("uses modelResolver from config", () => {
    const fakeModel = {} as any;
    const agent = new NimbusLocal({
      sessionId: "test",
      store: new FileSessionStore({ directory: tempDir }),
      modelResolver: () => fakeModel,
    });
    expect(agent.resolveModel()).toBe(fakeModel);
  });
});

// ─── .messages ─────────────────────────────────────────────────────────────

describe("NimbusLocal messages", () => {
  it("starts with empty messages", () => {
    const agent = createLocalAgent();
    expect(agent.messages).toEqual([]);
  });

  it("persistMessages saves to store", async () => {
    const agent = createLocalAgent();
    const msgs = [{ id: "1", role: "user" as const, content: "hello", parts: [] }];
    await agent.persistMessages(msgs as any);
    expect(agent.messages).toEqual(msgs);
  });

  it("loadMessages restores from store", async () => {
    const sessionId = "persist-test";
    const store = new FileSessionStore({ directory: join(tempDir, "sessions") });

    // Save with one agent
    const agent1 = new NimbusLocal({
      sessionId,
      store,
      modelResolver: () => ({}) as any,
    });
    const msgs = [{ id: "1", role: "user" as const, content: "hello", parts: [] }];
    await agent1.persistMessages(msgs as any);

    // Load with another agent
    const agent2 = new NimbusLocal({
      sessionId,
      store,
      modelResolver: () => ({}) as any,
    });
    await agent2.loadMessages();
    expect(agent2.messages.length).toBe(1);
    expect((agent2.messages[0] as any).content).toBe("hello");
  });

  it("prunes to maxPersistedMessages", async () => {
    const agent = createLocalAgent();
    agent.maxPersistedMessages = 3;
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      role: "user" as const,
      content: `msg ${i}`,
      parts: [],
    }));
    await agent.persistMessages(msgs as any);
    expect(agent.messages.length).toBe(3);
    expect((agent.messages[0] as any).content).toBe("msg 7");
  });
});

// ─── .state ─────────────────────────────────────────────────────────────────

describe("NimbusLocal state", () => {
  it("starts with null state", () => {
    const agent = createLocalAgent();
    expect(agent.state).toBeNull();
  });

  it("setState persists to store", async () => {
    const agent = createLocalAgent();
    await agent.setState({ counter: 42 });
    expect(agent.state).toEqual({ counter: 42 });
  });

  it("loadState restores from store", async () => {
    const sessionId = "state-test";
    const store = new FileSessionStore({ directory: join(tempDir, "sessions") });

    const agent1 = new NimbusLocal({
      sessionId,
      store,
      modelResolver: () => ({}) as any,
    });
    await agent1.setState({ mood: "happy" });

    const agent2 = new NimbusLocal({
      sessionId,
      store,
      modelResolver: () => ({}) as any,
    });
    await agent2.loadState();
    expect(agent2.state).toEqual({ mood: "happy" });
  });
});

// ─── .init() ─────────────────────────────────────────────────────────────────

describe("NimbusLocal.init()", () => {
  it("loads messages and state from store", async () => {
    const sessionId = "init-test";
    const store = new FileSessionStore({ directory: join(tempDir, "sessions") });

    // Pre-populate
    const agent1 = new NimbusLocal({
      sessionId,
      store,
      modelResolver: () => ({}) as any,
    });
    await agent1.persistMessages([{ id: "1", role: "user", content: "hi", parts: [] }] as any);
    await agent1.setState({ step: 5 });

    // Init fresh agent
    const agent2 = new NimbusLocal({
      sessionId,
      store,
      modelResolver: () => ({}) as any,
    });
    await agent2.init();
    expect(agent2.messages.length).toBe(1);
    expect(agent2.state).toEqual({ step: 5 });
  });
});

// ─── Session isolation ──────────────────────────────────────────────────────

describe("Session isolation", () => {
  it("different session IDs have isolated state", async () => {
    const store = new FileSessionStore({ directory: join(tempDir, "sessions") });

    const agent1 = new NimbusLocal({
      sessionId: "session-a",
      store,
      modelResolver: () => ({}) as any,
    });
    const agent2 = new NimbusLocal({
      sessionId: "session-b",
      store,
      modelResolver: () => ({}) as any,
    });

    await agent1.setState({ owner: "alice" });
    await agent2.setState({ owner: "bob" });

    await agent1.loadState();
    await agent2.loadState();

    expect(agent1.state).toEqual({ owner: "alice" });
    expect(agent2.state).toEqual({ owner: "bob" });
  });
});

// ─── nimbusTools() ──────────────────────────────────────────────────────────

describe("NimbusLocal.nimbusTools()", () => {
  it("converts plugin tools to AI SDK format", () => {
    const agent = createLocalAgent();
    agent.use(pingPlugin());

    const tools = agent.nimbusTools();
    expect(tools["ping"]).toBeDefined();
    expect(tools["ping"]).toHaveProperty("description");
    expect(tools["ping"]).toHaveProperty("parameters");
    expect(tools["ping"]).toHaveProperty("execute");
  });

  it("tool execute calls original handler", async () => {
    const agent = createLocalAgent();
    agent.use(calcPlugin());

    const tools = agent.nimbusTools();
    const result = await (tools["add"] as any).execute({ a: 7, b: 3 });
    expect(result).toBe(10);
  });
});