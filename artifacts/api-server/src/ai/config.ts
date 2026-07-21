import type { IAIProvider } from "./types.js";
import { StubProvider } from "./providers/stub.js";

// ── AI Provider Configuration ─────────────────────────────────────────────────
//
// This is the single place where a provider is selected and instantiated.
// To plug in a real provider:
//
//   1. Create a new file in src/ai/providers/ that implements IAIProvider.
//   2. Add an env-var check below and return the new provider.
//
// Example (OpenAI):
//   import { OpenAIProvider } from "./providers/openai.js";
//   if (process.env.OPENAI_API_KEY) return new OpenAIProvider();
//
// Example (Anthropic):
//   import { AnthropicProvider } from "./providers/anthropic.js";
//   if (process.env.ANTHROPIC_API_KEY) return new AnthropicProvider();
//
// Example (Ollama / local):
//   import { OllamaProvider } from "./providers/ollama.js";
//   if (process.env.OLLAMA_BASE_URL) return new OllamaProvider();

function createProvider(): IAIProvider {
  // ── Add provider checks here ──────────────────────────────────────────────
  // if (process.env.OPENAI_API_KEY)     return new OpenAIProvider();
  // if (process.env.ANTHROPIC_API_KEY)  return new AnthropicProvider();
  // if (process.env.OLLAMA_BASE_URL)    return new OllamaProvider();
  // ─────────────────────────────────────────────────────────────────────────

  return new StubProvider();
}

export const aiProvider: IAIProvider = createProvider();
