/**
 * Daily summary generator with anomaly detection.
 *
 * Compares today's spend to the 7-day average per label.
 * Flags anything 2x+ its normal daily cost.
 */

import { getAllEntries, getMonthSpend, type TokenEntry } from "./tracker.js";

export interface DailySummary {
  date: string;
  todaySpend: number;
  todayRequests: number;
  avgDailySpend: number;
  monthSpend: number;
  anomalies: Array<{ label: string; todayCost: number; avgCost: number; multiplier: number }>;
  byLabel: Array<{ label: string; cost: number; calls: number }>;
  byModel: Array<{ model: string; cost: number; calls: number }>;
  topWasters: Array<{ label: string; model: string; suggestion: string; savingsEstimate: number }>;
}

const DOWNGRADE_CANDIDATES: Record<string, { to: string; savingsPercent: number }> = {
  "claude-sonnet-4-20250514": { to: "claude-haiku-4-5-20251001", savingsPercent: 67 },
  "claude-sonnet-4-5": { to: "claude-haiku-4-5-20251001", savingsPercent: 67 },
  "claude-sonnet-4-5-20250929": { to: "claude-haiku-4-5-20251001", savingsPercent: 67 },
  "claude-sonnet-4-6": { to: "claude-haiku-4-5-20251001", savingsPercent: 67 },
  "claude-3-5-sonnet-20241022": { to: "claude-haiku-4-5-20251001", savingsPercent: 67 },
  "claude-3-5-sonnet-latest": { to: "claude-haiku-4-5-20251001", savingsPercent: 67 },
  "claude-opus-4-20250514": { to: "claude-sonnet-4-6", savingsPercent: 80 },
  "claude-opus-4-6": { to: "claude-sonnet-4-6", savingsPercent: 80 },
  "gpt-4o": { to: "gpt-4o-mini", savingsPercent: 94 },
  "gpt-5.4": { to: "gpt-4o-mini", savingsPercent: 94 },
  "gemini-2.5-pro": { to: "gemini-2.0-flash", savingsPercent: 92 },
};

export function generateSummary(): DailySummary {
  const entries = getAllEntries();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  // Today's data
  const todayEntries = entries.filter((e) => e.timestamp.startsWith(today));
  const todaySpend = todayEntries.reduce((s, e) => s + e.costUSD, 0);

  // Last 7 days (excluding today)
  const weekEntries = entries.filter(
    (e) => e.timestamp >= sevenDaysAgo && !e.timestamp.startsWith(today),
  );
  const weekDays = new Set(weekEntries.map((e) => e.timestamp.slice(0, 10)));
  const numDays = Math.max(weekDays.size, 1);
  const weekTotal = weekEntries.reduce((s, e) => s + e.costUSD, 0);
  const avgDailySpend = weekTotal / numDays;

  // Per-label aggregation (today)
  const labelMap = new Map<string, { cost: number; calls: number }>();
  for (const e of todayEntries) {
    const existing = labelMap.get(e.label) || { cost: 0, calls: 0 };
    existing.cost += e.costUSD;
    existing.calls++;
    labelMap.set(e.label, existing);
  }

  // Per-label aggregation (week, for anomaly baseline)
  const weekLabelMap = new Map<string, number>();
  for (const e of weekEntries) {
    weekLabelMap.set(e.label, (weekLabelMap.get(e.label) || 0) + e.costUSD);
  }

  // Anomaly detection: today > 2x daily average for that label
  const anomalies: DailySummary["anomalies"] = [];
  for (const [label, data] of labelMap) {
    const weekAvg = (weekLabelMap.get(label) || 0) / numDays;
    if (weekAvg > 0.001 && data.cost > weekAvg * 2) {
      anomalies.push({
        label,
        todayCost: data.cost,
        avgCost: weekAvg,
        multiplier: Math.round((data.cost / weekAvg) * 10) / 10,
      });
    }
  }
  anomalies.sort((a, b) => b.multiplier - a.multiplier);

  // Per-model aggregation (today)
  const modelMap = new Map<string, { cost: number; calls: number }>();
  for (const e of todayEntries) {
    const existing = modelMap.get(e.model) || { cost: 0, calls: 0 };
    existing.cost += e.costUSD;
    existing.calls++;
    modelMap.set(e.model, existing);
  }

  // Top wasters: labels using expensive models that could be downgraded
  const labelModelMap = new Map<string, Map<string, { cost: number; calls: number }>>();
  for (const e of entries.filter((e) => e.timestamp >= sevenDaysAgo)) {
    if (!labelModelMap.has(e.label)) labelModelMap.set(e.label, new Map());
    const models = labelModelMap.get(e.label)!;
    const existing = models.get(e.model) || { cost: 0, calls: 0 };
    existing.cost += e.costUSD;
    existing.calls++;
    models.set(e.model, existing);
  }

  const topWasters: DailySummary["topWasters"] = [];
  for (const [label, models] of labelModelMap) {
    for (const [model, stats] of models) {
      const downgrade = DOWNGRADE_CANDIDATES[model];
      if (downgrade && stats.cost > 0.01) {
        topWasters.push({
          label,
          model,
          suggestion: `Switch to ${downgrade.to} (${downgrade.savingsPercent}% cheaper)`,
          savingsEstimate: (stats.cost * downgrade.savingsPercent) / 100,
        });
      }
    }
  }
  topWasters.sort((a, b) => b.savingsEstimate - a.savingsEstimate);

  return {
    date: today,
    todaySpend,
    todayRequests: todayEntries.length,
    avgDailySpend,
    monthSpend: getMonthSpend(),
    anomalies,
    byLabel: Array.from(labelMap.entries())
      .map(([label, d]) => ({ label, ...d }))
      .sort((a, b) => b.cost - a.cost),
    byModel: Array.from(modelMap.entries())
      .map(([model, d]) => ({ model, ...d }))
      .sort((a, b) => b.cost - a.cost),
    topWasters: topWasters.slice(0, 10),
  };
}

export function formatSummary(s: DailySummary): string {
  const lines: string[] = [];

  lines.push("AI COST TRACKER — DAILY SUMMARY");
  lines.push("=".repeat(40));
  lines.push("");
  lines.push(`Date:           ${s.date}`);
  lines.push(`Today's spend:  $${s.todaySpend.toFixed(4)} (${s.todayRequests} calls)`);
  lines.push(`7-day avg:      $${s.avgDailySpend.toFixed(4)}/day`);
  lines.push(`Month total:    $${s.monthSpend.toFixed(4)}`);

  if (s.avgDailySpend === 0) {
    lines.push(`Status:         First day of tracking`);
  } else if (s.todaySpend > s.avgDailySpend * 1.5) {
    lines.push(`WARNING:        ${(s.todaySpend / s.avgDailySpend).toFixed(1)}x your daily average`);
  } else {
    lines.push(`Status:         Within normal range`);
  }

  if (s.anomalies.length > 0) {
    lines.push("");
    lines.push("ANOMALIES (2x+ daily average):");
    for (const a of s.anomalies) {
      lines.push(`  ${a.label}: $${a.todayCost.toFixed(4)} (${a.multiplier}x avg)`);
    }
  }

  if (s.byLabel.length > 0) {
    lines.push("");
    lines.push("SPEND BY LABEL:");
    for (const l of s.byLabel.slice(0, 10)) {
      lines.push(`  ${l.label.padEnd(30)} $${l.cost.toFixed(4)}  (${l.calls} calls)`);
    }
  }

  if (s.byModel.length > 0) {
    lines.push("");
    lines.push("SPEND BY MODEL:");
    for (const m of s.byModel) {
      lines.push(`  ${m.model.padEnd(35)} $${m.cost.toFixed(4)}  (${m.calls} calls)`);
    }
  }

  if (s.topWasters.length > 0) {
    lines.push("");
    lines.push("OPTIMIZATION OPPORTUNITIES:");
    for (const w of s.topWasters.slice(0, 5)) {
      lines.push(`  ${w.label} (${w.model})`);
      lines.push(`    -> ${w.suggestion}`);
      lines.push(`    -> Est. savings: $${w.savingsEstimate.toFixed(4)}/week`);
    }
  }

  return lines.join("\n");
}
