import { getTool } from "./registry.js";
import type { ParsedToolCall, ToolExecutionRecord, ToolResult, ToolContext } from "./types.js";

// ── Tool Executor ──────────────────────────────────────────────────────────────
//
// Takes parsed tool calls from the AI response, validates arguments against
// the tool's Zod schema, and dispatches to the tool's execute() method.
//
// This is the ONLY path from AI output to workspace operations. The AI never
// calls execute() directly — the executor is the gatekeeper.

export async function executeToolCall(
  call: ParsedToolCall,
  ctx?: ToolContext,
): Promise<ToolExecutionRecord> {
  const tool = getTool(call.name);

  if (!tool) {
    return {
      name: call.name,
      args: call.args,
      result: {
        ok: false,
        message: `Unknown tool: "${call.name}". No tool by that name is registered.`,
      },
    };
  }

  // Check for parse errors flagged by the parser
  if ("_parse_error" in call.args) {
    return {
      name: call.name,
      args: call.args,
      result: {
        ok: false,
        message: String(call.args._parse_error),
      },
    };
  }

  // Validate arguments against the tool's Zod schema
  const parsed = tool.params.safeParse(call.args);
  if (!parsed.success) {
    return {
      name: call.name,
      args: call.args,
      result: {
        ok: false,
        message: `Invalid arguments for "${call.name}": ${parsed.error.message}`,
      },
    };
  }

  // Dispatch to the tool's execute() — the single gateway to side effects
  let result: ToolResult;
  try {
    result = await tool.execute(parsed.data, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error during tool execution";
    result = { ok: false, message: msg };
  }

  return {
    name: call.name,
    args: parsed.data as Record<string, unknown>,
    result,
  };
}

export async function executeToolCalls(
  calls: ParsedToolCall[],
  ctx?: ToolContext,
): Promise<ToolExecutionRecord[]> {
  const records: ToolExecutionRecord[] = [];
  for (const call of calls) {
    records.push(await executeToolCall(call, ctx));
  }
  return records;
}
