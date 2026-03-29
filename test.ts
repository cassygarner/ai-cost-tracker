/**
 * Quick smoke test — verifies tracking, summary, and audit work without an API key.
 */

import { initTracker, trackUsage, getTodaySpend, getMonthSpend, getSpendByLabel, getSpendByModel } from "./src/tracker.js";
import { generateSummary, formatSummary } from "./src/summary.js";
import { estimateCostUSD } from "./src/pricing.js";
import { existsSync, rmSync } from "node:fs";

const TEST_LOG = "./test-ai-costs/usage.json";

// Clean up from previous runs
if (existsSync("./test-ai-costs")) rmSync("./test-ai-costs", { recursive: true });

// Init
initTracker({ logPath: TEST_LOG, monthlyCap: 50 });

// Simulate 2 days of usage
const yesterday = new Date(Date.now() - 86_400_000).toISOString();

// Manually backdate some entries for testing anomaly detection
trackUsage({ label: "classify-email", model: "claude-haiku-4-5-20251001", provider: "anthropic", inputTokens: 500, outputTokens: 100 });
trackUsage({ label: "classify-email", model: "claude-haiku-4-5-20251001", provider: "anthropic", inputTokens: 600, outputTokens: 120 });
trackUsage({ label: "draft-reply", model: "claude-sonnet-4-6", provider: "anthropic", inputTokens: 2000, outputTokens: 800 });
trackUsage({ label: "content-strategy", model: "claude-sonnet-4-6", provider: "anthropic", inputTokens: 5000, outputTokens: 2000 });
trackUsage({ label: "route-message", model: "claude-sonnet-4-6", provider: "anthropic", inputTokens: 300, outputTokens: 50 });
trackUsage({ label: "score-content", model: "gpt-4o", provider: "openai", inputTokens: 1000, outputTokens: 200 });

// Verify tracking
console.log("--- TRACKING TEST ---");
console.log(`Today's spend: $${getTodaySpend().toFixed(6)}`);
console.log(`Month spend:   $${getMonthSpend().toFixed(6)}`);
console.log(`Labels:`, Array.from(getSpendByLabel(1).keys()));
console.log(`Models:`, Array.from(getSpendByModel(1).keys()));

// Verify cost math
const sonnetCost = estimateCostUSD("claude-sonnet-4-6", 1_000_000, 1_000_000);
console.log(`\nSonnet 1M in + 1M out = $${sonnetCost} (expected: $18)`);

const haikuCost = estimateCostUSD("claude-haiku-4-5-20251001", 1_000_000, 1_000_000);
console.log(`Haiku 1M in + 1M out = $${haikuCost} (expected: $4.8)`);

// Verify summary
console.log("\n--- SUMMARY TEST ---");
const summary = generateSummary();
console.log(formatSummary(summary));

// Verify file exists
console.log(`\nLog file exists: ${existsSync(TEST_LOG)}`);

// Check assertions
const errors: string[] = [];
if (getTodaySpend() <= 0) errors.push("Today spend should be > 0");
if (getMonthSpend() <= 0) errors.push("Month spend should be > 0");
if (sonnetCost !== 18) errors.push(`Sonnet cost wrong: ${sonnetCost}`);
if (haikuCost !== 4.8) errors.push(`Haiku cost wrong: ${haikuCost}`);
if (!existsSync(TEST_LOG)) errors.push("Log file not created");
if (summary.todayRequests !== 6) errors.push(`Expected 6 requests, got ${summary.todayRequests}`);
if (summary.topWasters.length === 0) errors.push("Should have found optimization opportunities");

if (errors.length > 0) {
  console.error("\nFAILED:");
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log("\nAll checks passed.");
}

// Clean up
rmSync("./test-ai-costs", { recursive: true });
