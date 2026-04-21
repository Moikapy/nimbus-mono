/**
 * 0xNIMBUS — The Cloudflare agent harness. Everything except the model.
 *
 * NimbusChatAgent extends AIChatAgent from the Cloudflare Agents SDK.
 * You add domain tools via .use(plugin). The harness handles the rest.
 *
 * For local development (Bun/Node), import from "nimbus-agent/local".
 */

// Main export — the Cloudflare agent class
export { NimbusChatAgent } from "./nimbus-agent";
export type { Env } from "./nimbus-agent";

// Shared base (for extending)
export { NimbusBase } from "./nimbus-base";

// Types
export type {
  ModelRef,
  NimbusPlugin,
  ToolDef,
  ToolCall,
  ToolResult,
  ToolContext,
  McpServerConfig,
  ResolvedTool,
  TraceType,
  NimbusTrace,
  NimbusSource,
  McpConnectionSummary,
  StreamChunkType,
  StreamChunk,
  Message,
  MessageRole,
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
} from "./core/types";

// Error hierarchy
export {
  NimbusError,
  ModelError,
  ToolValidationError,
  ToolExecutionError,
  McpConnectionError,
  McpToolError,
  ContextOverflowError,
  TimeoutError,
  MaxStepsError,
} from "./core/errors";

// Tool execution (for custom plugin authors)
export { executeTools, executeTool, hasTool, getTool } from "./core/tools";

// Model providers (Cloudflare-specific)
export { workersAI } from "./models/workers-ai";
export { unified } from "./models/unified";

// Testing
export { mockModel, MockModelRunner } from "./testing/mock";
export type { MockModelResponse, MockModelConfig } from "./testing/mock";

// Presets
export { httpTools } from "./presets/http";
export { dataTools } from "./presets/data";