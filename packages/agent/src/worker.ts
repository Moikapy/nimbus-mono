/**
 * 0xNIMBUS — Worker entry (Cloudflare Durable Objects)
 *
 * Only import this in Worker environments where `cloudflare:workers`
 * and `@cloudflare/ai-chat` are available.
 *
 * @example
 * ```ts
 * import { NimbusChatAgent } from "nimbus-agent/worker";
 * ```
 */

export { NimbusChatAgent } from "./nimbus-agent";

export type {
  ModelRef,
  Message,
  MessageRole,
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
  ToolCall,
  ToolResult,
  ToolContext,
  ToolDef,
  McpServerConfig,
  NimbusPlugin,
} from "./core/types";

export {
  NimbusError,
  ModelError,
  ToolValidationError,
  ToolExecutionError,
  ContextOverflowError,
  TimeoutError,
  MaxStepsError,
} from "./core/errors";

export { executeTools, executeTool } from "./core/tools";
export { workersAI, createWorkersAIProvider } from "./models/workers-ai";
export { unified, createAIGatewayProvider } from "./models/unified";