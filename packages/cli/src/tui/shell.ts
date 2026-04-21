/**
 * Nimbus TUI Shell
 */
import type { CommandContext } from "@moikapy/kapy";

export async function launchTUI(wsUrl: string, ctx?: CommandContext) {
  if (ctx?.noInput || ctx?.json) {
    ctx?.error("TUI requires interactive terminal");
    return;
  }
  if (!process.stdout.isTTY) {
    console.error("TUI requires TTY");
    process.exit(1);
  }
  const { launchNimbusTUI } = await import("./app.js");
  await launchNimbusTUI(wsUrl);
}
