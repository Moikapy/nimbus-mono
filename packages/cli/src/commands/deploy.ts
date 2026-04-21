/**
 * nimbus deploy — deploy to Cloudflare Workers
 */

import { spawn } from "node:child_process";
import type { CommandContext } from "@moikapy/kapy";

export const deployCommand = async (ctx: CommandContext): Promise<void> => {
  const env = ctx.args.env as string;

  const spinner = ctx.spinner(`Deploying to Cloudflare (${env})...`);
  spinner.start();

  // Check wrangler is available
  try {
    await new Promise((resolve, reject) => {
      const check = spawn("npx", ["wrangler", "--version"], { shell: true, stdio: "pipe" });
      check.on("exit", (code) => code === 0 ? resolve(null) : reject(new Error("wrangler not found")));
    });
  } catch {
    spinner.fail("wrangler not found. Install with: bun add -D wrangler");
    ctx.abort(1);
  }

  // Check if logged in
  try {
    await new Promise((resolve, reject) => {
      const check = spawn("npx", ["wrangler", "whoami"], { shell: true, stdio: "pipe" });
      check.on("exit", (code) => code === 0 ? resolve(null) : reject(new Error("not logged in")));
    });
  } catch {
    spinner.fail("Not logged in. Run: npx wrangler login");
    ctx.abort(1);
  }

  spinner.succeed("Wrangler ready");

  // Deploy
  const deployArgs = ["wrangler", "deploy"];
  if (env !== "production") {
    deployArgs.push("--env", env);
  }

  ctx.log(`Running: npx ${deployArgs.join(" ")}`);
  const wrangler = spawn("npx", deployArgs, {
    stdio: "inherit",
    shell: true,
  });

  wrangler.on("exit", (code) => {
    if (code === 0) {
    ctx.log("✅ Deployed successfully!");
    } else {
      ctx.error(`Deploy failed with code ${code}`);
    }
    process.exit(code || 0);
  });
};
