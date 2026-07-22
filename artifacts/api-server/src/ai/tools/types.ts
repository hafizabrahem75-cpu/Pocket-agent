// ── AI Tool Interface ─────────────────────────────────────────────────────────
//
// A "tool" is a capability the AI can invoke through a structured protocol.
// The AI never touches the filesystem or any side-effecting system directly —
// it emits a JSON tool-call directive, the server parses it, validates arguments
// against the tool's schema, and dispatches through the tool's execute() method.
//
// To add a new tool:
//   1. Implement the ITool interface below.
//   2. Register it in registry.ts.
// Nothing else in the codebase needs to change.

import type { z } from "zod";

export interface ToolContext {
  /** Opaque context object passed to every tool's execute() call. */
  // Tools receive whatever context they need — no globals.
}

export interface ToolDefinition<TParams extends z.ZodType = z.ZodType> {
  /** Unique tool name used in the AI protocol, e.g. "read_file". */
  readonly name: string;
  /** Short description for the AI system prompt. */
  readonly description: string;
  /** Zod schema for validating parameters parsed from the AI response. */
  readonly params: TParams;
}

export interface ToolResult {
  /** Whether the tool call succeeded. */
  ok: boolean;
  /** Human-readable result or error message, fed back to the AI. */
  message: string;
  /** Structured data for the caller (route layer) to include in the API response. */
  data?: unknown;
}

export interface ITool<TParams extends z.ZodType = z.ZodType> extends ToolDefinition<TParams> {
  /**
   * Execute the tool with validated parameters.
   * All side effects happen here — the AI never calls this directly.
   */
  execute(params: z.infer<TParams>, ctx?: ToolContext): Promise<ToolResult> | ToolResult;
}

// ── Parsed tool-call from AI response ─────────────────────────────────────────

export interface ParsedToolCall {
  /** Tool name, e.g. "read_file". */
  name: string;
  /** Raw arguments object extracted from the AI response. */
  args: Record<string, unknown>;
}

// ── Execution outcome ──────────────────────────────────────────────────────────

export interface ToolExecutionRecord {
  /** Tool name that was invoked. */
  name: string;
  /** Validated parameters that were passed to execute(). */
  args: Record<string, unknown>;
  /** Result returned by the tool. */
  result: ToolResult;
}
