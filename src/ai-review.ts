/**
 * AI-powered cost review — sends your usage data to an LLM for analysis.
 *
 * Unlike the regular review (just math), this gives you contextual,
 * specific recommendations based on your actual usage patterns.
 *
 * Cost: ~$0.01-0.05 per review (one Haiku call).
 */

import { initTracker, getAllEntries, getSpendByLabel, getSpendByModel, getMonthSpend } from "./tracker.js";
import { generateReview, formatReview, type ReviewPeriod } from "./review.js";
import { createTrackedClient } from "./wrapper.js";

export interface AIReviewOptions {
  period?: ReviewPeriod;
  /** Anthropic API key. Falls back to ANTHROPIC_API_KEY env var. */
  apiKey?: string;
  /** Model to use for the review. Defaults to Haiku to keep costs low. */
  model?: string;
}

export async function generateAIReview(options: AIReviewOptions = {}): Promise<string> {
  const period = options.period || "weekly";
  const model = options.model || "claude-haiku-4-5-20251001";

  // Generate the data-only review first
  const review = generateReview(period);
  const reviewText = formatReview(review);

  // Get additional context
  const monthSpend = getMonthSpend();
  const byLabel = getSpendByLabel(30);
  const byModel = getSpendByModel(30);

  const labelBreakdown = Array.from(byLabel.entries())
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 15)
    .map(([label, d]) => `${label}: $${d.cost.toFixed(4)} (${d.calls} calls, $${(d.cost / d.calls).toFixed(6)}/call)`)
    .join("\n");

  const modelBreakdown = Array.from(byModel.entries())
    .sort((a, b) => b[1].cost - a[1].cost)
    .map(([model, d]) => `${model}: $${d.cost.toFixed(4)} (${d.calls} calls)`)
    .join("\n");

  const prompt = `You are an AI cost optimization advisor. Analyze this usage data and give specific, actionable recommendations.

Here is the ${period} cost review:
${reviewText}

Month-to-date spend: $${monthSpend.toFixed(4)}

Last 30 days by feature:
${labelBreakdown}

Last 30 days by model:
${modelBreakdown}

Based on this data, write a short review (under 300 words) that covers:
1. The headline: is spending healthy, growing, or concerning?
2. The top 2-3 specific changes they should make (be specific about which features and which models)
3. One thing they're doing well (if anything stands out)

Be direct. No fluff. Use actual numbers from the data. If there's not enough data yet, say so.`;

  const claude = createTrackedClient({ apiKey: options.apiKey });
  const { text } = await claude.ask(prompt, {
    label: "ai-cost-review",
    model,
    maxTokens: 1024,
  });

  return text;
}
