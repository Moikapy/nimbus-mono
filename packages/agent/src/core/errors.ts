/**
 * 0xNIMBUS — Error Hierarchy
 *
 * Every error carries context — what step, what tool, what model.
 * When an agent fails, you should see exactly where and why.
 */

export class NimbusError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly step?: number,
    public readonly trace?: unknown[],
  ) {
    super(message);
    this.name = "NimbusError";
  }
}

export class ModelError extends NimbusError {
  constructor(message: string, public readonly model: string, step?: number) {
    super(message, "MODEL_ERROR", step);
    this.name = "ModelError";
  }
}

export class ToolValidationError extends NimbusError {
  constructor(
    message: string,
    public readonly tool: string,
    public readonly params: unknown,
    step?: number,
  ) {
    super(message, "TOOL_VALIDATION", step);
    this.name = "ToolValidationError";
  }
}

export class ToolExecutionError extends NimbusError {
  constructor(message: string, public readonly tool: string, step?: number) {
    super(message, "TOOL_EXECUTION", step);
    this.name = "ToolExecutionError";
  }
}

export class McpConnectionError extends NimbusError {
  constructor(message: string, public readonly server: string, public readonly url: string) {
    super(message, "MCP_CONNECTION");
    this.name = "McpConnectionError";
  }
}

export class McpToolError extends NimbusError {
  constructor(message: string, public readonly server: string, public readonly tool: string, step?: number) {
    super(message, "MCP_TOOL", step);
    this.name = "McpToolError";
  }
}

export class ContextOverflowError extends NimbusError {
  constructor(message: string, public readonly tokenEstimate: number) {
    super(message, "CONTEXT_OVERFLOW");
    this.name = "ContextOverflowError";
  }
}

export class TimeoutError extends NimbusError {
  constructor(message: string, public readonly elapsedMs: number) {
    super(message, "TIMEOUT");
    this.name = "TimeoutError";
  }
}

export class MaxStepsError extends NimbusError {
  constructor(message: string, public readonly steps: number) {
    super(message, "MAX_STEPS");
    this.name = "MaxStepsError";
  }
}