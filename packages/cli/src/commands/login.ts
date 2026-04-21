/**
 * nimbus login — Authenticate with Cloudflare or configure API keys
 */

import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import type { CommandContext } from "@moikapy/kapy";
import {
  loadConfig,
  saveConfig,
  loadCredentials,
  saveCredentials,
} from "../config/loader.js";

function ask(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  return new Promise((resolve) => {
    rl.question(prompt, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

export const loginCommand = async (ctx: CommandContext): Promise<void> => {
  const provider = (ctx.args.provider as string) || "cloudflare";

  if (provider === "cloudflare") {
    console.log("\n🌩️  Nimbus Cloudflare Login\n");
    console.log("You can create an API token at:");
    console.log("  https://dash.cloudflare.com/profile/api-tokens");
    console.log("Required permissions: Cloudflare Workers:Edit, Account:Read\n");

    const token = await ask("Cloudflare API Token: ");
    if (!token) {
      ctx.error("Token required");
      return;
    }

    const accountId = await ask("Cloudflare Account ID (optional): ");

    const creds = loadCredentials();
    creds.cloudflareToken = token;
    await saveCredentials(creds);

    const config = loadConfig();
    let profile = config.profiles.find((p) => p.name === "cloudflare");
    if (!profile) {
      profile = { name: "cloudflare", accountId: accountId || undefined };
      config.profiles.push(profile);
    } else if (accountId) {
      profile.accountId = accountId;
    }
    config.activeProfile = "cloudflare";
    saveConfig(config);

    console.log("\n✅ Cloudflare credentials saved.");
    console.log("   Profile: cloudflare");
    if (accountId) console.log(`   Account: ${accountId}`);
    console.log("\n   Next: nimbus chat   # connects to your Cloudflare agent");
    return;
  }

  if (provider === "openai" || provider === "anthropic" || provider === "gemini" || provider === "groq") {
    console.log(`\n🔑 ${provider.toUpperCase()} API Key Setup\n`);
    const key = await ask(`${provider.toUpperCase()} API Key: `);
    if (!key) {
      ctx.error("Key required");
      return;
    }

    const creds = loadCredentials();
    switch (provider) {
      case "openai":
        creds.openaiKey = key;
        break;
      case "anthropic":
        creds.anthropicKey = key;
        break;
      case "gemini":
        creds.geminiKey = key;
        break;
      case "groq":
        creds.groqKey = key;
        break;
    }
    await saveCredentials(creds);
    console.log(`\n✅ ${provider} API key saved.`);
    return;
  }

  if (provider === "ollama") {
    const baseUrl = await ask("Ollama base URL [http://localhost:11434/api]: ");
    const config = loadConfig();
    const profile = getActiveProfile(config);
    profile.baseUrl = baseUrl || "http://localhost:11434/api";
    saveConfig(config);
    console.log("\n✅ Ollama configured.");
    return;
  }

  ctx.error(`Unknown provider: ${provider}. Try: cloudflare, openai, anthropic, gemini, groq, ollama`);
};

function getActiveProfile(config: ReturnType<typeof loadConfig>) {
  return config.profiles.find((p) => p.name === config.activeProfile) ?? config.profiles[0];
}
