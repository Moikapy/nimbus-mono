/**
 * nimbus version — show CLI version
 */

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CommandContext } from "@moikapy/kapy";

export const versionCommand = async (ctx: CommandContext): Promise<void> => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(__dirname, "..", "..", "package.json");

  try {
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    console.log(`nimbus v${pkg.version}`);
    console.log("🌩️  0xNIMBUS — Cloud-native AI agents");
    console.log("   https://github.com/Moikapy/nimbus-mono");
  } catch {
    console.log("nimbus-cli (unknown version)");
  }
};
