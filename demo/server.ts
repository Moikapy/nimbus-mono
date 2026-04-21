/** Simple NimbusLocal server for testing */
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
      description: "Calculate",
      parameters: z.object({ operation: z.enum(["add","subtract","multiply","divide"]), a: z.number(), b: z.number() }),
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
console.log("   WebSocket: ws://localhost:8787/agents/demo/demo-session");

serve({
  agent: DemoAgent,
  store,
  port: 8787,
  onSessionCreate: (id) => console.log(`✅ Session created: ${id}`),
});

setInterval(() => {}, 60000);
