#!/usr/bin/env tsx
/**
 * Test the review system with simulated multi-day data.
 */

import { initTracker, trackUsage, getAllEntries } from "./src/tracker.js";
import { generateReview, formatReview } from "./src/review.js";
import { existsSync, rmSync, readFileSync, writeFileSync } from "node:fs";

const TEST_LOG = "./test-review-costs/usage.json";
if (existsSync("./test-review-costs")) rmSync("./test-review-costs", { recursive: true });

initTracker({ logPath: TEST_LOG });

// Simulate 2 weeks of data by backdating entries
const entries: any[] = [];
const now = Date.now();

// Week 1 (previous period): normal spend
for (let day = 14; day > 7; day--) {
  const date = new Date(now - day * 86_400_000);
  entries.push({
    label: "classify-email", model: "claude-haiku-4-5-20251001", provider: "anthropic",
    inputTokens: 500, outputTokens: 100, costUSD: 0.0008, timestamp: date.toISOString()
  });
  entries.push({
    label: "draft-reply", model: "claude-sonnet-4-6", provider: "anthropic",
    inputTokens: 2000, outputTokens: 800, costUSD: 0.018, timestamp: date.toISOString()
  });
  entries.push({
    label: "route-message", model: "claude-sonnet-4-6", provider: "anthropic",
    inputTokens: 300, outputTokens: 50, costUSD: 0.0016, timestamp: date.toISOString()
  });
}

// Week 2 (current period): classify-email spiked 3x, route-message same
for (let day = 7; day > 0; day--) {
  const date = new Date(now - day * 86_400_000);
  // 3x the classify calls
  for (let i = 0; i < 3; i++) {
    entries.push({
      label: "classify-email", model: "claude-haiku-4-5-20251001", provider: "anthropic",
      inputTokens: 500, outputTokens: 100, costUSD: 0.0008, timestamp: date.toISOString()
    });
  }
  entries.push({
    label: "draft-reply", model: "claude-sonnet-4-6", provider: "anthropic",
    inputTokens: 2000, outputTokens: 800, costUSD: 0.018, timestamp: date.toISOString()
  });
  entries.push({
    label: "route-message", model: "claude-sonnet-4-6", provider: "anthropic",
    inputTokens: 300, outputTokens: 50, costUSD: 0.0016, timestamp: date.toISOString()
  });
  // New feature this week
  entries.push({
    label: "content-strategy", model: "claude-sonnet-4-6", provider: "anthropic",
    inputTokens: 5000, outputTokens: 2000, costUSD: 0.045, timestamp: date.toISOString()
  });
}

// Today
entries.push({
  label: "classify-email", model: "claude-haiku-4-5-20251001", provider: "anthropic",
  inputTokens: 500, outputTokens: 100, costUSD: 0.0008, timestamp: new Date().toISOString()
});
entries.push({
  label: "draft-reply", model: "claude-sonnet-4-6", provider: "anthropic",
  inputTokens: 2000, outputTokens: 800, costUSD: 0.018, timestamp: new Date().toISOString()
});

writeFileSync(TEST_LOG, JSON.stringify(entries, null, 2));

// Re-init to load the backdated data
initTracker({ logPath: TEST_LOG });

console.log("=== WEEKLY REVIEW ===\n");
const weekly = generateReview("weekly");
console.log(formatReview(weekly));

console.log("\n\n=== DAILY REVIEW ===\n");
const daily = generateReview("daily");
console.log(formatReview(daily));

// Verify
const errors: string[] = [];
if (weekly.currentSpend <= 0) errors.push("Weekly current spend should be > 0");
if (weekly.previousSpend <= 0) errors.push("Weekly previous spend should be > 0");
if (weekly.changePercent <= 0) errors.push("Spend should have increased (new feature + spike)");
if (weekly.spikes.length === 0) errors.push("Should have detected classify-email spike");
if (weekly.suggestions.length === 0) errors.push("Should have generated suggestions");
if (weekly.topFeatures.length < 3) errors.push("Should have at least 3 features");

if (errors.length > 0) {
  console.error("\n=== FAILED ===");
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log("\n=== ALL REVIEW CHECKS PASSED ===");
}

rmSync("./test-review-costs", { recursive: true });
