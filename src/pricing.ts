/**
 * Model pricing matrix (USD per 1M tokens).
 * Update these when providers change pricing.
 */

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-sonnet-4-5-20250929": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  "claude-3-5-sonnet-latest": { input: 3, output: 15 },
  "claude-opus-4-20250514": { input: 15, output: 75 },
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
  "claude-3-5-haiku-latest": { input: 0.8, output: 4 },

  // OpenAI
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-5.4": { input: 2.5, output: 10 },
  "o3-mini": { input: 1.1, output: 4.4 },

  // Google
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },

  // Deepseek
  "deepseek-chat": { input: 0.27, output: 1.10 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
};

export type ModelTier = "cheap" | "mid" | "expensive" | "unknown";

/**
 * Classify a model by cost tier using input price as the anchor.
 * Real workloads skew heavily input-heavy, so input $/1M is the cleanest signal.
 * cheap < $1.5 (haiku, mini, flash, deepseek), expensive ≥ $10 (opus, gpt-4-turbo),
 * everything else is mid (sonnet, gpt-4o). Used by the audit so it won't recommend
 * downgrading a task that's already on a cheap model.
 */
export function getModelTier(model: string): ModelTier {
  const pricing =
    MODEL_PRICING[model] ||
    MODEL_PRICING[model.replace(/^(anthropic|openai|google|deepseek)\//, "")];
  if (!pricing) return "unknown";
  if (pricing.input < 1.5) return "cheap";
  if (pricing.input >= 10) return "expensive";
  return "mid";
}

const DEFAULT_PRICING = { input: 3, output: 15 }; // assume sonnet-tier if unknown
const warnedModels = new Set<string>();

// Anthropic 5-minute ephemeral cache: reads cost 10% of base input,
// writes cost 125%. Silently ignored for providers without caching.
const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 1.25;

export function estimateCostUSD(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0,
  cacheCreationTokens = 0,
): number {
  const stripped = model.replace(/^(anthropic|openai|google|deepseek)\//, "");
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[stripped];
  const rates = pricing || DEFAULT_PRICING;

  if (!pricing && !warnedModels.has(model)) {
    warnedModels.add(model);
    console.warn(
      `[ai-cost-tracker] Unknown model "${model}". ` +
        `Using Sonnet-tier pricing as a fallback ($3/$15 per 1M). ` +
        `Add it to MODEL_PRICING in src/pricing.ts for accurate costs.`,
    );
  }

  return (
    (inputTokens / 1_000_000) * rates.input +
    (outputTokens / 1_000_000) * rates.output +
    (cachedInputTokens / 1_000_000) * rates.input * CACHE_READ_MULTIPLIER +
    (cacheCreationTokens / 1_000_000) * rates.input * CACHE_WRITE_MULTIPLIER
  );
}
