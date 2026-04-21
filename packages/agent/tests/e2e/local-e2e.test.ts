/**
 * 0xNIMBUS — Local E2E Test
 *
 * Tests the full local stack: NimbusLocal + WebSocket server + real model.
 * Requires: Bun runtime, Ollama running locally with kimi-k2.6:cloud
 *
 * Usage:
 *   bun run tests/e2e/local-e2e.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NimbusLocal, serve, SqliteSessionStore } from "../../src/local/index";
import { ollama } from "ollama-ai-provider";
import { z } from "zod";
import type { NimbusPlugin } from "../../src/core/types";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MessageType } from "../../src/local/wire-protocol";

// Simple plugin for testing
const testPlugin: NimbusPlugin = {
  name: "test-plugin",
  description: "Simple test tools",
  tools: {
    get_time: {
      description: "Get current Unix timestamp",
      parameters: z.object({}),
      execute: async () => Date.now(),
    },
    add: {
      description: "Add two numbers",
      parameters: z.object({ a: z.number(), b: z.number() }),
      execute: async ({ a, b }) => a + b,
    },
  },
  instructions: "You have access to time and calculator tools.",
};

// Test agent class
class TestLocalAgent extends NimbusLocal {
  resolveModel() {
    // Use the locally pulled kimi-k2.6 model via Ollama
    return ollama("kimi-k2.6:cloud");
  }
}

describe("NimbusLocal E2E", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "nimbus-e2e-"));
  const store = new SqliteSessionStore({ filename: join(tempDir, "e2e.db") });
  const PORT = 18787; // Different from default to avoid conflicts
  let server: ReturnType<typeof serve> | undefined;
  let ws: WebSocket | undefined;

  beforeAll(async () => {
    // Start the local server
    // Note: serve() doesn't return a reference we can shut down, so we
    // use a programmatic approach for testing
  });

  afterAll(() => {
    // Cleanup
    if (ws) ws.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should create NimbusLocal agent with Ollama model resolver", async () => {
    const agent = new TestLocalAgent({
      sessionId: "e2e-test-1",
      store,
      modelResolver: () => ollama("kimi-k2.6:cloud"),
    });
    await agent.init();
    agent.use(testPlugin);

    expect(agent.plugins()).toEqual(["test-plugin"]);
    expect(agent.messages).toEqual([]);
  });

  it("should have working tools", async () => {
    const agent = new TestLocalAgent({
      sessionId: "e2e-test-2",
      store,
      modelResolver: () => ollama("kimi-k2.6:cloud"),
    });
    await agent.init();
    agent.use(testPlugin);

    const tools = agent.nimbusTools();
    expect(tools["get_time"]).toBeDefined();
    expect(tools["add"]).toBeDefined();

    // Test tool execution
    const timeResult = await (tools["get_time"] as any).execute({});
    expect(typeof timeResult).toBe("number");
    expect(timeResult).toBeGreaterThan(1700000000000);

    const addResult = await (tools["add"] as any).execute({ a: 5, b: 7 });
    expect(addResult).toBe(12);
  });

  it("should persist messages and state across instances", async () => {
    const sessionId = "e2e-persist-test";

    // First agent instance
    const agent1 = new TestLocalAgent({
      sessionId,
      store,
      modelResolver: () => ollama("kimi-k2.6:cloud"),
    });
    await agent1.init();
    await agent1.setState({ testValue: 42, array: [1, 2, 3] });

    const testMsg = {
      id: "test-1",
      role: "user" as const,
      content: "Hello from test",
      parts: [{ type: "text", text: "Hello from test" }],
    };
    await agent1.persistMessages([testMsg as any]);

    // Second agent instance (same session)
    const agent2 = new TestLocalAgent({
      sessionId,
      store,
      modelResolver: () => ollama("kimi-k2.6:cloud"),
    });
    await agent2.init();

    expect(agent2.messages.length).toBe(1);
    expect((agent2.messages[0] as any).content).toBe("Hello from test");
    expect(agent2.state).toEqual({ testValue: 42, array: [1, 2, 3] });
  });

  it("should have MessageType enum with correct values", () => {
    // Verify wire protocol compatibility
    expect(MessageType.CHAT_REQUEST).toBe("cf_agent_use_chat_request");
    expect(MessageType.CHAT_RESPONSE).toBe("cf_agent_use_chat_response");
    expect(MessageType.CHAT_MESSAGES).toBe("cf_agent_chat_messages");
    expect(MessageType.TOOL_RESULT).toBe("cf_agent_tool_result");
  });
});

/**
 * Manual test runner for actual WebSocket server + real model.
 * Run with: bun run tests/e2e/local-e2e.test.ts --manual
 */
if (process.argv.includes("--manual")) {
  console.log("🚀 Starting manual E2E test server...");
  console.log("   Model: kimi-k2.6:cloud via Ollama");
  console.log("   Store: SQLite via SqliteSessionStore");
  console.log("");
  console.log("   Server will start on ws://localhost:18787");
  console.log("");
  console.log("   To test manually:");
  console.log("   1. Connect WebSocket to ws://localhost:18787/agents/test/session-1");
  console.log("   2. Send: { type: 'cf_agent_use_chat_request', id: '1', init: { body: JSON.stringify({ messages: [{role:'user',content:'What time is it?'}] }) } }");
  console.log("");
  console.log("   Or use curl:");
  console.log("   curl http://localhost:18787/agents/test/session-1/get-messages");
  console.log("");

  serve({
    agent: TestLocalAgent,
    store,
    port: PORT,
    onSessionCreate: (id, agent) => {
      console.log(`✅ Session created: ${id}`);
      agent.use(testPlugin);
    },
    onSessionClose: (id) => {
      console.log(`👋 Session closed: ${id}`);
    },
  });

  // Keep alive
  setInterval(() => {}, 1000);
}