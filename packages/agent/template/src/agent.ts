/**
 * My Nimbus Agent
 *
 * Extends NimbusChatAgent and adds plugins.
 * Deploy to Cloudflare Workers with `wrangler deploy`.
 */

import { NimbusChatAgent, workersAI } from "nimbus-agent";
import { z } from "zod";

// ── Example Plugin ──────────────────────────────────────────────

const helloPlugin = {
  name: "hello",
  description: "Greeting tools",
  instructions: "When the user says hello, use the greet tool.",
  tools: {
    greet: {
      description: "Return a greeting",
      parameters: z.object({ name: z.string() }),
      execute: async ({ name }) => `Hello, ${name}! Welcome to Nimbus. 🌩️`,
    },
  },
};

// ── Agent Definition ────────────────────────────────────────────

export class MyAgent extends NimbusChatAgent {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.use(helloPlugin);
  }

  /** Resolve model — Workers AI (free tier, no API key) */
  resolveModel() {
    return workersAI("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  }
}
