/**
 * 0xNIMBUS — Tool execution engine
 *
 * Validates tool parameters against Zod schemas and executes handlers.
 * Collects ToolResult objects with timing and error information.
 */

import { z } from "zod";
import type {
  ToolCall,
  ToolResult,
  ToolDef,
  ToolContext,
} from "./types";
import { ToolValidationError, ToolExecutionError } from "./errors";

/**
 * Execute multiple tool calls and return their results.
 *
 * @param calls - Tool calls from the model
 * @param tools - Registered tool definitions
 * @param ctx - Tool execution context
 * @returns Array of tool results
 */
export async function executeTools(
  calls: ToolCall[],
  tools: Record<string, ToolDef>,
  ctx: ToolContext
): Promise<ToolResult[]> {
  return Promise.all(calls.map((call) => executeTool(call, tools, ctx)));
}

/**
 * Execute a single tool call.
 *
 * Validates parameters against the tool's Zod schema,
 * executes the handler, and captures timing and errors.
 *
 * @param call - The tool call from the model
 * @param tools - All registered tools
 * @param ctx - Execution context
 * @returns Tool result with success or error information
 */
export async function executeTool(
  call: ToolCall,
  tools: Record<string, ToolDef>,
  ctx: ToolContext
): Promise<ToolResult> {
  const tool = tools[call.tool];
  const startTime = Date.now();

  // Unknown tool
  if (!tool) {
    return {
      callId: call.id,
      tool: call.tool,
      params: call.params,
      result: null,
      error: `Unknown tool: ${call.tool}`,
      duration: Date.now() - startTime,
    };
  }

  try {
    // Validate parameters against Zod schema
    const validated = validateToolParams(call, tool);

    // Execute the tool handler
    const result = await tool.execute(validated, ctx) as unknown;

    const duration = Date.now() - startTime;

    return {
      callId: call.id,
      tool: call.tool,
      params: validated as Record<string, unknown>,
      result: result as Record<string, unknown> | unknown,
      error: null,
      duration,
    };
  } catch (err) {
    const duration = Date.now() - startTime;

    // Handle different error types
    if (err instanceof z.ZodError) {
      const errorMsg = formatZodError(err);
      return {
        callId: call.id,
        tool: call.tool,
        params: call.params,
        result: null,
        error: `Validation error: ${errorMsg}`,
        duration,
      };
    }

    if (err instanceof Error) {
      return {
        callId: call.id,
        tool: call.tool,
        params: call.params as Record<string, unknown>,
        result: null,
        error: err.message,
        duration,
      };
    }

    return {
      callId: call.id,
      tool: call.tool,
      params: call.params,
      result: null,
      error: String(err),
      duration,
    };
  }
}

/**
 * Validate tool parameters against its Zod schema.
 *
 * Throws ZodError if validation fails.
 *
 * @param call - Tool call with raw params
 * @param tool - Tool definition with Zod schema
 * @returns Validated and typed parameters
 * @throws ZodError if validation fails
 */
function validateToolParams(call: ToolCall, tool: ToolDef): unknown {
  try {
    return tool.parameters.parse(call.params);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw err;
    }
    throw new ToolValidationError(
      `Invalid tool params for ${call.tool}: ${String(err)}`,
      call.tool,
      call.params
    );
  }
}

/**
 * Format Zod error into a human-readable string.
 */
function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((e) => {
      const path = e.path.length > 0 ? e.path.join(".") : "value";
      return `${path}: ${e.message}`;
    })
    .join("; ");
}

/**
 * Check if a tool exists in the registry.
 */
export function hasTool(
  toolName: string,
  tools: Record<string, ToolDef>
): boolean {
  return toolName in tools;
}

/**
 * Get a tool by name or return null if not found.
 */
export function getTool(
  toolName: string,
  tools: Record<string, ToolDef>
): ToolDef | null {
  return tools[toolName] ?? null;
}

/**
 * Convert Zod schema to JSON Schema for model tool definitions.
 *
 * Returns a JSON Schema object that describes the tool's parameters.
 *
 * @param schema - Zod schema
 * @returns JSON Schema object
 */
export function zodSchemaToJson(schema: z.ZodType): Record<string, unknown> {
  // This is a simplified implementation
  // For production, use zod-to-json-schema package
  const type = getZodType(schema);

  return {
    type,
    ...(type === "object" ? { properties: {}, additionalProperties: false } : {}),
  };
}

/**
 * Get the JSON Schema type for a Zod schema.
 */
function getZodType(schema: z.ZodType): string {
  // biome-ignore lint/suspicious/noExplicitAny: Accessing internal Zod type definitions
  const def = schema._def as any;

  if (def.typeName === "ZodObject") return "object";
  if (def.typeName === "ZodString") return "string";
  if (def.typeName === "ZodNumber") return "number";
  if (def.typeName === "ZodBoolean") return "boolean";
  if (def.typeName === "ZodArray") return "array";
  if (def.typeName === "ZodOptional") {
    return getZodType(def.innerType);
  }
  if (def.typeName === "ZodNullable") {
    return getZodType(def.innerType);
  }

  return "object";
}
