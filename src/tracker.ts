/**
 * AI Cost Tracker — drop-in token tracking for any LLM project.
 *
 * Logs every API call with model, tokens, cost, and what triggered it.
 * Stores to a local JSON file (no database required).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { estimateCostUSD } from "./pricing.js";

// ── Types ──

export interface TokenEntry {
  label: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  timestamp: string;
}

export interface TrackerConfig {
  /** Path to the JSON log file. Default: ./ai-costs/usage.json */
  logPath?: string;
  /** Monthly budget cap in USD. Logs a warning when exceeded. */
  monthlyCap?: number;
  /** Called when monthly spend exceeds the cap. */
  onBudgetExceeded?: (spent: number, cap: number) => void;
}

// ── State ──

let config: TrackerConfig = {};
let entries: TokenEntry[] = [];
let logPath = "";
let loaded = false;

// ── Setup ──

export function initTracker(opts: TrackerConfig = {}): void {
  config = opts;
  logPath = opts.logPath || join(process.cwd(), "ai-costs", "usage.json");

  const dir = dirname(logPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  if (existsSync(logPath)) {
    try {
      entries = JSON.parse(readFileSync(logPath, "utf-8"));
    } catch {
      entries = [];
    }
  }
  loaded = true;
}

function ensureLoaded(): void {
  if (!loaded) initTracker();
}

// ── Core tracking ──

export function trackUsage(data: {
  label: string;
  model: string;
  provider?: string;
  inputTokens: number;
  outputTokens: number;
}): TokenEntry {
  ensureLoaded();

  const cost = estimateCostUSD(data.model, data.inputTokens, data.outputTokens);
  const entry: TokenEntry = {
    label: data.label,
    model: data.model,
    provider: data.provider || "unknown",
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
    costUSD: Math.round(cost * 1_000_000) / 1_000_000, // 6 decimal places
    timestamp: new Date().toISOString(),
  };

  entries.push(entry);

  // Persist
  writeFileSync(logPath, JSON.stringify(entries, null, 2));

  // Budget check
  if (config.monthlyCap) {
    const monthSpend = getMonthSpend();
    if (monthSpend > config.monthlyCap) {
      const msg = `BUDGET EXCEEDED: $${monthSpend.toFixed(4)} / $${config.monthlyCap} cap`;
      console.warn(`\x1b[31m[ai-cost-tracker] ${msg}\x1b[0m`);
      config.onBudgetExceeded?.(monthSpend, config.monthlyCap);
    }
  }

  return entry;
}

// ── Queries ──

function getMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function getMonthSpend(month?: string): number {
  ensureLoaded();
  const key = month || getMonthKey(new Date());
  return entries
    .filter((e) => e.timestamp.startsWith(key))
    .reduce((sum, e) => sum + e.costUSD, 0);
}

export function getTodaySpend(): number {
  ensureLoaded();
  const today = new Date().toISOString().slice(0, 10);
  return entries
    .filter((e) => e.timestamp.startsWith(today))
    .reduce((sum, e) => sum + e.costUSD, 0);
}

export function getSpendByLabel(days = 30): Map<string, { cost: number; calls: number }> {
  ensureLoaded();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const result = new Map<string, { cost: number; calls: number }>();

  for (const e of entries) {
    if (e.timestamp < cutoff) continue;
    const existing = result.get(e.label) || { cost: 0, calls: 0 };
    existing.cost += e.costUSD;
    existing.calls++;
    result.set(e.label, existing);
  }

  return result;
}

export function getSpendByModel(days = 30): Map<string, { cost: number; calls: number }> {
  ensureLoaded();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const result = new Map<string, { cost: number; calls: number }>();

  for (const e of entries) {
    if (e.timestamp < cutoff) continue;
    const existing = result.get(e.model) || { cost: 0, calls: 0 };
    existing.cost += e.costUSD;
    existing.calls++;
    result.set(e.model, existing);
  }

  return result;
}

export function getAllEntries(): TokenEntry[] {
  ensureLoaded();
  return [...entries];
}
