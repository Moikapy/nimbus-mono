/**
 * nimbus dev — run local dev server with hot reload
 */

import { spawn } from "node:child_process";
import type { CommandContext } from "@moikapy/kapy";

export const devCommand = async (ctx: CommandContext): Promise<void> => {
  const spinner = ctx.spinner("Starting Nimbus dev server...");
  spinner.start();

  // Check if running in a Cloudflare project (has wrangler.jsonc)
  const fs = await import("node:fs");
  const hasWrangler = fs.existsSync("wrangler.jsonc") || fs.existsSync("wrangler.toml");

  if (hasWrangler) {
    spinner.succeed("Wrangler project detected");
  ctx.log(`Starting Nimbus dev server...`);
    const wrangler = spawn("npx", ["wrangler", "dev"], {
      stdio: "inherit",
      shell: true,
    });
    wrangler.on("exit", (code) => process.exit(code || 0));
    return;
  }

  // Local Bun dev
  spinner.succeed("Local project detected");
  const child = spawn("bun", ["run", "--watch", "src/index.ts"], {
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code) => process.exit(code || 0));
};
