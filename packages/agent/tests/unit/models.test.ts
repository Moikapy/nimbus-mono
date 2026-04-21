/**
 * 0xNIMBUS — Model provider tests
 *
 * Tests workersAI/unified model factories and string parsing.
 * Resolver tests removed — resolver.ts is legacy code replaced by AIChatAgent.
 */

import { describe, it, expect } from "vitest";
import { workersAI, isWorkersAI, parseWorkersAI } from "../../src/models/workers-ai";
import { unified, isUnified, parseUnified } from "../../src/models/unified";

// ─── workersAI ──────────────────────────────────────────────────────────────

describe("workersAI", () => {
  it("should create a workers-ai model reference", () => {
    expect(workersAI("@cf/zai-org/glm-4.7-flash")).toBe("workers-ai:@cf/zai-org/glm-4.7-flash");
  });

  it("should create a workers-ai model reference with custom binding", () => {
    expect(workersAI("@cf/zai-org/glm-4.7-flash", { binding: "MY_AI" }))
      .toBe("workers-ai:@cf/zai-org/glm-4.7-flash:MY_AI");
  });
});

describe("isWorkersAI", () => {
  it("should detect workers-ai references", () => {
    expect(isWorkersAI("workers-ai:foo")).toBe(true);
    expect(isWorkersAI("unified:bar")).toBe(false);
    expect(isWorkersAI("gpt-4")).toBe(false);
  });
});

describe("parseWorkersAI", () => {
  it("should parse workers-ai references", () => {
    const result = parseWorkersAI("workers-ai:@cf/zai-org/glm-4.7-flash");
    expect(result.model).toBe("@cf/zai-org/glm-4.7-flash");
    expect(result.binding).toBe("AI");
  });

  it("should parse workers-ai references with custom binding", () => {
    const result = parseWorkersAI("workers-ai:@cf/meta/llama-3.3-70b-instruct-fp8-fast:MY_AI");
    expect(result.model).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    expect(result.binding).toBe("MY_AI");
  });

  it("should throw for non-workers-ai references", () => {
    expect(() => parseWorkersAI("unified:openai/gpt-5.2")).toThrow();
  });
});

// ─── unified ────────────────────────────────────────────────────────────────

describe("unified", () => {
  it("should create a unified model reference", () => {
    expect(unified("openai/gpt-5.2")).toBe("unified:openai/gpt-5.2");
  });

  it("should create a unified model reference with API key", () => {
    expect(unified("anthropic/claude-4-5-sonnet", { apiKey: "sk-123" }))
      .toBe("unified:anthropic/claude-4-5-sonnet::sk-123");
  });
});

describe("isUnified", () => {
  it("should detect unified references", () => {
    expect(isUnified("unified:openai/gpt-5.2")).toBe(true);
    expect(isUnified("workers-ai:foo")).toBe(false);
    expect(isUnified("gpt-4")).toBe(false);
  });
});

describe("parseUnified", () => {
  it("should parse unified references", () => {
    const result = parseUnified("unified:openai/gpt-5.2");
    expect(result.provider).toBe("openai");
    expect(result.modelName).toBe("gpt-5.2");
    expect(result.apiKey).toBeUndefined();
  });

  it("should parse unified references with API key", () => {
    const result = parseUnified("unified:anthropic/claude-4-5-sonnet::sk-123");
    expect(result.provider).toBe("anthropic");
    expect(result.modelName).toBe("claude-4-5-sonnet");
    expect(result.apiKey).toBe("sk-123");
  });

  it("should throw for non-unified references", () => {
    expect(() => parseUnified("workers-ai:foo")).toThrow();
  });

  it("should throw for invalid unified path format", () => {
    expect(() => parseUnified("unified:invalid-no-slash")).toThrow();
  });
});