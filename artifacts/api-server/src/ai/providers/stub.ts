import type { IAIProvider, ChatMessage, ChatOptions, ChatResult } from "../types.js";

// ── Stub Provider ─────────────────────────────────────────────────────────────
//
// A no-op provider used when no real AI is configured.
// Returns a descriptive placeholder so the UI works end-to-end
// and developers can see exactly what message was sent.
//
// Replace this by adding a real provider in src/ai/config.ts.

export class StubProvider implements IAIProvider {
  readonly name = "stub";

  isAvailable(): boolean {
    return true; // always "available" — just not real
  }

  async chat(messages: ChatMessage[], _options?: ChatOptions): Promise<ChatResult> {
    const userMessage = [...messages].reverse().find((m) => m.role === "user");

    const content = [
      "No AI provider is configured yet.",
      "",
      `Your message: "${userMessage?.content ?? ""}"`,
      "",
      "To enable real AI responses, add a provider in:",
      "  artifacts/api-server/src/ai/config.ts",
    ].join("\n");

    return {
      content,
      model: "stub",
      provider: "stub",
    };
  }
}
