/**
 * 0xNIMBUS — Core exports
 */

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
  ResolvedTool,
  TraceType,
  NimbusTrace,
  NimbusPlugin,
  StreamChunkType,
  StreamChunk,
  NimbusSource,
  McpConnectionSummary,
} from "./types";

export { NimbusError, ModelError, ToolValidationError, ToolExecutionError, McpConnectionError, McpToolError, ContextOverflowError, TimeoutError, MaxStepsError } from "./errors";
export { executeTools, executeTool, hasTool, getTool } from "./tools";
export { createPluginState, applyPlugin, getPluginNames, getInstructions, buildToolSet } from "./plugins";
export type { PluginState } from "./plugins";