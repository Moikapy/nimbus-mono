#!/usr/bin/env bun
/**
 * Nimbus CLI
 *
 *   nimbus init <name>      Scaffold a new agent project
 *   nimbus dev               Run local dev server
 *   nimbus local             Run local server (production mode)
 *   nimbus login             Authenticate with Cloudflare / set API keys
 *   nimbus config            Manage profiles and endpoints
 *   nimbus deploy            Deploy to Cloudflare Workers
 *   nimbus plugin add <name>  Add a plugin from registry
 *   nimbus plugin list        List installed plugins
 *   nimbus model list        List available AI models
 *   nimbus model use <name>  Set default model
 *   nimbus chat              Launch interactive terminal chat
 *   nimbus logs              Tail Cloudflare logs
 *   nimbus --version         Show version
 *
 * Built on @moikapy/kapy CLI framework.
 */

import { kapy } from "@moikapy/kapy";
import { initCommand } from "./commands/init.js";
import { devCommand } from "./commands/dev.js";
import { localCommand } from "./commands/local.js";
import { deployCommand } from "./commands/deploy.js";
import { pluginAddCommand, pluginListCommand } from "./commands/plugin.js";
import { modelListCommand, modelUseCommand } from "./commands/model.js";
import { logsCommand } from "./commands/logs.js";
import { loginCommand } from "./commands/login.js";
import { configCommand } from "./commands/config.js";
import { versionCommand } from "./commands/version.js";
import { chatCommand } from "./commands/chat.js";

const cli = kapy();

cli
  // Project scaffolding
  .command("init", {
    description: "Scaffold a new Nimbus agent project",
    args: [
      { name: "name", required: true, description: "Project name" },
      { name: "template", default: false, description: "Include Cloudflare deploy template" },
    ],
    flags: {
      template: { type: "boolean", alias: "t", description: "Include Cloudflare deploy template", default: false },
    },
  }, initCommand)

  // Development
  .command("dev", {
    description: "Run local development server with hot reload",
  }, devCommand)

  .command("local", {
    description: "Run local server (production build)",
    flags: {
      port: { type: "number", alias: "p", description: "Server port", default: 8787 },
      store: { type: "string", alias: "s", description: "Session store: sqlite | file", default: "sqlite" },
    },
  }, localCommand)

  // Deployment
  .command("deploy", {
    description: "Deploy to Cloudflare Workers",
    flags: {
      env: { type: "string", alias: "e", description: "Environment", default: "production" },
    },
  }, deployCommand)

  // Plugins
  .command("plugin-add", {
    description: "Add a plugin from the Nimbus registry",
    args: [
      { name: "name", required: true, description: "Plugin name or npm package" },
    ],
  }, pluginAddCommand)

  .command("plugin-list", {
    description: "List installed plugins",
    flags: {
      json: { type: "boolean", alias: "j", description: "Output as JSON", default: false },
    },
  }, pluginListCommand)

  // Models
  .command("model-list", {
    description: "List available AI models",
    flags: {
      json: { type: "boolean", alias: "j", description: "Output as JSON", default: false },
      provider: { type: "string", alias: "p", description: "Filter by provider" },
    },
  }, modelListCommand)

  .command("model-use", {
    description: "Set the default model for this project",
    args: [
      { name: "name", required: true, description: "Model reference (e.g. @cf/meta/llama-3.3-70b-instruct-fp8-fast)" },
    ],
  }, modelUseCommand)

  // Logs
  .command("logs", {
    description: "Tail Cloudflare Workers logs",
    flags: {
      follow: { type: "boolean", alias: "f", description: "Follow log output", default: true },
    },
  }, logsCommand)

  // Auth & Config
  .command("login", {
    description: "Authenticate with Cloudflare or set API keys",
    flags: {
      provider: { type: "string", alias: "p", description: "Provider: cloudflare | openai | anthropic | gemini | groq | ollama", default: "cloudflare" },
    },
  }, loginCommand)

  .command("config", {
    description: "Manage profiles, endpoints, and settings",
    args: [
      { name: "action", default: "show", description: "show | set" },
      { name: "key", default: "", description: "Config key to set" },
      { name: "value", default: "", description: "Value to set" },
    ],
  }, configCommand)

  // Chat
  .command("chat", {
    description: "Launch interactive terminal chat UI",
    flags: {
      url: { type: "string", alias: "u", description: "Full WebSocket URL (use --url=ws://...)" },
      base: { type: "string", alias: "b", description: "Base URL (use --base=ws://...)" },
      agent: { type: "string", alias: "a", description: "Agent name (use --agent=demo)" },
      session: { type: "string", alias: "s", description: "Session ID (use --session=demo-session)" },
      profile: { type: "string", alias: "P", description: "Use a saved profile (use --profile=local)" },
    },
  }, chatCommand)

  // Version
  .command("version", {
    description: "Show Nimbus CLI version",
  }, versionCommand);

cli.run().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
