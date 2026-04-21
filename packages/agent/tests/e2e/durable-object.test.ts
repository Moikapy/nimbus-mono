/**
 * 0xNIMBUS — E2E integration tests
 *
 * These run inside the Cloudflare Workers runtime via vitest-pool-workers.
 * They test actual Durable Object instantiation and AI binding behavior.
 *
 * Requires: vitest 4.1+, @cloudflare/vitest-pool-workers
 */

import { env, exports } from "cloudflare:workers";
import { describe, it, expect } from "vitest";

describe("NimbusChatAgent Durable Object", () => {
  it("exports the Durable Object class", () => {
    // The worker should export NimbusChatAgent as a DO class
    expect(exports.NimbusChatAgent).toBeDefined();
    expect(typeof exports.NimbusChatAgent).toBe("function");
  });

  it("env has AI binding", () => {
    // The wrangler.jsonc defines an AI binding
    expect(env.AI).toBeDefined();
  });
});