/**
 * nimbus local — run local server (production mode)
 */

import { spawn } from "node:child_process";
import type { CommandContext } from "@moikapy/kapy";

export const localCommand = async (ctx: CommandContext): Promise<void> => {
  const port = ctx.args.port as number;
  const store = ctx.args.store as string;

  const child = spawn("bun", ["run", "src/index.ts"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, NIMBUS_PORT: String(port), NIMBUS_STORE: store },
  });
  child.on("exit", (code) => process.exit(code || 0));
};
