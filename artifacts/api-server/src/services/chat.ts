import { aiProvider } from "../ai/config.js";
import { getAllAgents, getAgent } from "../store/agents.js";
import { toolRegistry } from "../tools/index.js";
import { analyzeProject } from "../analyzer/index.js";
import { WorkspaceError } from "../workspace/types.js";
import type { ChatMessage, ChatOptions } from "../ai/types.js";
import type { ProjectAnalysis } from "../analyzer/types.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatRequest {
  message: string;
  /** If provided, scopes analysis and file tools to this agent's workspacePath. */
  agentId?: string;
}

export interface ToolInvocation {
  name: string;
  input: Record<string, unknown>;
  /** Serialised result or error message. */
  output: string;
  ok: boolean;
}

export interface ChatResponse {
  reply: string;
  provider: string;
  model: string;
  /** Every tool call that happened during this turn (may be empty). */
  toolInvocations: ToolInvocation[];
}

// ── Tool-call detection ───────────────────────────────────────────────────────
//
// The system prompt asks the model to respond with ONLY a bare JSON object of
// the shape { "tool_call": { "name": "...", "input": { ... } } } when it wants
// to invoke a tool. No markdown, no extra text.
//
// We also handle the common case where the model wraps it in a ```json fence.

interface ParsedToolCall {
  name: string;
  input: Record<string, unknown>;
}

function parseToolCall(content: string): ParsedToolCall | null {
  // Strip optional ```json ... ``` fencing
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1] : content;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("tool_call" in parsed)
  ) {
    return null;
  }

  const tc = (parsed as Record<string, unknown>)["tool_call"];
  if (
    typeof tc !== "object" ||
    tc === null ||
    typeof (tc as Record<string, unknown>)["name"] !== "string"
  ) {
    return null;
  }

  const tcObj = tc as Record<string, unknown>;
  const name = tcObj["name"] as string;
  const input =
    typeof tcObj["input"] === "object" && tcObj["input"] !== null
      ? (tcObj["input"] as Record<string, unknown>)
      : {};

  return { name, input };
}

// ── Tool execution ────────────────────────────────────────────────────────────

// Tools that accept a "path" input and should be scoped to the agent workspace.
const FILE_TOOLS = new Set(["read_file", "write_file"]);

/**
 * Prepend the agent's workspacePath to any "path" input field so that file
 * tools operate inside the agent's directory rather than the workspace root.
 */
function scopeInput(
  name: string,
  input: Record<string, unknown>,
  workspacePath: string | undefined,
): Record<string, unknown> {
  if (!workspacePath || !FILE_TOOLS.has(name)) return input;
  if (typeof input["path"] !== "string") return input;
  const joined = `${workspacePath}/${input["path"]}`.replace(/\/+/g, "/");
  return { ...input, path: joined };
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  workspacePath?: string,
): Promise<{ output: string; ok: boolean }> {
  const tool = toolRegistry.get(name);
  if (!tool) {
    return {
      output: `Unknown tool: "${name}". Available tools: ${toolRegistry
        .list()
        .map((t) => t.name)
        .join(", ")}.`,
      ok: false,
    };
  }

  const scopedInput = scopeInput(name, input, workspacePath);

  try {
    const result = await tool.execute(scopedInput);
    return { output: JSON.stringify(result), ok: true };
  } catch (err) {
    const message =
      err instanceof WorkspaceError
        ? `WorkspaceError [${err.code}]: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    return { output: message, ok: false };
  }
}

// ── Project context ───────────────────────────────────────────────────────────

function buildProjectBlock(analysis: ProjectAnalysis): string {
  const { projectType, frameworks, packageManager, summary } = analysis;

  const type = [
    projectType.primary,
    projectType.language !== "unknown" ? `(${projectType.language})` : "",
    projectType.tags.length ? `[${projectType.tags.join(", ")}]` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const fw = frameworks
    .filter((f) => f.confidence !== "possible")
    .map((f) => (f.version ? `${f.name} ${f.version}` : f.name))
    .join(", ");

  const pm = packageManager.isMonorepo
    ? `${packageManager.name} (workspace)`
    : packageManager.name;

  return `Project context:
  Type: ${type}
  Frameworks: ${fw || "none detected"}
  Package manager: ${pm}
  Summary: ${summary}`;
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildToolsBlock(): string {
  const tools = toolRegistry.list();
  if (tools.length === 0) return "";

  const descriptions = tools
    .map((t) => {
      const props = t.inputSchema.properties;
      const required = t.inputSchema.required ?? [];
      const fields = Object.entries(props)
        .map(([key, schema]) => {
          const req = required.includes(key) ? "(required)" : "(optional)";
          return `    ${key} ${req}: ${schema.description ?? schema.type}`;
        })
        .join("\n");
      return `  ${t.name}: ${t.description}\n${fields}`;
    })
    .join("\n\n");

  return `
You have access to the following tools. When you need to use a tool, respond with ONLY a raw JSON object — no other text, no markdown — using this exact shape:
{"tool_call":{"name":"<tool_name>","input":{<fields>}}}

After receiving a tool result you may call another tool the same way, or give a normal reply once you have enough information.
Only use a tool when clearly necessary.

Available tools:
${descriptions}`;
}

function buildSystemPrompt(analysis: ProjectAnalysis): string {
  const agents = getAllAgents();

  const agentList =
    agents.length === 0
      ? "  (none)"
      : agents
          .map(
            (a) =>
              `  - ${a.name} [${a.status}]${a.description ? `: ${a.description}` : ""}`,
          )
          .join("\n");

  return `You are Pocket Agent, a helpful AI assistant for managing and reasoning about AI agents.

Current agents:
${agentList}

${buildProjectBlock(analysis)}

Help the user manage their agents, answer questions about them, suggest names or configurations, or explain what agents can do.
Be concise and practical. If asked to perform an action (create, delete, update), explain how to do it using the terminal commands rather than doing it yourself.
${buildToolsBlock()}`;
}

// ── Chat service ──────────────────────────────────────────────────────────────

const MAX_TOOL_ROUNDS = 5;

export async function runChat(req: ChatRequest): Promise<ChatResponse> {
  const agent = req.agentId ? getAgent(req.agentId) : undefined;
  const workspacePath = agent?.workspacePath;

  const analysis = await analyzeProject(
    workspacePath ? { rootPath: workspacePath } : {},
  );

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(analysis) },
    { role: "user", content: req.message },
  ];

  const options: ChatOptions = { maxTokens: 1024 };
  const toolInvocations: ToolInvocation[] = [];

  let finalResult = await aiProvider.chat(messages, options);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const toolCall = parseToolCall(finalResult.content);
    if (!toolCall) break; // plain reply — we're done

    const { output, ok } = await executeTool(toolCall.name, toolCall.input, workspacePath);

    toolInvocations.push({
      name: toolCall.name,
      input: toolCall.input,
      output,
      ok,
    });

    // Append the assistant's tool-call turn and the tool result as a user turn,
    // then ask the model to continue.
    messages.push(
      { role: "assistant", content: finalResult.content },
      {
        role: "user",
        content: `Tool result for ${toolCall.name}:\n${output}`,
      },
    );

    finalResult = await aiProvider.chat(messages, options);
  }

  return {
    reply: finalResult.content,
    provider: finalResult.provider,
    model: finalResult.model,
    toolInvocations,
  };
}

// ── Provider info ─────────────────────────────────────────────────────────────

export function getProviderInfo() {
  return {
    name: aiProvider.name,
    available: aiProvider.isAvailable(),
  };
}
