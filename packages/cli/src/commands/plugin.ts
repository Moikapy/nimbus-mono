/**
 * nimbus plugin — manage plugins
 */

import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { CommandContext } from "@moikapy/kapy";

interface Plugin {
  name: string;
  version: string;
  description: string;
}

// Built-in plugin registry
const BUILTIN_PLUGINS: Record<string, Plugin> = {
  "http": { name: "nimbus-http", version: "^0.2.0", description: "HTTP fetch tools with domain allowlist" },
  "data": { name: "nimbus-data", version: "^0.2.0", description: "Filter, sort, aggregate tools" },
  "stripe": { name: "nimbus-stripe", version: "^0.2.0", description: "Stripe billing integration" },
  "weather": { name: "nimbus-weather", version: "^0.2.0", description: "Weather API tools" },
};

export const pluginAddCommand = async (ctx: CommandContext): Promise<void> => {
  const name = ctx.args.name as string;
  const spinner = ctx.spinner(`Adding plugin: ${name}`);
  spinner.start();

  // Check if it's a known plugin or an npm package
  const plugin = BUILTIN_PLUGINS[name];
  const packageName = plugin?.name || name;

  try {
    // Install the package
    await new Promise((resolve, reject) => {
      const child = spawn("bun", ["add", packageName], { shell: true, stdio: "pipe" });
      let stderr = "";
      child.stderr?.on("data", (d) => (stderr += d));
      child.on("exit", (code) => (code === 0 ? resolve(null) : reject(new Error(stderr))));
    });

    spinner.succeed(`Installed ${packageName}`);

    // Update agent file to use the plugin
    ctx.log(`Add to your agent: import { ${name}Plugin } from "${packageName}";`);
    ctx.log(`Then: this.use(${name}Plugin);`);
  } catch (err) {
    spinner.fail(`Failed to install ${packageName}: ${err}`);
    ctx.abort(1);
  }
};

export const pluginListCommand = async (ctx: CommandContext): Promise<void> => {
  const json = ctx.args.json as boolean;

  if (json) {
    console.log(JSON.stringify(Object.values(BUILTIN_PLUGINS), null, 2));
    return;
  }

  console.log("📦 Built-in Nimbus Plugins\n");
  for (const [key, plugin] of Object.entries(BUILTIN_PLUGINS)) {
    console.log(`  ${key.padEnd(12)} ${plugin.description}`);
    console.log(`              npm: ${plugin.name}@${plugin.version}\n`);
  }
  console.log(`  Run: nimbus plugin add <name> to install`);
};
