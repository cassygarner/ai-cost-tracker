/**
 * Drop-in wrapper for Anthropic SDK that auto-tracks every call.
 *
 * Usage:
 *   import { createTrackedClient } from "ai-cost-tracker";
 *   const claude = createTrackedClient({ apiKey: process.env.ANTHROPIC_API_KEY });
 *   const response = await claude.ask("What is 2+2?", { label: "math-helper" });
 */

import "./load-env.js";
import Anthropic from "@anthropic-ai/sdk";
import { trackUsage, type TokenEntry } from "./tracker.js";

export interface TrackedClientOptions {
  apiKey?: string;
  defaultModel?: string;
  defaultLabel?: string;
}

export interface AskOptions {
  label?: string;
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AskResult {
  text: string;
  usage: TokenEntry;
}

export function createTrackedClient(opts: TrackedClientOptions = {}) {
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[ai-cost-tracker] ANTHROPIC_API_KEY is missing. " +
        "Add it to your .env file or pass it as `createTrackedClient({ apiKey })`.",
    );
  }
  const client = new Anthropic({ apiKey });
  const defaultModel = opts.defaultModel || "claude-sonnet-4-6";
  const defaultLabel = opts.defaultLabel || "default";

  async function ask(prompt: string, options?: AskOptions): Promise<AskResult> {
    const model = options?.model || defaultModel;
    const label = options?.label || defaultLabel;

    const response = await client.messages.create({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.3,
      system: options?.system,
      messages: [{ role: "user", content: prompt }],
    });

    const usage = trackUsage({
      label,
      model,
      provider: "anthropic",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    const block = response.content[0];
    const text = block.type === "text" ? block.text : "";

    return { text, usage };
  }

  async function askJSON<T = any>(prompt: string, options?: AskOptions): Promise<{ data: T; usage: TokenEntry }> {
    const result = await ask(prompt, {
      ...options,
      system: `${options?.system || ""}\n\nRespond with valid JSON only. No markdown, no explanation.`.trim(),
    });

    let cleaned = result.text
      .replace(/^```(?:json)?\s*\n?/m, "")
      .replace(/\n?```\s*$/m, "")
      .trim();

    try {
      return { data: JSON.parse(cleaned) as T, usage: result.usage };
    } catch (err) {
      const snippet = cleaned.slice(0, 200);
      throw new Error(
        `[ai-cost-tracker] askJSON could not parse model output as JSON. ` +
          `First 200 chars: ${snippet}`,
      );
    }
  }

  return { ask, askJSON, client };
}
