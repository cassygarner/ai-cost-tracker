/**
 * Automated cost review — generates a plain-English report of your AI spending.
 *
 * Can run daily, weekly, or monthly. Compares current period to previous period
 * and highlights what changed, what spiked, and what you should look at.
 *
 * Uses zero AI tokens — it's just math and string formatting.
 */

import { getAllEntries, type TokenEntry } from "./tracker.js";

export type ReviewPeriod = "daily" | "weekly" | "monthly";

export interface ReviewReport {
  period: ReviewPeriod;
  currentSpend: number;
  previousSpend: number;
  changePercent: number;
  totalCalls: number;
  topFeatures: Array<{ label: string; cost: number; calls: number; changePercent: number }>;
  topModels: Array<{ model: string; cost: number; calls: number }>;
  spikes: Array<{ label: string; currentCost: number; previousCost: number; multiplier: number }>;
  suggestions: string[];
}

function getPeriodDays(period: ReviewPeriod): number {
  if (period === "daily") return 1;
  if (period === "weekly") return 7;
  return 30;
}

function getEntriesInRange(entries: TokenEntry[], startDate: Date, endDate: Date): TokenEntry[] {
  const start = startDate.toISOString();
  const end = endDate.toISOString();
  return entries.filter((e) => e.timestamp >= start && e.timestamp < end);
}

export function generateReview(period: ReviewPeriod = "weekly"): ReviewReport {
  const entries = getAllEntries();
  const now = new Date();
  const days = getPeriodDays(period);

  const currentStart = new Date(now.getTime() - days * 86_400_000);
  const previousStart = new Date(now.getTime() - days * 2 * 86_400_000);

  const currentEntries = getEntriesInRange(entries, currentStart, now);
  const previousEntries = getEntriesInRange(entries, previousStart, currentStart);

  const currentSpend = currentEntries.reduce((s, e) => s + e.costUSD, 0);
  const previousSpend = previousEntries.reduce((s, e) => s + e.costUSD, 0);
  const changePercent = previousSpend > 0 ? ((currentSpend - previousSpend) / previousSpend) * 100 : 0;

  // Per-label breakdown (current period)
  const currentByLabel = new Map<string, { cost: number; calls: number }>();
  for (const e of currentEntries) {
    const existing = currentByLabel.get(e.label) || { cost: 0, calls: 0 };
    existing.cost += e.costUSD;
    existing.calls++;
    currentByLabel.set(e.label, existing);
  }

  // Per-label breakdown (previous period)
  const previousByLabel = new Map<string, { cost: number; calls: number }>();
  for (const e of previousEntries) {
    const existing = previousByLabel.get(e.label) || { cost: 0, calls: 0 };
    existing.cost += e.costUSD;
    existing.calls++;
    previousByLabel.set(e.label, existing);
  }

  // Top features with change
  const topFeatures = Array.from(currentByLabel.entries())
    .map(([label, data]) => {
      const prev = previousByLabel.get(label)?.cost || 0;
      const change = prev > 0 ? ((data.cost - prev) / prev) * 100 : 0;
      return { label, cost: data.cost, calls: data.calls, changePercent: Math.round(change) };
    })
    .sort((a, b) => b.cost - a.cost);

  // Per-model breakdown
  const currentByModel = new Map<string, { cost: number; calls: number }>();
  for (const e of currentEntries) {
    const existing = currentByModel.get(e.model) || { cost: 0, calls: 0 };
    existing.cost += e.costUSD;
    existing.calls++;
    currentByModel.set(e.model, existing);
  }

  const topModels = Array.from(currentByModel.entries())
    .map(([model, data]) => ({ model, cost: data.cost, calls: data.calls }))
    .sort((a, b) => b.cost - a.cost);

  // Spikes: features that cost 2x+ more than previous period
  const spikes = topFeatures
    .filter((f) => {
      const prev = previousByLabel.get(f.label)?.cost || 0;
      return prev > 0.001 && f.cost > prev * 2;
    })
    .map((f) => {
      const prev = previousByLabel.get(f.label)?.cost || 0;
      return { label: f.label, currentCost: f.cost, previousCost: prev, multiplier: Math.round((f.cost / prev) * 10) / 10 };
    })
    .sort((a, b) => b.multiplier - a.multiplier);

  // Auto-generate suggestions
  const suggestions: string[] = [];

  if (changePercent > 20) {
    suggestions.push(`Your spend went up ${Math.round(changePercent)}% this ${period === "daily" ? "day" : period === "weekly" ? "week" : "month"}. Check the spikes below.`);
  } else if (changePercent < -10) {
    suggestions.push(`Your spend dropped ${Math.abs(Math.round(changePercent))}%. Whatever you changed is working.`);
  }

  for (const spike of spikes.slice(0, 3)) {
    suggestions.push(`"${spike.label}" is ${spike.multiplier}x its previous cost. Worth investigating.`);
  }

  // Check for expensive models on high-volume tasks
  const CHEAP_THRESHOLD = 20; // calls per period
  for (const [label, data] of currentByLabel) {
    if (data.calls > CHEAP_THRESHOLD) {
      const labelEntries = currentEntries.filter((e) => e.label === label);
      const usesExpensive = labelEntries.some((e) =>
        e.model.includes("sonnet") || e.model.includes("opus") || e.model.includes("gpt-4o")
      );
      if (usesExpensive) {
        suggestions.push(`"${label}" runs ${data.calls}x per ${period === "daily" ? "day" : period === "weekly" ? "week" : "month"} on an expensive model. Could a cheaper model handle it?`);
      }
    }
  }

  if (suggestions.length === 0) {
    suggestions.push("Nothing unusual. Your costs look stable.");
  }

  return {
    period,
    currentSpend,
    previousSpend,
    changePercent,
    totalCalls: currentEntries.length,
    topFeatures: topFeatures.slice(0, 10),
    topModels,
    spikes,
    suggestions,
  };
}

export function formatReview(r: ReviewReport): string {
  const periodLabel = r.period === "daily" ? "Today" : r.period === "weekly" ? "This week" : "This month";
  const prevLabel = r.period === "daily" ? "yesterday" : r.period === "weekly" ? "last week" : "last month";

  const lines: string[] = [];

  lines.push(`AI COST REVIEW (${r.period})`);
  lines.push("=".repeat(40));
  lines.push("");
  lines.push(`${periodLabel}:    $${r.currentSpend.toFixed(4)} across ${r.totalCalls} calls`);
  lines.push(`vs ${prevLabel}: $${r.previousSpend.toFixed(4)}`);

  if (r.previousSpend > 0) {
    const arrow = r.changePercent > 0 ? "UP" : r.changePercent < 0 ? "DOWN" : "FLAT";
    lines.push(`Change:       ${arrow} ${Math.abs(Math.round(r.changePercent))}%`);
  } else if (r.currentSpend > 0) {
    const needed = r.period === "daily" ? "2 days" : r.period === "weekly" ? "14 days" : "60 days";
    lines.push(`Note:         No prior period to compare yet. Need ${needed} of data for a real trend.`);
  }

  if (r.topFeatures.length > 0) {
    lines.push("");
    lines.push("TOP FEATURES:");
    for (const f of r.topFeatures.slice(0, 7)) {
      const change = f.changePercent !== 0 ? ` (${f.changePercent > 0 ? "+" : ""}${f.changePercent}%)` : "";
      lines.push(`  ${f.label.padEnd(30)} $${f.cost.toFixed(4)}  ${f.calls} calls${change}`);
    }
  }

  if (r.topModels.length > 0) {
    lines.push("");
    lines.push("MODELS USED:");
    for (const m of r.topModels) {
      lines.push(`  ${m.model.padEnd(35)} $${m.cost.toFixed(4)}  ${m.calls} calls`);
    }
  }

  if (r.spikes.length > 0) {
    lines.push("");
    lines.push("SPIKES:");
    for (const s of r.spikes) {
      lines.push(`  ${s.label}: ${s.multiplier}x previous ($${s.previousCost.toFixed(4)} -> $${s.currentCost.toFixed(4)})`);
    }
  }

  lines.push("");
  lines.push("WHAT TO DO:");
  for (const s of r.suggestions) {
    lines.push(`  - ${s}`);
  }

  return lines.join("\n");
}
