/**
 * 0xNIMBUS — Mock model for testing
 *
 * Returns pre-defined responses in sequence.
 * When responses are exhausted, returns a generic fallback answer.
 *
 * Usage:
 * ```ts
 * import { mockModel } from "nimbus-agent/testing";
 *
 * const model = mockModel([
 *   { toolCalls: [{ id: "c1", tool: "weather", params: { city: "SF" } }] },
 *   { text: "It's 72°F in San Francisco." },
 * ]);
 * ```
 */

import type { ToolCall, Message } from "../core/types";

export interface MockModelResponse {
  text?: string;
  toolCalls?: ToolCall[];
}

export interface MockModelConfig {
  responses: MockModelResponse[];
  model?: string;
}

/**
 * In-memory mock model that tracks calls and returns responses in sequence.
 */
export class MockModelRunner {
  private callIndex = 0;
  private calls: Array<{ messages: Message[]; tools?: unknown[] }> = [];

  constructor(private responses: MockModelResponse[]) {}

  /**
   * Simulate a model call. Returns text and/or tool calls based on the next response.
   */
  call(messages: Message[], tools?: unknown[]): { text?: string; toolCalls?: ToolCall[] } {
    this.calls.push({ messages, tools });

    const response = this.responses[this.callIndex];
    this.callIndex++;

    if (!response) {
      return { text: "I don't have a response for that." };
    }

    return {
      text: response.text,
      toolCalls: response.toolCalls,
    };
  }

  /** Get all calls made to this model */
  getCalls() {
    return [...this.calls];
  }

  /** Reset for reuse in another test */
  reset() {
    this.callIndex = 0;
    this.calls = [];
  }
}

/**
 * Create a mock model for testing NimbusChatAgent subclasses.
 *
 * Returns a MockModelRunner you can use to simulate model behavior
 * in unit tests without a real Workers AI binding.
 *
 * @example
 * ```ts
 * const mock = mockModel([
 *   { toolCalls: [{ id: "c1", tool: "ping", params: {} }] },
 *   { text: "Pong!" },
 * ]);
 *
 * // In your test, override resolveModel to use the mock:
 * class TestAgent extends NimbusChatAgent {
 *   private mock = mock;
 *   protected resolveModel() { return null; }
 *   async onChatMessage() {
 *     const response = this.mock.call(this.messages);
 *     // ...
 *   }
 * }
 * ```
 */
export function mockModel(config: MockModelResponse[] | MockModelConfig): MockModelRunner {
  const responses = Array.isArray(config) ? config : config.responses;
  return new MockModelRunner(responses);
}