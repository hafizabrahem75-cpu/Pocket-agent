import type { IAIProvider } from "./types.js";
import { StubProvider } from "./providers/stub.js";
import { GroqProvider } from "./providers/groq.js";

// ── AI Provider Configuration ─────────────────────────────────────────────────
//
// This is the single place where a provider is selected and instantiated.
// To plug in a new provider:
//
//   1. Create a new file in src/ai/providers/ that implements IAIProvider.
//   2. Add an env-var check below and return the new provider.
//
// Providers are checked in order. The first one whose env var is set wins.
// If none are configured, the StubProvider is used as a fallback.
//
// To add Gemini:
//   import { GeminiProvider } from "./providers/gemini.js";
//   if (process.env.GEMINI_API_KEY) return new GeminiProvider();
//
// To add OpenRouter:
//   import { OpenRouterProvider } from "./providers/openrouter.js";
//   if (process.env.OPENROUTER_API_KEY) return new OpenRouterProvider();

function createProvider(): IAIProvider {
  if (process.env.GROQ_API_KEY) return new GroqProvider(process.env.GROQ_API_KEY);
  // if (process.env.GEMINI_API_KEY)     return new GeminiProvider();
  // if (process.env.OPENROUTER_API_KEY) return new OpenRouterProvider();

  return new StubProvider();
}

export const aiProvider: IAIProvider = createProvider();
