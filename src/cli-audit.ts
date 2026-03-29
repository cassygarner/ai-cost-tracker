#!/usr/bin/env tsx
/**
 * CLI: Model audit — scans your usage log and tells you where to save money.
 * Run: npx tsx src/cli-audit.ts
 *   or: npm run audit
 */

import { initTracker, getSpendByLabel, getSpendByModel, getMonthSpend } from "./tracker.js";
import { MODEL_PRICING } from "./pricing.js";

const logPath = process.argv[2] || undefined;
initTracker({ logPath });

const HAIKU_TASKS = [
  "classif", "categoriz", "rout", "filter", "sort", "tag",
  "label", "detect", "score", "rank", "parse", "extract",
  "summariz", "triage",
];

const monthSpend = getMonthSpend();
const byLabel = getSpendByLabel(30);
const byModel = getSpendByModel(30);

console.log("AI COST TRACKER — MODEL AUDIT");
console.log("=".repeat(40));
console.log(`\nMonth-to-date spend: $${monthSpend.toFixed(4)}\n`);

// Model breakdown
console.log("MODEL USAGE (last 30 days):");
const modelEntries = Array.from(byModel.entries()).sort((a, b) => b[1].cost - a[1].cost);
for (const [model, stats] of modelEntries) {
  const avgCost = stats.cost / stats.calls;
  console.log(`  ${model.padEnd(35)} $${stats.cost.toFixed(4)}  (${stats.calls} calls, $${avgCost.toFixed(6)}/call)`);
}

// Find downgrade opportunities
console.log("\nOPTIMIZATION RECOMMENDATIONS:");
console.log("-".repeat(40));

let totalSavings = 0;
const recommendations: string[] = [];

const labelEntries = Array.from(byLabel.entries()).sort((a, b) => b[1].cost - a[1].cost);
for (const [label, stats] of labelEntries) {
  const lowerLabel = label.toLowerCase();

  // Check if label sounds like a classification/simple task
  const isSimpleTask = HAIKU_TASKS.some((t) => lowerLabel.includes(t));

  if (isSimpleTask) {
    // Estimate savings: assume ~73% reduction switching to Haiku
    const est = stats.cost * 0.73;
    totalSavings += est;
    recommendations.push(
      `  "${label}" looks like a classification task (${stats.calls} calls, $${stats.cost.toFixed(4)})\n` +
      `    -> Consider Haiku instead of Sonnet. Est. savings: $${est.toFixed(4)}/month`,
    );
  }
}

if (recommendations.length > 0) {
  for (const r of recommendations) console.log(r);
  console.log(`\nTotal estimated monthly savings: $${totalSavings.toFixed(4)}`);
} else {
  console.log("  No obvious downgrades found based on label names.");
  console.log("  Tip: use descriptive labels like 'classify-email' or 'route-message'");
  console.log("  so the audit can detect simple tasks using expensive models.");
}

// Frequency analysis
console.log("\nFREQUENCY ANALYSIS:");
console.log("-".repeat(40));
for (const [label, stats] of labelEntries.slice(0, 10)) {
  const avgPerDay = stats.calls / 30;
  const costPerCall = stats.cost / stats.calls;
  if (avgPerDay > 10) {
    console.log(`  "${label}": ${avgPerDay.toFixed(1)} calls/day, $${costPerCall.toFixed(6)}/call`);
    console.log(`    -> High frequency. Could you batch these or reduce frequency?`);
  } else if (avgPerDay > 3) {
    console.log(`  "${label}": ${avgPerDay.toFixed(1)} calls/day, $${costPerCall.toFixed(6)}/call`);
  }
}
