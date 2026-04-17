# AI Cost Tracker

Track every AI API call, see exactly where your money goes, and catch cost spikes before they hurt.

Built by [@cassy.garner](https://instagram.com/cassy.garner) — this is the same system I use to manage 37 automated cron jobs and 12 AI agents. It took my AI spend from **~$300/month down to ~$50/month** without cutting any features. Same agents, same automations, 83% less spend.

## Who this is for

- Developers with a **TypeScript / JavaScript / Node.js** project that calls the Anthropic, OpenAI, Google, or DeepSeek API directly.
- Anyone who can run `npm install` in their project.

## Who this is NOT for

- Claude.ai, ChatGPT, or Claude Code subscription users — this tracks **API** spend, not seat/subscription usage.
- No-code users (Zapier, Make, n8n) — there's no code surface to drop the tracker into.
- Python-only projects — the tracker is TS; you'd need a parallel Python port (not included).

If this isn't you, the rest of the guide won't fit. No shame, just pick a tool that matches your stack.

## What it does

- Logs every LLM call with model, tokens, cost, and a label you choose
- Stores everything in a local JSON file (no database needed)
- Captures Anthropic prompt-cache tokens automatically (accurate costs, even with caching)
- Generates daily summaries with anomaly detection (flags 2x+ spend spikes)
- Audits your usage and tells you which tasks could use cheaper models
- Optional monthly budget cap with built-in Telegram, Slack, and webhook alert helpers

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
    -> Switch to claude-haiku-4-5-20251001 (67% cheaper)
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
| Classifying, routing, tagging, scoring | Haiku | Sonnet | 67% |
| Summarizing, extracting, parsing | Haiku or GPT-4o-mini | Sonnet/GPT-4o | 67-94% |
| Drafting, creating, strategizing | Sonnet | Opus | 80% |
| Complex reasoning, multi-step analysis | Sonnet | Opus | 80% |
| Only when you truly need the best | Opus | — | — |

The rule: start with the cheapest model. Only upgrade if quality isn't good enough.

## Budget cap + alerts

Set a monthly cap and route alerts to Telegram, Slack, or any webhook. Helpers ship in the box — no integrations to build.

```typescript
import { initTracker, sendTelegramBudgetAlert } from "./src/index.js";

initTracker({
  monthlyCap: 50,
  onBudgetExceeded: sendTelegramBudgetAlert({
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    chatId: process.env.TELEGRAM_CHAT_ID!,
  }),
});
```

Also available: `sendSlackBudgetAlert({ webhookUrl })`, `sendWebhookBudgetAlert({ url, headers })`, and `sendEmailBudgetAlert({ apiKey, from, to })` (uses [Resend](https://resend.com) — grab a free key and verify a sender domain). All four are rate-limited to once per UTC day so a budget breach doesn't spam you on every call after.

Prefer your own handler? Pass any function:
```typescript
onBudgetExceeded: (spent, cap) => {
  // your own alert logic
}
```

## File structure

```
ai-cost-tracker/
  src/
    tracker.ts     — core tracking + JSON persistence
    wrapper.ts     — drop-in Anthropic client wrapper (captures cache tokens)
    pricing.ts     — model pricing matrix + cache multipliers
    summary.ts     — daily summary + anomaly detection
    review.ts      — period comparisons (daily/weekly/monthly)
    ai-review.ts   — Haiku-powered contextual review
    notify.ts      — Telegram/Slack/webhook/email budget alert helpers
    cli-*.ts       — run via: npm run summary | audit | review | ai-review
    index.ts       — all exports
  CLAUDE.md        — context for Claude Code sessions installing this
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
