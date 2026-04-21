/**
 * 0xNIMBUS — Local runtime
 *
 * Run NimbusLocal agents on Bun, Node.js, or any JS runtime.
 * Same .use(plugin) pattern, same wire protocol, same client hooks
 * as NimbusChatAgent on Cloudflare.
 *
 * Usage:
 *   import { NimbusLocal, serve, SqliteSessionStore } from "nimbus-agent/local";
 */

// Main class
export { NimbusLocal } from "./nimbus-local";
export type { LocalConfig } from "./nimbus-local";

// Session store interface and implementations
export type { SessionStore } from "./session-store";
export { SqliteSessionStore } from "./stores/sqlite";
export { FileSessionStore } from "./stores/file";

// Server
export { serve } from "./server";
export type { ServeOptions, AgentClass } from "./server";

// Wire protocol (re-export MessageType enum for client use)
export { MessageType } from "./wire-protocol";
export type {
  ClientMessage,
  ServerMessage,
  ChatRequestMessage,
  ChatResponseMessage,
  ChatMessagesMessage,
  ChatClearMessage,
  ChatRequestCancelMessage,
  StreamResumeAckMessage,
  StreamResumeRequestMessage,
  StreamResumingMessage,
  StreamResumeNoneMessage,
  ToolResultMessage,
  ToolApprovalMessage,
  MessageUpdatedMessage,
} from "./wire-protocol";