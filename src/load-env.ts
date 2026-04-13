/**
 * Auto-loads a local `.env` file so users who follow the README
 * ("add your key to .env") don't hit undefined process.env values.
 *
 * Uses Node's built-in `process.loadEnvFile` (Node >= 20.12). No dependency.
 * Silent no-op if the file doesn't exist or the runtime is older.
 */
import { existsSync } from "node:fs";

const envPath = process.env.AI_COST_TRACKER_ENV || ".env";

if (existsSync(envPath) && typeof (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile === "function") {
  try {
    (process as unknown as { loadEnvFile: (p: string) => void }).loadEnvFile(envPath);
  } catch {
    // Ignore parse errors — users can still set env vars in their shell
  }
}
