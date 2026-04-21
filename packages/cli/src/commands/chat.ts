/**
 * nimbus chat — Launch interactive terminal chat UI
 */

import type { CommandContext } from "@moikapy/kapy";

export const chatCommand = async (ctx: CommandContext): Promise<void> => {
  const wsUrl =
    (ctx.args.url as string) ||
    process.env.NIMBUS_WS_URL ||
    "ws://localhost:8787/agents/demo/demo-session";

  const { launchTUI } = await import("../tui/shell.js");
  await launchTUI(wsUrl, ctx);
};
