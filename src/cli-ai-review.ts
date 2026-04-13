#!/usr/bin/env tsx
/**
 * CLI: Run an AI-powered cost review.
 * Usage:
 *   npm run ai-review           (defaults to weekly)
 *   npm run ai-review daily
 *   npm run ai-review weekly
 *   npm run ai-review monthly
 *
 * Requires ANTHROPIC_API_KEY in environment.
 * Cost: ~$0.01-0.05 per review (one Haiku call).
 */

import "./load-env.js";
import { initTracker } from "./tracker.js";
import { generateAIReview, type AIReviewOptions } from "./ai-review.js";
import type { ReviewPeriod } from "./review.js";

const period = (process.argv[2] || "weekly") as ReviewPeriod;

if (!["daily", "weekly", "monthly"].includes(period)) {
  console.error("Usage: npm run ai-review [daily|weekly|monthly]");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY not set.");
  process.exit(1);
}

initTracker();

console.log(`Running AI-powered ${period} review...\n`);
const review = await generateAIReview({ period });
console.log(review);
