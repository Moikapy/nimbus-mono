/**
 * Nimbus Chat — Terminal chat client for Nimbus agents.
 *
 * Simple, robust, zero exotic dependencies.
 */

import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import type { CommandContext } from "@moikapy/kapy";
import { loadConfig, getActiveProfile } from "../config/loader.js";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
}

let ws: WebSocket | null = null;
let messages: ChatMessage[] = [];
let currentAssistantText = "";
let streaming = false;
let currentRequestId: string | null = null;

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function printHeader() {
  console.log(`${C.cyan}${C.bold}🌩️  Nimbus Chat${C.reset}  ${C.gray}(Ctrl+C to exit)${C.reset}\n`);
}

function printPrompt() {
  process.stdout.write(`${C.green}You${C.reset} ${C.gray}›${C.reset} `);
}

function printAssistantStart() {
  process.stdout.write(`\n${C.blue}${C.bold}Nimbus${C.reset} ${C.gray}›${C.reset} `);
}

function printAssistantChunk(text: string) {
  process.stdout.write(text);
}

function printAssistantEnd() {
  console.log("\n");
}

function printError(msg: string) {
  console.log(`${C.red}Error: ${msg}${C.reset}\n`);
}

function printStatus(msg: string) {
  console.log(`${C.gray}${msg}${C.reset}`);
}

function connect(wsUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      reject(new Error(`Failed to connect: ${e}`));
      return;
    }

    ws.onopen = () => {
      printStatus("Connected to Nimbus agent");
      ws?.send(JSON.stringify({ type: "cf_agent_stream_resume_request" }));
      resolve();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      printError("WebSocket error — connection failed");
    };

    ws.onclose = () => {
      printStatus("Disconnected from agent");
      ws = null;
    };
  });
}

function handleMessage(msg: any) {
  switch (msg.type) {
    case "cf_agent_use_chat_response": {
      if (msg.error) {
        if (streaming) printAssistantEnd();
        streaming = false;
        printError(msg.body || "Agent error");
        printPrompt();
        return;
      }
      if (msg.done) {
        if (streaming) {
          streaming = false;
          printAssistantEnd();
          messages.push({ role: "assistant", content: currentAssistantText });
          currentAssistantText = "";
        }
        printPrompt();
        return;
      }
      if (msg.body != null) {
        if (!streaming) {
          streaming = true;
          currentAssistantText = "";
          printAssistantStart();
        }
        currentAssistantText += msg.body;
        printAssistantChunk(msg.body);
      }
      break;
    }

    case "cf_agent_chat_messages": {
      if (Array.isArray(msg.messages)) {
        messages = msg.messages
          .filter((m: any) => m.role === "user" || m.role === "assistant")
          .map((m: any) => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          }));
      }
      break;
    }

    case "cf_agent_stream_resuming":
      printStatus("Resuming previous stream...");
      break;

    case "cf_agent_stream_resume_none":
      break;

    default:
      break;
  }
}

function sendMessage(text: string) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    printError("Not connected");
    return;
  }

  const requestId = `req-${Date.now()}`;
  currentRequestId = requestId;

  messages.push({ role: "user", content: text });

  ws.send(
    JSON.stringify({
      type: "cf_agent_use_chat_request",
      id: requestId,
      init: {
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              id: `u-${Date.now()}`,
              role: "user",
              content: text,
              parts: [{ type: "text", text }],
            },
          ],
        }),
      },
    }),
  );
}

export const chatCommand = async (ctx: CommandContext): Promise<void> => {
  const resolvedUrl = buildChatUrl(ctx);

  printHeader();
  printStatus(`Connecting to ${resolvedUrl}...`);

  try {
    await connect(resolvedUrl);
  } catch (err) {
    printError(String(err));
    console.log("Make sure a Nimbus server is running: nimbus local");
    ctx.abort(1);
  }

  const rl = readline.createInterface({ input, output });

  printPrompt();

  rl.on("line", (line) => {
    const text = line.trim();
    if (!text) {
      printPrompt();
      return;
    }

    if (text === "/quit" || text === "/exit") {
      rl.close();
      ws?.close();
      process.exit(0);
    }

    if (text === "/clear") {
      console.clear();
      messages = [];
      printHeader();
      ws?.send(JSON.stringify({ type: "cf_agent_chat_clear" }));
      printPrompt();
      return;
    }

    if (text === "/help") {
      console.log(`${C.cyan}Commands:${C.reset}`);
      console.log("  /clear  - Clear chat history");
      console.log("  /help   - Show this help");
      console.log("  /quit   - Exit\n");
      printPrompt();
      return;
    }

    sendMessage(text);
  });

  rl.on("close", () => {
    ws?.close();
    console.log(`\n${C.gray}Goodbye! 👋${C.reset}`);
    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
};

function buildChatUrl(ctx: CommandContext): string {
  if (ctx.args.url) return ctx.args.url as string;

  const profile = getActiveProfile();

  const base =
    (ctx.args.base as string) ||
    process.env.NIMBUS_WS_URL ||
    profile.baseUrl ||
    "ws://localhost:8787";

  const agent =
    (ctx.args.agent as string) ||
    process.env.NIMBUS_AGENT ||
    profile.agent ||
    "demo";

  const session =
    (ctx.args.session as string) ||
    process.env.NIMBUS_SESSION ||
    "demo-session";

  // If base already includes a full path, return it as-is
  if (base.includes("/agents/")) return base;

  return `${base.replace(/\/$/, "")}/agents/${agent}/${session.replace(/^\//, "")}`;
}
