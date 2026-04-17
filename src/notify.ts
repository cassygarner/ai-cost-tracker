/**
 * Notification helpers for budget alerts.
 *
 * These pair with `onBudgetExceeded` in initTracker():
 *
 *   initTracker({
 *     monthlyCap: 50,
 *     onBudgetExceeded: sendTelegramBudgetAlert({
 *       botToken: process.env.TELEGRAM_BOT_TOKEN!,
 *       chatId: process.env.TELEGRAM_CHAT_ID!,
 *     }),
 *   });
 */

export interface TelegramOptions {
  botToken: string;
  chatId: string;
}

export interface SlackOptions {
  webhookUrl: string;
}

export interface WebhookOptions {
  url: string;
  /** Optional headers (e.g., { Authorization: "Bearer ..." }) */
  headers?: Record<string, string>;
}

type BudgetHandler = (spent: number, cap: number) => void | Promise<void>;

// Re-alert at most once per UTC day per process so a budget-exceeded state
// doesn't spam on every subsequent call.
const lastAlertDay = new Map<string, string>();

function shouldSend(key: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (lastAlertDay.get(key) === today) return false;
  lastAlertDay.set(key, today);
  return true;
}

function defaultMessage(spent: number, cap: number): string {
  const over = ((spent - cap) / cap) * 100;
  return (
    `🚨 AI budget exceeded\n` +
    `Spent: $${spent.toFixed(2)} / Cap: $${cap.toFixed(2)} ` +
    `(${over > 0 ? "+" : ""}${over.toFixed(0)}%)`
  );
}

export async function sendTelegram(
  opts: TelegramOptions,
  text: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${opts.botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: opts.chatId, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[ai-cost-tracker] Telegram send failed: ${res.status} ${body}`);
  }
}

export async function sendSlack(opts: SlackOptions, text: string): Promise<void> {
  const res = await fetch(opts.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[ai-cost-tracker] Slack send failed: ${res.status} ${body}`);
  }
}

export async function sendWebhook(opts: WebhookOptions, payload: unknown): Promise<void> {
  const res = await fetch(opts.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[ai-cost-tracker] Webhook send failed: ${res.status} ${body}`);
  }
}

/**
 * Factory: returns an `onBudgetExceeded` handler that sends to Telegram.
 * Rate-limited to once per day to avoid spam.
 */
export function sendTelegramBudgetAlert(opts: TelegramOptions): BudgetHandler {
  return async (spent, cap) => {
    if (!shouldSend(`telegram:${opts.chatId}`)) return;
    try {
      await sendTelegram(opts, defaultMessage(spent, cap));
    } catch (err) {
      console.warn("[ai-cost-tracker] Telegram alert failed:", err);
    }
  };
}

export function sendSlackBudgetAlert(opts: SlackOptions): BudgetHandler {
  return async (spent, cap) => {
    if (!shouldSend(`slack:${opts.webhookUrl}`)) return;
    try {
      await sendSlack(opts, defaultMessage(spent, cap));
    } catch (err) {
      console.warn("[ai-cost-tracker] Slack alert failed:", err);
    }
  };
}

export function sendWebhookBudgetAlert(opts: WebhookOptions): BudgetHandler {
  return async (spent, cap) => {
    if (!shouldSend(`webhook:${opts.url}`)) return;
    try {
      await sendWebhook(opts, {
        event: "budget_exceeded",
        spent,
        cap,
        message: defaultMessage(spent, cap),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("[ai-cost-tracker] Webhook alert failed:", err);
    }
  };
}
