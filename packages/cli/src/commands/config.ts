/**
 * nimbus config — Manage profiles, endpoints, and settings
 */

import type { CommandContext } from "@moikapy/kapy";
import { loadConfig, saveConfig, getActiveProfile } from "../config/loader.js";

export const configCommand = async (ctx: CommandContext): Promise<void> => {
  const action = (((ctx.args.rest || []) as string[])[0]) || "show";

  if (action === "show" || action === "list") {
    const config = loadConfig();
    const profile = getActiveProfile(config);

    console.log("\n🌩️  Nimbus Configuration\n");
    console.log(`  Active Profile: ${config.activeProfile}`);
    console.log(`  Profiles: ${config.profiles.length}`);
    console.log("");
    for (const p of config.profiles) {
      const isActive = p.name === config.activeProfile ? " ●" : "";
      console.log(`  ${p.name}${isActive}`);
      if (p.baseUrl) console.log(`    baseUrl: ${p.baseUrl}`);
      if (p.agent) console.log(`    agent:   ${p.agent}`);
      if (p.accountId) console.log(`    account: ${p.accountId}`);
      if (p.model) console.log(`    model:   ${p.model}`);
    }
    console.log("");
    console.log("  Commands:");
    console.log("    nimbus config set profile <name>");
    console.log("    nimbus config set baseUrl <url>");
    console.log("    nimbus config set agent <name>");
    console.log("    nimbus config set model <ref>");
    console.log("");
    return;
  }

  if (action === "set") {
    const key = (((ctx.args.rest || []) as string[])[1]) || "";
    const value = (((ctx.args.rest || []) as string[])[2]) || "";

    if (!key || !value) {
      ctx.error("Usage: nimbus config set <key> <value>");
      return;
    }

    const config = loadConfig();
    let profile = getActiveProfile(config);

    switch (key) {
      case "profile":
        if (!config.profiles.some((p) => p.name === value)) {
          config.profiles.push({ name: value });
        }
        config.activeProfile = value;
        break;
      case "baseUrl":
        profile.baseUrl = value;
        break;
      case "agent":
        profile.agent = value;
        break;
      case "model":
        profile.model = value;
        break;
      default:
        ctx.error(`Unknown config key: ${key}`);
        return;
    }

    saveConfig(config);
    console.log(`✅ Set ${key} = ${value} (profile: ${profile.name})`);
    return;
  }

  ctx.error(`Unknown config action: ${action}. Try: show, set`);
};
