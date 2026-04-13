# AI Cost Tracker

Track every AI API call, see exactly where your money goes, and catch cost spikes before they hurt.

Built by [@cassy.garner](https://instagram.com/cassy.garner) — this is the same system I use to manage 37 automated cron jobs and 12 AI agents at ~$50/month.

## What it does

- Logs every LLM call with model, tokens, cost, and a label you choose
- Stores everything in a local JSON file (no database needed)
- Generates daily summaries with anomaly detection (flags 2x+ spend spikes)
- Audits your usage and tells you which tasks could use cheaper models
- Optional monthly budget cap with warnings

## Quick start

```bash
npm install
```

Add your Anthropic API key to `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

### Option 1: Drop-in wrapper (recommended)

Replace your Anthropic calls with the tracked client:

```typescript
import { initTracker, createTrackedClient } from "./src/index.js";

// Initialize once at startup
initTracker({ monthlyCap: 50 }); // optional $50/month budget cap

// Create a tracked client
const claude = createTrackedClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Use it like normal — tracking happens automatically
const { text, usage } = await claude.ask("Summarize this article", {
  label: "content-summarizer",  // name your task so you can track costs per feature
  model: "claude-haiku-4-5-20251001", // pick the right model for the job
});

console.log(text);
console.log(`Cost: $${usage.costUSD}`);
```

### Option 2: Manual tracking (for any provider)

If you're using OpenAI, Google, or any other provider:

```typescript
import { initTracker, trackUsage } from "./src/index.js";

initTracker();

// After any LLM call, log the usage
trackUsage({
  label: "classify-email",
  model: "gpt-4o-mini",
  provider: "openai",
  inputTokens: response.usage.prompt_tokens,
  outputTokens: response.usage.completion_tokens,
});
```

## See your costs

### Daily summary
```bash
npm run summary
```

Output:
```
AI COST TRACKER — DAILY SUMMARY
========================================

Date:           2026-03-28
Today's spend:  $1.2340 (47 calls)
7-day avg:      $0.8200/day
Month total:    $24.6800
WARNING:        1.5x your daily average

ANOMALIES (2x+ daily average):
  social-listening: $0.4200 (3.1x avg)

SPEND BY LABEL:
  content-strategy               $0.4500  (3 calls)
  social-listening               $0.4200  (6 calls)
  draft-reply                    $0.1800  (12 calls)
  classify-email                 $0.0180  (26 calls)

OPTIMIZATION OPPORTUNITIES:
  route-message (claude-sonnet-4-6)
    -> Switch to claude-haiku-4-5-20251001 (73% cheaper)
    -> Est. savings: $0.0840/week
```

### Model audit
```bash
npm run audit
```

Scans your full usage history and finds:
- Which models you're using and how much each costs
- Tasks using expensive models that could use cheaper ones (e.g., Sonnet for classification when Haiku works)
- High-frequency tasks that could be batched or reduced

## How to pick the right model

| Task type | Use this | Not this | Savings |
|-----------|----------|----------|---------|
| Classifying, routing, tagging, scoring | Haiku | Sonnet | 73% |
| Summarizing, extracting, parsing | Haiku or GPT-4o-mini | Sonnet/GPT-4o | 73-94% |
| Drafting, creating, strategizing | Sonnet | Opus | 80% |
| Complex reasoning, multi-step analysis | Sonnet | Opus | 80% |
| Only when you truly need the best | Opus | — | — |

The rule: start with the cheapest model. Only upgrade if quality isn't good enough.

## Budget cap

Set a monthly cap and get warned when you exceed it:

```typescript
initTracker({
  monthlyCap: 50,
  onBudgetExceeded: (spent, cap) => {
    // Send yourself a Slack/Telegram/email alert
    console.warn(`Budget exceeded: $${spent.toFixed(2)} / $${cap}`);
  },
});
```

## File structure

```
ai-cost-tracker/
  src/
    tracker.ts     — core tracking + JSON persistence
    wrapper.ts     — drop-in Anthropic client wrapper
    pricing.ts     — model pricing matrix (update when prices change)
    summary.ts     — daily summary + anomaly detection
    cli-summary.ts — run: npm run summary
    cli-audit.ts   — run: npm run audit
    index.ts       — all exports
  ai-costs/
    usage.json     — your usage log (auto-created, add to .gitignore)
```

## Add to .gitignore

```
ai-costs/
.env
```

## Want the full system?

This tracker shows you where your money goes. The full system I run automatically:
- Routes every call to the cheapest model that works
- Backs off cron frequency when there's nothing new
- Detects duplicate calls and caches them
- Sends daily cost reports to Telegram
- Has per-pipeline budget caps that block execution

If you want that built for your project: [instagram.com/cassy.garner](https://instagram.com/cassy.garner)

---

Built with Claude Code by @cassy.garner
