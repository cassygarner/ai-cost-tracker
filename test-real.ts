#!/usr/bin/env tsx
/**
 * Real end-to-end test — makes actual API calls and verifies everything works.
 * Requires ANTHROPIC_API_KEY in environment.
 */

import { initTracker, getTodaySpend, getSpendByLabel, getSpendByModel } from "./src/tracker.js";
import { createTrackedClient } from "./src/wrapper.js";
import { generateSummary, formatSummary } from "./src/summary.js";
import { existsSync, rmSync } from "node:fs";

const TEST_LOG = "./test-real-costs/usage.json";
if (existsSync("./test-real-costs")) rmSync("./test-real-costs", { recursive: true });

// Check API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY not set. Run: export ANTHROPIC_API_KEY=sk-ant-...");
  process.exit(1);
}

console.log("=== REAL END-TO-END TEST ===\n");

// 1. Init tracker
initTracker({ logPath: TEST_LOG, monthlyCap: 1 });
console.log("[1/5] Tracker initialized");

// 2. Create tracked client
const claude = createTrackedClient({ defaultLabel: "e2e-test" });
console.log("[2/5] Tracked client created");

// 3. Make a real Haiku call (cheapest possible)
console.log("[3/5] Making real API call to Claude Haiku...");
const { text: text1, usage: usage1 } = await claude.ask("Reply with exactly: PONG", {
  label: "test-haiku-ping",
  model: "claude-haiku-4-5-20251001",
  maxTokens: 10,
});
console.log(`  Response: "${text1.trim()}"`);
console.log(`  Tokens: ${usage1.inputTokens} in / ${usage1.outputTokens} out`);
console.log(`  Cost: $${usage1.costUSD}`);

// 4. Make a second call with a different label
console.log("[4/5] Making second API call...");
const { text: text2, usage: usage2 } = await claude.ask("Reply with exactly: HELLO", {
  label: "test-haiku-hello",
  model: "claude-haiku-4-5-20251001",
  maxTokens: 10,
});
console.log(`  Response: "${text2.trim()}"`);
console.log(`  Cost: $${usage2.costUSD}`);

// 5. Verify everything
console.log("\n[5/5] Verifying...");

const errors: string[] = [];

// Check today's spend is positive
const todaySpend = getTodaySpend();
if (todaySpend <= 0) errors.push(`Today spend should be > 0, got ${todaySpend}`);
else console.log(`  Today's spend: $${todaySpend.toFixed(6)}`);

// Check labels exist
const labels = getSpendByLabel(1);
if (!labels.has("test-haiku-ping")) errors.push("Missing label: test-haiku-ping");
if (!labels.has("test-haiku-hello")) errors.push("Missing label: test-haiku-hello");
else console.log(`  Labels tracked: ${Array.from(labels.keys()).join(", ")}`);

// Check model tracked
const models = getSpendByModel(1);
if (!models.has("claude-haiku-4-5-20251001")) errors.push("Missing model tracking");
else console.log(`  Models tracked: ${Array.from(models.keys()).join(", ")}`);

// Check log file exists
if (!existsSync(TEST_LOG)) errors.push("Log file not created");
else console.log(`  Log file: ${TEST_LOG} exists`);

// Check summary works
const summary = generateSummary();
if (summary.todayRequests !== 2) errors.push(`Expected 2 requests, got ${summary.todayRequests}`);
else console.log(`  Summary: ${summary.todayRequests} requests tracked`);

// Print summary
console.log("\n" + formatSummary(summary));

if (errors.length > 0) {
  console.error("\n=== FAILED ===");
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log("\n=== ALL CHECKS PASSED ===");
}

// Clean up
rmSync("./test-real-costs", { recursive: true });
