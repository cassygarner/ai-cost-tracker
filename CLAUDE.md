# CLAUDE.md — AI Cost Tracker

Context for Claude Code sessions installing this tracker into a user's project.

## What this tool is

A drop-in TypeScript package that logs every LLM API call (model, tokens, label, cost) to a local JSON file, then gives the user summaries, audits, and optional AI-generated reviews. No database, no signup, no third-party service.

## Who this tool fits

- TypeScript / JavaScript / Node.js projects calling the Anthropic, OpenAI, Google, or DeepSeek APIs directly.
- Projects running on a machine that can execute `npm install` and `tsx` (local dev, VPS, Docker).

## Who this tool does NOT fit

- Users on Claude.ai, ChatGPT, or Claude Code subscription plans (this tracks API calls, not seat usage).
- No-code tools (Zapier, Make, n8n) where the user never writes code — they can't drop in TS files.
- Python-only projects — the tracker itself is TS; a parallel Python implementation would be needed (not provided).

If the user's project doesn't fit, **say so explicitly** before installing. Don't pretend it works.

## Installing into the user's project

The user will have their own repo open. You're adding this tracker as source files.

### Step 1 — Copy source files

Copy the contents of `src/` from this repo into their project at a location that matches their existing structure:
- If they have `src/lib/` → `src/lib/ai-cost-tracker/`
- If they have `src/utils/` → `src/utils/ai-cost-tracker/`
- Otherwise → `src/ai-cost-tracker/`

Files to copy:
- `tracker.ts` — core logging + persistence
- `wrapper.ts` — optional Anthropic SDK wrapper
- `pricing.ts` — model price matrix
- `summary.ts` + `review.ts` + `ai-review.ts` — report generators
- `notify.ts` — Telegram/Slack/webhook budget-alert helpers
- `cli-summary.ts`, `cli-audit.ts`, `cli-review.ts`, `cli-ai-review.ts` — CLI entrypoints
- `load-env.ts` — loads .env using Node's built-in loader
- `index.ts` — all exports

### Step 2 — Add dependencies

Add `@anthropic-ai/sdk` to their `dependencies` and `tsx` to `devDependencies`. If they're on older Node, also add `dotenv` and wire it into `load-env.ts` (Node < 20.12 doesn't have `process.loadEnvFile`).

### Step 3 — Initialize at main entry point

Find their main entry (usually `src/index.ts`, `server.ts`, `app.ts`, or the first file that imports env vars) and add near the top:

```typescript
import { initTracker } from "./ai-cost-tracker/index.js"; // adjust path

initTracker({
  monthlyCap: 50, // user's budget in USD
});
```

### Step 4 — Wrap their AI calls

Find every file that calls an LLM provider. Patterns to search:
- `new Anthropic(` / `anthropic.messages.create` / `@anthropic-ai/sdk`
- `new OpenAI(` / `openai.chat.completions.create` / `openai.responses.create`
- `new GoogleGenerativeAI` / `@google/generative-ai`
- `generateText(` / `streamText(` from the AI SDK

For **Anthropic users**: replace `new Anthropic({ apiKey })` with `createTrackedClient({ apiKey })` and use `.ask(prompt, { label, model })` — every call is logged automatically.

For **any other provider**: after the call completes, add:
```typescript
trackUsage({
  label: "short-descriptive-name",      // e.g. "classify-email"
  model: "gpt-4o-mini",                 // exact model id
  provider: "openai",
  inputTokens: response.usage.prompt_tokens,
  outputTokens: response.usage.completion_tokens,
});
```

### Step 5 — Label quality matters more than coverage

Labels are how the user finds waste later. Before writing a label:
- Read the function name, the surrounding context, and the prompt
- Pick a label describing the *task*, not the *location* (`classify-email` ✓, `api-route-handler` ✗)
- Reuse labels across files that do the same thing so spend aggregates correctly

### Step 6 — Add to .gitignore

Append to their `.gitignore`:
```
ai-costs/
.env
```

### Step 7 — Add npm scripts

In their `package.json`:
```json
"scripts": {
  "ai:summary": "tsx src/ai-cost-tracker/cli-summary.ts",
  "ai:audit": "tsx src/ai-cost-tracker/cli-audit.ts",
  "ai:review": "tsx src/ai-cost-tracker/cli-review.ts",
  "ai:ai-review": "tsx src/ai-cost-tracker/cli-ai-review.ts"
}
```

Adjust the path to match where you copied the files.

### Step 8 — Verify

Run `npx tsc --noEmit` to confirm types are clean. Then run `npm run ai:summary` — it should print "First day of tracking" with zero calls. Tell the user exactly what you verified and what commands they can run.

## Budget alerts (Prompt 5 from the freebie)

Use the helpers in `notify.ts`:

```typescript
import { initTracker, sendTelegramBudgetAlert } from "./ai-cost-tracker/index.js";

initTracker({
  monthlyCap: 50,
  onBudgetExceeded: sendTelegramBudgetAlert({
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    chatId: process.env.TELEGRAM_CHAT_ID!,
  }),
});
```

Swap to `sendSlackBudgetAlert({ webhookUrl })` or `sendWebhookBudgetAlert({ url, headers })` depending on what the user wants. All three are rate-limited to once per UTC day per destination.

## Cron setup (Prompt 7 from the freebie)

Cross-platform guidance:
- **macOS / Linux with crontab**: `crontab -e`, add `0 9 * * * cd /path/to/project && /usr/local/bin/npm run ai:review weekly`
- **macOS with launchd**: create a `.plist` in `~/Library/LaunchAgents/`
- **Linux with systemd**: create a `.timer` + `.service` unit
- **Windows**: Task Scheduler

Ask the user which they prefer. Don't assume.

## Anthropic prompt caching

The wrapper captures `cache_read_input_tokens` and `cache_creation_input_tokens` from the SDK response. Costs are calculated with the real cache multipliers (reads: 10% of input, writes: 125%). If the user isn't using caching yet, the fields default to 0 and nothing changes.

## Things to avoid

- Don't add a database. This tool is intentionally file-based so it drops into any project without infra.
- Don't add a web UI inside this repo. That's the Skool upsell.
- Don't invent model prices — update `pricing.ts` from the provider's pricing page.
- Don't silently change an existing `MODEL_PRICING` entry. Prices are provider-verified values.
