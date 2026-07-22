import "../ai/tools/register.js";
import { aiProvider } from "../ai/config.js";
import { getAllAgents } from "../store/agents.js";
import type { ChatMessage } from "../ai/types.js";
import { buildToolPrompt } from "../ai/tools/prompt.js";
import { parseToolCalls, stripToolCalls, hasToolCalls } from "../ai/tools/parser.js";
import { executeToolCall } from "../ai/tools/executor.js";
import type { ToolExecutionRecord } from "../ai/tools/types.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  reply: string;
  provider: string;
  model: string;
  /** Tool calls executed during this chat turn (empty if none). */
  toolCalls?: ToolExecutionRecord[];
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const agents = getAllAgents();

  const agentList =
    agents.length === 0
      ? "  (none)"
      : agents
          .map(
            (a) =>
              `  - ${a.name} [${a.status}]${a.description ? `: ${a.description}` : ""}`
          )
          .join("\n");

  const toolPrompt = buildToolPrompt();

  return `You are Pocket Agent, a helpful AI assistant for managing and reasoning about AI agents and their workspace files.

Current agents:
${agentList}

Help the user manage their agents, answer questions about them, suggest names or configurations, or explain what agents can do.
Be concise and practical.

When the user asks you to read, create, modify, or delete files, use the available tools to do so. After a tool completes, summarize the result for the user.
You cannot access the filesystem directly — you must use tools.

${toolPrompt}`;
}

// ── Chat service ──────────────────────────────────────────────────────────────

const MAX_TOOL_ROUNDS = 5;

export async function runChat(req: ChatRequest): Promise<ChatResponse> {
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: req.message },
  ];

  const toolRecords: ToolExecutionRecord[] = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const result = await aiProvider.chat(messages, { maxTokens: 1024 });

    // Check if the AI wants to call a tool
    if (!hasToolCalls(result.content)) {
      return {
        reply: result.content,
        provider: result.provider,
        model: result.model,
        toolCalls: toolRecords.length > 0 ? toolRecords : undefined,
      };
    }

    // Extract tool calls
    const calls = parseToolCalls(result.content);
    const visibleText = stripToolCalls(result.content);

    if (calls.length === 0) {
      // hasToolCalls was true but parseToolCalls returned nothing — shouldn't happen
      return {
        reply: visibleText || result.content,
        provider: result.provider,
        model: result.model,
        toolCalls: toolRecords.length > 0 ? toolRecords : undefined,
      };
    }

    // Add the assistant's raw response (with tool blocks) to the conversation
    messages.push({ role: "assistant", content: result.content });

    // Execute the first tool call (one tool per round)
    const call = calls[0];
    const record = await executeToolCall(call);
    toolRecords.push(record);

    // Feed the tool result back to the AI as a user message
    const resultText = record.result.ok
      ? `Tool "${record.name}" succeeded: ${record.result.message}`
      : `Tool "${record.name}" failed: ${record.result.message}`;

    messages.push({ role: "user", content: resultText });

    // If there were additional tool calls queued, carry them forward
    if (calls.length > 1) {
      const remaining = calls.slice(1)
        .map((c) => `<tool name="${c.name}">\n${JSON.stringify(c.args)}\n</tool>`)
        .join("\n\n");
      messages.push({
        role: "assistant",
        content: `I have more tool calls to make:\n\n${remaining}`,
      });
    }
  }

  // Exceeded max rounds — return what we have
  return {
    reply: "I've completed the requested operations. Let me know if you need anything else.",
    provider: "system",
    model: "tool-loop-limit",
    toolCalls: toolRecords,
  };
}

// ── Provider info ─────────────────────────────────────────────────────────────

export function getProviderInfo() {
  return {
    name: aiProvider.name,
    available: aiProvider.isAvailable(),
  };
}
