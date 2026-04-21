/**
 * 0xNIMBUS — Local Demo
 *
 * Run a local chat server with NimbusLocal + Ollama.
 * Uses ollama-ai-provider-v2 (AI SDK v6 compatible).
 */

import { serve, SqliteSessionStore, NimbusLocal } from "../packages/agent/dist/local/index.js";
import type { NimbusPlugin } from "../packages/agent/dist/core/index.js";
import { z } from "zod";
import type { LanguageModel } from "ai";
import { createOllama } from "ollama-ai-provider-v2";

const ollama = createOllama({ baseURL: "http://localhost:11434/api" });

const demoPlugin: NimbusPlugin = {
  name: "demo-plugin",
  description: "Simple tools",
  tools: {
    get_time: {
      description: "Get current Unix timestamp",
      parameters: z.object({}),
      execute: async () => Date.now(),
    },
    calculator: {
      description: "Add, subtract, multiply, divide",
      parameters: z.object({ operation: z.enum(["add", "subtract", "multiply", "divide"]), a: z.number(), b: z.number() }),
      execute: async ({ operation, a, b }) => {
        switch (operation) {
          case "add": return a + b;
          case "subtract": return a - b;
          case "multiply": return a * b;
          case "divide": return b === 0 ? "Error: divide by zero" : a / b;
        }
      },
    },
  },
  instructions: "You are a helpful assistant. Use tools when needed.",
};

class DemoAgent extends NimbusLocal {
  resolveModel(): LanguageModel {
    return ollama("kimi-k2.6:cloud");
  }
}

const store = new SqliteSessionStore({ filename: "./data/demo.db" });

console.log("🚀 Starting NimbusLocal demo server...");
console.log("   Model: kimi-k2.6:cloud (via Ollama)");
console.log("   Store: SQLite at ./data/demo.db");
console.log("   Tools: get_time, calculator");
console.log("");

serve({
  agent: DemoAgent,
  store,
  port: 8787,
  onSessionCreate: (id) => console.log(`✅ Session created: ${id}`),
});

setTimeout(() => {
  const ws = new WebSocket(`ws://localhost:8787/agents/demo/demo-session`);

  ws.onopen = () => {
    console.log("🔌 WebSocket connected");
    console.log("💬 Sending: 'What is 2+2? Also, what time is it?'\n");

    ws.send(
      JSON.stringify({
        type: "cf_agent_use_chat_request",
        id: "msg-1",
        init: {
          body: JSON.stringify({
            messages: [
              {
                id: "user-1",
                role: "user",
                content: "What is 2+2? Also, what time is it?",
                parts: [{ type: "text", text: "What is 2+2? Also, what time is it?" }],
              },
            ],
          }),
        },
      })
    );
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case "cf_agent_use_chat_response": {
        if (msg.body) process.stdout.write(msg.body);
        if (msg.done) {
          console.log("\n\n✅ Response complete");
          ws.close();
          setTimeout(() => process.exit(0), 500);
        }
        break;
      }
      case "cf_agent_chat_messages": {
        void msg.messages; // could log count here
        break;
      }
    }
  };

  ws.onerror = (err) => console.error("❌ WebSocket error:", err);
  ws.onclose = () => console.log("🔌 WebSocket closed");
}, 1000);

setInterval(() => {}, 60000);
console.log("   Waiting for Ollama to initialize...\n");
