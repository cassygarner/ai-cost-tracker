#!/usr/bin/env tsx
/**
 * Test AI-powered review with simulated multi-week data.
 * Requires ANTHROPIC_API_KEY.
 */

import { initTracker } from "./src/tracker.js";
import { generateAIReview } from "./src/ai-review.js";
import { existsSync, rmSync, writeFileSync, mkdirSync } from "node:fs";

const TEST_LOG = "./test-ai-review-costs/usage.json";
if (existsSync("./test-ai-review-costs")) rmSync("./test-ai-review-costs", { recursive: true });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY not set.");
  process.exit(1);
}

// Build realistic 30 days of usage data
const entries: any[] = [];
const now = Date.now();

for (let day = 30; day >= 0; day--) {
  const date = new Date(now - day * 86_400_000);
  const ts = date.toISOString();

  // Steady features (every day)
  entries.push({
    label: "classify-email", model: "claude-haiku-4-5-20251001", provider: "anthropic",
    inputTokens: 500, outputTokens: 100, costUSD: 0.0008, timestamp: ts
  });
  entries.push({
    label: "route-message", model: "claude-sonnet-4-6", provider: "anthropic",
    inputTokens: 300, outputTokens: 50, costUSD: 0.0016, timestamp: ts
  });
  entries.push({
    label: "draft-reply", model: "claude-sonnet-4-6", provider: "anthropic",
    inputTokens: 2000, outputTokens: 800, costUSD: 0.018, timestamp: ts
  });

  // High-frequency feature (runs 10x/day on expensive model)
  for (let i = 0; i < 10; i++) {
    entries.push({
      label: "score-content", model: "claude-sonnet-4-6", provider: "anthropic",
      inputTokens: 400, outputTokens: 80, costUSD: 0.0024, timestamp: ts
    });
  }

  // New feature added 7 days ago (spiking cost)
  if (day <= 7) {
    entries.push({
      label: "content-strategy", model: "claude-sonnet-4-6", provider: "anthropic",
      inputTokens: 5000, outputTokens: 2000, costUSD: 0.045, timestamp: ts
    });
    // Extra calls on recent days
    if (day <= 3) {
      entries.push({
        label: "content-strategy", model: "claude-sonnet-4-6", provider: "anthropic",
        inputTokens: 5000, outputTokens: 2000, costUSD: 0.045, timestamp: ts
      });
    }
  }
}

mkdirSync("./test-ai-review-costs", { recursive: true });
writeFileSync(TEST_LOG, JSON.stringify(entries, null, 2));
initTracker({ logPath: TEST_LOG });

console.log("=== AI-POWERED WEEKLY REVIEW ===\n");
console.log("Sending usage data to Haiku for analysis...\n");

try {
  const review = await generateAIReview({ period: "weekly" });
  console.log(review);

  // Basic validation
  const errors: string[] = [];
  if (!review || review.length < 50) errors.push("Review is too short or empty");
  if (review.length > 3000) errors.push("Review is way too long");

  if (errors.length > 0) {
    console.error("\n=== FAILED ===");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  } else {
    console.log("\n=== AI REVIEW TEST PASSED ===");
  }
} catch (err: any) {
  console.error(`\n=== FAILED: ${err.message} ===`);
  process.exit(1);
}

rmSync("./test-ai-review-costs", { recursive: true });
