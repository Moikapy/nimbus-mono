/**
 * 0xNIMBUS — Core Types
 *
 * Every type in this file is the public contract.
 * Consumers depend on these shapes. Change carefully, version deliberately.
 */

import type { ZodType } from "zod";

/** Model reference — Workers AI model name or AI Gateway unified path */
export type ModelRef = string;

// ─── Messages ────────────────────────────────────────────────────────────────

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface SystemMessage {
  role: "system";
  content: string;
}

export interface UserMessage {
  role: "user";
  content: string;
}

export interface AssistantMessage {
  role: "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

export interface ToolMessage {
  role: "tool";
  content: string;
  callId: string;
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

// ─── Tools ────────────────────────────────────────────────────────────────────

/** A tool call produced by the model */
export interface ToolCall {
  id: string;
  tool: string;
  params: Record<string, unknown>;
}

/** Result from executing a tool handler */
export interface ToolResult {
  callId: string;
  tool: string;
  params: Record<string, unknown>;
  result: unknown;
  error: string | null;
  duration: number;
}

/** Context passed to every tool execute() function */
export interface ToolContext {
  env: Record<string, unknown>;
  conversationId?: string;
  step: number;
  trace: NimbusTrace[];
  abort: (reason: string) => void;
}

/** Inline tool definition — passed via plugins */
export interface ToolDef<TParams = unknown, TResult = unknown> {
  description: string;
  parameters: ZodType<TParams>;
  execute: (params: TParams, ctx: ToolContext) => Promise<TResult>;
}

/** MCP server config — connect to remote tool servers */
export interface McpServerConfig {
  name: string;
  url: string;
  headers?: Record<string, string>;
}

/** Internal resolved tool — both inline and MCP resolve to this shape */
export interface ResolvedTool {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
  execute: (params: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
  source: "inline" | "mcp";
  mcpServer?: string;
}

// ─── Plugins ──────────────────────────────────────────────────────────────────

/** A nimbus plugin — tools, context, and MCP servers added by the host project.
 *  Think of it like a skill: you install the harness, then add plugins.
 *  Each project (treasury, etc.) ships plugins, not new agents. */
export interface NimbusPlugin {
  /** Plugin name (e.g. 'nimbus-treasury') */
  name: string;
  /** Description of what this plugin provides */
  description?: string;
  /** Tools this plugin adds to the agent */
  tools?: Record<string, ToolDef>;
  /** MCP servers this plugin connects to */
  mcpServers?: McpServerConfig[];
  /** Additional system instructions for the agent when using this plugin */
  instructions?: string;
}

// ─── Tracing ──────────────────────────────────────────────────────────────────

export type TraceType = "model_call" | "tool_call" | "tool_result" | "response";

export interface NimbusTrace {
  id: string;
  timestamp: string;
  step: number;
  type: TraceType;
  model: string;
  input: {
    messages: Message[];
    tools?: Record<string, unknown>[];
  };
  output: {
    text?: string;
    toolCalls?: ToolCall[];
  };
  toolResults?: ToolResult[];
  duration: number;
  tokens: {
    input: number;
    output: number;
  };
  cached: boolean;
}

// ─── Streaming ────────────────────────────────────────────────────────────────

export type StreamChunkType = "text" | "tool_call" | "tool_result" | "done";

export interface StreamChunk {
  type: StreamChunkType;
  content: string | ToolCall | ToolResult;
}

// ─── Sources ──────────────────────────────────────────────────────────────────

export interface NimbusSource {
  tool: string;
  toolSource: "inline" | "mcp";
  mcpServer?: string;
  params: Record<string, unknown>;
  result?: unknown;
}

export interface McpConnectionSummary {
  name: string;
  url: string;
  toolsDiscovered: number;
  connectionTime: number;
}