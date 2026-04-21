/**
 * nimbus logs — tail Cloudflare Workers logs
 */

import { spawn } from "node:child_process";
import type { CommandContext } from "@moikapy/kapy";

export const logsCommand = async (ctx: CommandContext): Promise<void> => {
  const follow = ctx.args.follow as boolean;

  ctx.log("Tailing Cloudflare Workers logs...");
  const args = ["wrangler", "tail"];
  if (!follow) args.push("--once");

  const wrangler = spawn("npx", args, {
    stdio: "inherit",
    shell: true,
  });
  wrangler.on("exit", (code) => process.exit(code || 0));
};
