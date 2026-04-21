import { describe, it, expect } from "vitest";
import { NimbusError, ModelError, ToolValidationError, ToolExecutionError, ContextOverflowError, TimeoutError, MaxStepsError } from "../../src/core/errors";

describe("NimbusError hierarchy", () => {
  it("NimbusError carries code, step, and trace", () => {
    const err = new NimbusError("test", "TEST_CODE", 2, [{ step: 1 }]);
    expect(err.code).toBe("TEST_CODE");
    expect(err.step).toBe(2);
    expect(err.trace).toHaveLength(1);
    expect(err.message).toBe("test");
  });

  it("ModelError includes model name", () => {
    const err = new ModelError("model failed", "glm-4.7-flash", 3);
    expect(err.model).toBe("glm-4.7-flash");
    expect(err.step).toBe(3);
    expect(err.code).toBe("MODEL_ERROR");
  });

  it("ToolValidationError includes tool name and params", () => {
    const err = new ToolValidationError("bad params", "treasury_debt", { date: "invalid" }, 1);
    expect(err.tool).toBe("treasury_debt");
    expect(err.params).toEqual({ date: "invalid" });
    expect(err.code).toBe("TOOL_VALIDATION");
  });

  it("ToolExecutionError includes tool name", () => {
    const err = new ToolExecutionError("handler threw", "state_spending", 2);
    expect(err.tool).toBe("state_spending");
    expect(err.code).toBe("TOOL_EXECUTION");
  });

  it("ContextOverflowError includes token estimate", () => {
    const err = new ContextOverflowError("too long", 15000);
    expect(err.tokenEstimate).toBe(15000);
    expect(err.code).toBe("CONTEXT_OVERFLOW");
  });

  it("TimeoutError includes elapsed time", () => {
    const err = new TimeoutError("timed out", 30000);
    expect(err.elapsedMs).toBe(30000);
    expect(err.code).toBe("TIMEOUT");
  });

  it("MaxStepsError includes step count", () => {
    const err = new MaxStepsError("too many steps", 10);
    expect(err.steps).toBe(10);
    expect(err.code).toBe("MAX_STEPS");
  });

  it("all errors are instanceof NimbusError", () => {
    const errors = [
      new ModelError("m", "model", 0),
      new ToolValidationError("v", "tool", {}, 0),
      new ToolExecutionError("e", "tool", 0),
      new ContextOverflowError("c", 0),
      new TimeoutError("t", 0),
      new MaxStepsError("m", 0),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(NimbusError);
    }
  });
});