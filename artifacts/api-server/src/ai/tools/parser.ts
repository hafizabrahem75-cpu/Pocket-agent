import type { ParsedToolCall } from "./types.js";

// ── Tool-Call Protocol Parser ─────────────────────────────────────────────────
//
// The AI communicates tool calls through a simple, parseable directive embedded
// in its response text:
//
//   <tool name="read_file">
//   {"path": "src/index.ts"}
//   </tool>
//
// This avoids requiring native function-calling support from the provider,
// so it works with any IAIProvider (Groq, future Gemini/OpenRouter, even the stub).
//
// The parser extracts all <tool> blocks from the response, returning them in
// order. Malformed blocks are skipped (not fatal) so a partially-bad response
// still yields any valid tool calls.

const TOOL_BLOCK_RE = /<tool\s+name="([^"]+)">([\s\S]*?)<\/tool>/g;

export function parseToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  let match: RegExpExecArray | null;

  TOOL_BLOCK_RE.lastIndex = 0;
  while ((match = TOOL_BLOCK_RE.exec(text)) !== null) {
    const name = match[1].trim();
    const body = match[2].trim();

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(body);
    } catch {
      // Skip malformed JSON — the AI will see the error in the next turn
      args = { _parse_error: `Invalid JSON in tool block: ${body.slice(0, 200)}` };
    }

    if (typeof args !== "object" || args === null || Array.isArray(args)) {
      args = { _parse_error: "Tool arguments must be a JSON object" };
    }

    calls.push({ name, args: args as Record<string, unknown> });
  }

  return calls;
}

/** Remove all <tool> blocks from text, returning the human-readable portion. */
export function stripToolCalls(text: string): string {
  return text.replace(/<tool\s+name="[^"]+">[\s\S]*?<\/tool>\s*/g, "").trim();
}

/** Check whether a text response contains any tool-call directives. */
export function hasToolCalls(text: string): boolean {
  TOOL_BLOCK_RE.lastIndex = 0;
  return TOOL_BLOCK_RE.test(text);
}
