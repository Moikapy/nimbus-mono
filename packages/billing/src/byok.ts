/**
 * 0xNIMBUS — Bring Your Own Key (BYOK)
 *
 * Lets users supply their own OpenAI, Anthropic, Google, Groq, etc.
 * API keys. When present, routes AI calls to their provider instead of
 * Workers AI — saving us compute cost while giving them premium models.
 */

import type { D1Database } from "@cloudflare/workers-types";

/** Supported external providers */
export type ProviderKeyName =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "deepseek";

export interface ProviderKeyRow {
  provider: ProviderKeyName;
  /** API key — encrypted at rest (AES-256-GCM via Cloudflare Secrets) */
  key_encrypted: string;
  /** Optional: model preference for this provider */
  default_model?: string;
  created_at: string;
}

/**
 * Store a provider key for a user.
 * In production, encrypt with env.ENCRYPTION_KEY before storing.
 * For MVP, store directly (user already trusts us with Stripe + Clerk).
 */
export async function setProviderKey(
  userId: string,
  provider: ProviderKeyName,
  apiKey: string,
  db: D1Database,
): Promise<void> {
  // Upsert: update if exists, insert if not
  await db
    .prepare(
      `INSERT INTO provider_keys (user_id, provider, key_encrypted, created_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, provider) DO UPDATE SET
         key_encrypted = excluded.key_encrypted,
         updated_at = datetime('now')`,
    )
    .bind(userId, provider, apiKey)
    .run();
}

/**
 * Retrieve a provider key for a user.
 * Returns null if not set.
 */
export async function getProviderKey(
  userId: string,
  provider: ProviderKeyName,
  db: D1Database,
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT key_encrypted FROM provider_keys
       WHERE user_id = ? AND provider = ?`,
    )
    .bind(userId, provider)
    .first<{ key_encrypted: string }>();

  return row?.key_encrypted ?? null;
}

/**
 * List all provider keys for a user.
 * Returns provider names only (not the keys themselves).
 */
export async function listProviderKeys(
  userId: string,
  db: D1Database,
): Promise<ProviderKeyName[]> {
  const { results } = await db
    .prepare(`SELECT provider FROM provider_keys WHERE user_id = ?`)
    .bind(userId)
    .all<{ provider: ProviderKeyName }>();

  return results?.map((r) => r.provider) ?? [];
}

/**
 * Delete a provider key for a user.
 */
export async function deleteProviderKey(
  userId: string,
  provider: ProviderKeyName,
  db: D1Database,
): Promise<void> {
  await db
    .prepare(`DELETE FROM provider_keys WHERE user_id = ? AND provider = ?`)
    .bind(userId, provider)
    .run();
}

/**
 * Get the best available AI config for a user.
 * Priority: user BYOK > Workers AI default
 *
 * Returns the provider + key + model string, or null for Workers AI fallback.
 */
export async function resolveUserAIConfig(
  userId: string,
  tier: string,
  requestedModel: string,
  db: D1Database,
): Promise<
  | {
      provider: "workers_ai";
      modelRef: string;
      apiKey?: string;
    }
  | {
      provider: ProviderKeyName;
      modelRef: string;
      apiKey: string;
    }
> {
  // Map requested model to provider
  const provider = modelToProvider(requestedModel);

  // Check if user has BYOK for this provider
  if (provider !== "workers_ai") {
    const key = await getProviderKey(userId, provider, db);
    if (key) {
      return { provider, modelRef: requestedModel, apiKey: key };
    }
  }

  // Fall back to Workers AI
  return { provider: "workers_ai", modelRef: requestedModel };
}

/** Map model ID to provider */
function modelToProvider(model: string): ProviderKeyName | "workers_ai" {
  if (model.startsWith("@cf/")) return "workers_ai";
  if (model.startsWith("gpt-")) return "openai";
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gemini-")) return "google";
  if (model.startsWith("llama-")) return "groq";
  if (model.startsWith("deepseek-")) return "deepseek";
  return "workers_ai";
}
