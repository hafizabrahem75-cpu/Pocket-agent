import { getAllTools } from "./registry.js";

// ── Tool Prompt Builder ───────────────────────────────────────────────────────
//
// Generates the portion of the system prompt that teaches the AI how to use
// tools. The AI is instructed to emit <tool> directives and wait for results
// in the next message. It is explicitly told it cannot access the filesystem
// directly.

function describeZod(schema: unknown): string {
  // Zod objects expose their shape via ._def.shape (ZodObject) or ._def.options (ZodUnion)
  const def = (schema as { _def?: Record<string, unknown> })?._def;
  if (!def) return "unknown";

  // ZodObject: _def.shape is a record of key → ZodType
  const shape = def.shape as Record<string, unknown> | undefined;
  if (shape && typeof shape === "object") {
    return Object.entries(shape)
      .map(([key, val]) => {
        const valDef = (val as { _def?: { description?: string } })?._def;
        const desc = valDef?.description;
        const isOptional = (val as { isOptional?: () => boolean })?.isOptional?.() ?? false;
        const optMark = isOptional ? " (optional)" : "";
        return `    "${key}"${optMark}: ${desc ?? "value"}`;
      })
      .join("\n");
  }

  return "unknown";
}

export function buildToolPrompt(): string {
  const tools = getAllTools();

  if (tools.length === 0) return "";

  const toolDocs = tools
    .map((t) => `### ${t.name}
${t.description}
Arguments (JSON object):
{
${describeZod(t.params)}
}`)
    .join("\n\n");

  return `## Tool Use

You have access to the following tools for operating on the workspace filesystem.
You CANNOT access the filesystem directly — you must use tools.

To call a tool, emit a block in this exact format:

<tool name="tool_name">
{"param": "value"}
</tool>

Rules:
- Emit ONLY ONE tool block per response.
- After emitting a tool block, stop and wait — the system will execute the tool and return the result to you in the next message.
- Do NOT wrap tool blocks in markdown code fences.
- All file paths are relative to the workspace root (e.g. "src/index.ts", not "/src/index.ts").
- If the user's request does not require file operations, respond normally without any tool block.

Available tools:

${toolDocs}`;
}
