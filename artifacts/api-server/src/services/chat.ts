import { aiProvider } from "../ai/config.js";
import { getAllAgents } from "../store/agents.js";
import type { ChatMessage } from "../ai/types.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  reply: string;
  provider: string;
  model: string;
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

  return `You are Pocket Agent, a helpful AI assistant for managing and reasoning about AI agents.

Current agents:
${agentList}

Help the user manage their agents, answer questions about them, suggest names or configurations, or explain what agents can do.
Be concise and practical. If asked to perform an action (create, delete, update), explain how to do it using the terminal commands rather than doing it yourself.`;
}

// ── Chat service ──────────────────────────────────────────────────────────────

export async function runChat(req: ChatRequest): Promise<ChatResponse> {
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: req.message },
  ];

  const result = await aiProvider.chat(messages, { maxTokens: 512 });

  return {
    reply: result.content,
    provider: result.provider,
    model: result.model,
  };
}

// ── Provider info ─────────────────────────────────────────────────────────────

export function getProviderInfo() {
  return {
    name: aiProvider.name,
    available: aiProvider.isAvailable(),
  };
}
