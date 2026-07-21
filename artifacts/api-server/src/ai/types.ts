// ── AI Provider Interface ─────────────────────────────────────────────────────
//
// Any AI provider (OpenAI, Anthropic, Ollama, HuggingFace, etc.) must implement
// this interface. Swap the concrete provider in src/ai/config.ts — nothing else
// in the codebase needs to change.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  /** Model identifier, e.g. "gpt-4o-mini" or "llama3". Falls back to provider default. */
  model?: string;
  /** Maximum tokens in the completion. */
  maxTokens?: number;
  /** Sampling temperature (0–2). Not supported by all providers. */
  temperature?: number;
}

export interface ChatResult {
  content: string;
  /** Model name as reported by the provider. */
  model: string;
  /** Provider name for observability (e.g. "openai", "anthropic", "stub"). */
  provider: string;
}

export interface IAIProvider {
  /** Human-readable provider name. */
  readonly name: string;
  /** Returns true when the provider is properly configured and ready to use. */
  isAvailable(): boolean;
  /** Send a list of messages and receive a completion. */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
}
