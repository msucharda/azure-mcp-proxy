/**
 * Custom Promptfoo assertion helpers for Azure MCP tool selection evals.
 *
 * These can be referenced in promptfooconfig.yaml as:
 *   type: javascript
 *   value: file://src/assertions/toolSelection.ts:assertToolSelected
 */

interface ToolCall {
  function: {
    name: string;
    arguments: string;
  };
}

interface AssertionResult {
  pass: boolean;
  reason: string;
}

/**
 * Parses the model output into an array of tool calls.
 * Handles both stringified JSON arrays and raw arrays.
 */
function parseToolCalls(output: unknown): ToolCall[] {
  if (typeof output === "string") {
    return JSON.parse(output) as ToolCall[];
  }
  if (Array.isArray(output)) {
    return output as ToolCall[];
  }
  throw new Error(`Unexpected output type: ${typeof output}`);
}

/**
 * Asserts that a specific tool was selected by the model.
 */
export function assertToolSelected(
  output: unknown,
  expectedTool: string
): AssertionResult {
  try {
    const calls = parseToolCalls(output);
    const found = calls.find((c) => c.function.name === expectedTool);
    if (!found) {
      const actualTools = calls.map((c) => c.function.name).join(", ");
      return {
        pass: false,
        reason: `Expected tool '${expectedTool}' but got: [${actualTools}]`,
      };
    }
    return {
      pass: true,
      reason: `Tool '${expectedTool}' correctly selected`,
    };
  } catch (e) {
    return {
      pass: false,
      reason: `Failed to parse tool calls: ${(e as Error).message}`,
    };
  }
}

/**
 * Asserts that a specific sub-command was selected within a hierarchical tool.
 */
export function assertSubCommand(
  output: unknown,
  toolName: string,
  expectedCommand: string
): AssertionResult {
  try {
    const calls = parseToolCalls(output);
    const toolCall = calls.find((c) => c.function.name === toolName);
    if (!toolCall) {
      return {
        pass: false,
        reason: `Tool '${toolName}' was not called`,
      };
    }
    const args = JSON.parse(toolCall.function.arguments);
    if (args.command !== expectedCommand) {
      return {
        pass: false,
        reason: `Expected sub-command '${expectedCommand}', got '${args.command}'`,
      };
    }
    return {
      pass: true,
      reason: `Sub-command '${expectedCommand}' correctly selected`,
    };
  } catch (e) {
    return {
      pass: false,
      reason: `Failed to parse: ${(e as Error).message}`,
    };
  }
}

/**
 * Asserts that specific parameter values are present in the tool call arguments.
 * Performs case-insensitive substring matching against the serialized arguments.
 */
export function assertParametersContain(
  output: unknown,
  toolName: string,
  expectedValues: string[]
): AssertionResult {
  try {
    const calls = parseToolCalls(output);
    const toolCall = calls.find((c) => c.function.name === toolName);
    if (!toolCall) {
      return {
        pass: false,
        reason: `Tool '${toolName}' was not called`,
      };
    }
    const argsStr = toolCall.function.arguments.toLowerCase();
    const missing = expectedValues.filter(
      (v) => !argsStr.includes(v.toLowerCase())
    );
    if (missing.length > 0) {
      return {
        pass: false,
        reason: `Missing parameter values: [${missing.join(", ")}]`,
      };
    }
    return {
      pass: true,
      reason: `All expected parameter values found: [${expectedValues.join(", ")}]`,
    };
  } catch (e) {
    return {
      pass: false,
      reason: `Failed to parse: ${(e as Error).message}`,
    };
  }
}

/**
 * Asserts that multiple tools were selected (for multi-tool scenarios).
 * Returns pass if at least `minCount` of the expected tools are present.
 */
export function assertMultipleToolsSelected(
  output: unknown,
  expectedTools: string[],
  minCount?: number
): AssertionResult {
  const threshold = minCount ?? expectedTools.length;
  try {
    const calls = parseToolCalls(output);
    const calledTools = calls.map((c) => c.function.name);
    const found = expectedTools.filter((t) => calledTools.includes(t));
    if (found.length >= threshold) {
      return {
        pass: true,
        reason: `${found.length}/${expectedTools.length} expected tools selected: [${found.join(", ")}]`,
      };
    }
    return {
      pass: false,
      reason: `Only ${found.length}/${threshold} expected tools found. Called: [${calledTools.join(", ")}], expected: [${expectedTools.join(", ")}]`,
    };
  } catch (e) {
    return {
      pass: false,
      reason: `Failed to parse: ${(e as Error).message}`,
    };
  }
}
