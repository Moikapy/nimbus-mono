/**
 * nimbus model — list and manage AI models
 */

import { spawn } from "node:child_process";
import type { CommandContext } from "@moikapy/kapy";

interface Model {
  id: string;
  provider: string;
  description: string;
  context: string;
}

const MODELS: Model[] = [
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", provider: "workers-ai", description: "Meta Llama 3.3 70B", context: "128K" },
  { id: "@cf/mistral/mistral-7b-instruct-v0.1", provider: "workers-ai", description: "Mistral 7B", context: "32K" },
  { id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", provider: "workers-ai", description: "DeepSeek R1 Qwen 32B", context: "128K" },
  { id: "llama3.2:latest", provider: "ollama", description: "Llama 3.2 (local)", context: "128K" },
  { id: "kimi-k2.6:cloud", provider: "ollama", description: "Kimi K2.6 (local)", context: "256K" },
  { id: "openai/gpt-4o", provider: "openai", description: "GPT-4o", context: "128K" },
  { id: "anthropic/claude-4-sonnet", provider: "anthropic", description: "Claude 4 Sonnet", context: "200K" },
];

export const modelListCommand = async (ctx: CommandContext): Promise<void> => {
  const json = ctx.args.json as boolean;
  const provider = ctx.args.provider as string | undefined;

  let models = MODELS;
  if (provider) {
    models = models.filter((m) => m.provider === provider);
  }

  if (json) {
    console.log(JSON.stringify(models, null, 2));
    return;
  }

  console.log("🤖 Available Models\n");
  console.log(`  ${"ID".padEnd(45)} ${"Provider".padEnd(12)} ${"Context".padEnd(8)} Description`);
  console.log("  " + "-".repeat(100));
  for (const model of models) {
    console.log(`  ${model.id.padEnd(45)} ${model.provider.padEnd(12)} ${model.context.padEnd(8)} ${model.description}`);
  }
  console.log(`\n  Use: nimbus model use <id> to set default`);
};

export const modelUseCommand = async (ctx: CommandContext): Promise<void> => {
  const name = ctx.args.name as string;
  const spinner = ctx.spinner(`Setting default model: ${name}`);
  spinner.start();

  // Validate model exists
  const model = MODELS.find((m) => m.id === name);
  if (!model) {
    ctx.warn(`Unknown model: ${name}. Will still set.`);
    spinner.succeed(`Set default: ${name}`);
  } else {
    spinner.succeed(`Default model set: ${name} (${model.description})`);
  }

  // Update env or config
  const fs = await import("node:fs/promises");
  try {
    await fs.writeFile(".nimbus-model", name + "\n");
    ctx.log("Written to .nimbus-model");
  } catch {
    ctx.warn("Could not write .nimbus-model");
  }
};
