/**
 * Model pricing matrix (USD per 1M tokens).
 * Update these when providers change pricing.
 */

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-20250514": { input: 15, output: 75 },
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },

  // OpenAI
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-5.4": { input: 2.5, output: 10 },
  "o3-mini": { input: 1.1, output: 4.4 },

  // Google
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },

  // Deepseek
  "deepseek-chat": { input: 0.27, output: 1.10 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
};

const DEFAULT_PRICING = { input: 3, output: 15 }; // assume sonnet-tier if unknown

export function estimateCostUSD(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  // Try exact match, then strip common prefixes
  const pricing =
    MODEL_PRICING[model] ||
    MODEL_PRICING[model.replace(/^(anthropic|openai|google|deepseek)\//, "")] ||
    DEFAULT_PRICING;

  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}
