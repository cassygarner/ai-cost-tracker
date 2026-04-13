#!/usr/bin/env tsx
/**
 * CLI: Print daily cost summary.
 * Run: npx tsx src/cli-summary.ts
 *   or: npm run summary
 */

import "./load-env.js";
import { initTracker } from "./tracker.js";
import { generateSummary, formatSummary } from "./summary.js";

const logPath = process.argv[2] || undefined;
initTracker({ logPath });

const summary = generateSummary();
console.log(formatSummary(summary));
