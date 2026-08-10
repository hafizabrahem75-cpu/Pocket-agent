import { aiProvider } from "../ai/config.js";
import { getAllAgents, getAgent } from "../store/agents.js";
import { toolRegistry } from "../tools/index.js";
import { analyzeProject } from "../analyzer/index.js";
import { WorkspaceError } from "../workspace/types.js";
import { WORKSPACE_ROOT } from "../workspace/safety.js";
import type { ChatMessage, ChatOptions } from "../ai/types.js";
import type { ProjectAnalysis } from "../analyzer/types.js";
import path from "node:path";

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

// All coding tools operate on paths. When an agent has a workspacePath, every
// path is resolved relative to that directory before the existing tool runs.
const WORKSPACE_TOOLS = new Set([
  "read_file",
  "write_file",
  "list_workspace",
  "search_files",
  "analyze_project",
]);

/**
 * Resolve a tool path inside the agent's workspace and convert it back to the
 * relative format expected by the existing workspace tools. This keeps both
 * reads and writes inside the agent boundary, including for paths containing
 * ".." segments or absolute paths supplied by the model.
 */
function scopeInput(
  name: string,
  input: Record<string, unknown>,
  workspacePath: string | undefined,
): Record<string, unknown> {
  if (!workspacePath || !WORKSPACE_TOOLS.has(name)) return input;

  const agentRoot = path.resolve(WORKSPACE_ROOT, workspacePath);
  const requestedPath =
    typeof input["path"] === "string" && input["path"].trim()
      ? input["path"]
      : ".";
  const resolvedPath = path.resolve(agentRoot, requestedPath);
  const relativeToAgent = path.relative(agentRoot, resolvedPath);
  const insideAgent =
    relativeToAgent === "" ||
    (relativeToAgent !== ".." &&
      !relativeToAgent.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeToAgent));

  if (!insideAgent) {
    throw new WorkspaceError(
      "Path escapes the agent workspacePath — directory traversal is not allowed",
      "path_traversal",
    );
  }

  return {
    ...input,
    path: path.relative(WORKSPACE_ROOT, resolvedPath) || ".",
  };
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

  try {
    if (name === "write_file" && !workspacePath) {
      return {
        output:
          "write_file requires an agent with an existing workspacePath. Select an agent workspace before requesting code changes.",
        ok: false,
      };
    }

    const scopedInput = scopeInput(name, input, workspacePath);
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

function buildSystemPrompt(
  analysis: ProjectAnalysis,
  workspacePath: string | undefined,
): string {
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

  const workspaceContext = workspacePath
    ? `The selected agent workspacePath is "${workspacePath}". All file and project paths in tool inputs are relative to this directory. Never read or write outside it.`
    : "No agent workspacePath is selected. Do not make file changes until the user selects an agent with a workspacePath.";

  return `You are Pocket Agent, a coding agent that can inspect and modify the selected project's files.

Current agents:
${agentList}

${buildProjectBlock(analysis)}

${workspaceContext}

When the user asks about or requests a code change, use the available tools to inspect the project and make the change yourself. First use analyze_project, list_workspace, search_files, or read_file as needed to understand the relevant code. Use write_file to apply requested changes, and then explain exactly what changed. Do not invent tools, use terminal commands, or claim a change was made without a successful write_file result. Keep changes focused on the user's request.
For general agent-management questions, answer directly without using coding tools.
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
    { role: "system", content: buildSystemPrompt(analysis, workspacePath) },
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
