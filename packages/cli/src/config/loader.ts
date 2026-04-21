import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { chmod } from "node:fs/promises";
import { NIMBUS_DIR, CONFIG_PATH, CREDS_PATH } from "./paths.js";
import type { NimbusConfig, NimbusCredentials } from "./types.js";

export function ensureNimbusDir(): void {
  if (!existsSync(NIMBUS_DIR)) {
    mkdirSync(NIMBUS_DIR, { recursive: true, mode: 0o700 });
  }
}

export function loadConfig(): NimbusConfig {
  ensureNimbusDir();
  if (!existsSync(CONFIG_PATH)) {
    const defaultConfig: NimbusConfig = {
      version: 1,
      activeProfile: "local",
      profiles: [
        { name: "local", baseUrl: "ws://localhost:8787", agent: "demo" },
      ],
    };
    saveConfig(defaultConfig);
    return defaultConfig;
  }
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as NimbusConfig;
}

export function saveConfig(config: NimbusConfig): void {
  ensureNimbusDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getActiveProfile(config?: NimbusConfig): NimbusConfig["profiles"][number] {
  const c = config ?? loadConfig();
  return c.profiles.find((p) => p.name === c.activeProfile) ?? c.profiles[0];
}

export function loadCredentials(): NimbusCredentials {
  ensureNimbusDir();
  if (!existsSync(CREDS_PATH)) return {};
  const raw = readFileSync(CREDS_PATH, "utf-8");
  return JSON.parse(raw) as NimbusCredentials;
}

export async function saveCredentials(creds: NimbusCredentials): Promise<void> {
  ensureNimbusDir();
  writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
  await chmod(CREDS_PATH, 0o600);
}
