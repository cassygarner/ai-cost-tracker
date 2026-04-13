#!/usr/bin/env tsx
/**
 * CLI: Run a cost review for a given period.
 * Usage:
 *   npm run review           (defaults to weekly)
 *   npm run review daily
 *   npm run review weekly
 *   npm run review monthly
 */

import "./load-env.js";
import { initTracker } from "./tracker.js";
import { generateReview, formatReview, type ReviewPeriod } from "./review.js";

const period = (process.argv[2] || "weekly") as ReviewPeriod;

if (!["daily", "weekly", "monthly"].includes(period)) {
  console.error("Usage: npm run review [daily|weekly|monthly]");
  process.exit(1);
}

initTracker();

const review = generateReview(period);
console.log(formatReview(review));
