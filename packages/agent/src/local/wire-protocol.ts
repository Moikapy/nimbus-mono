/**
 * 0xNIMBUS — Wire Protocol Types
 *
 * These types define the WebSocket message protocol between client and server.
 * They are identical to the Cloudflare Agents SDK wire protocol, ensuring
 * that `useAgentChat` works unchanged against local or Cloudflare backends.
 *
 * Every message is JSON with a `type` field matching the MessageType enum.
 * This is the contract between the React client and the agent server.
 *
 * Reference: @cloudflare/ai-chat/types (MessageEvent types)
 */

// ─── Message Types ───────────────────────────────────────────────────────────

/**
 * Enum for wire protocol message types.
 * Compatible with @cloudflare/ai-chat MessageType.
 */
export enum MessageType {
  // Client → Server
  /** Client sends a chat request */
  CHAT_REQUEST = "cf_agent_use_chat_request",
  /** Client sends updated message list */
  CHAT_MESSAGES = "cf_agent_chat_messages",
  /** Client clears chat history */
  CHAT_CLEAR = "cf_agent_chat_clear",
  /** Client cancels an in-progress request */
  CHAT_REQUEST_CANCEL = "cf_agent_chat_request_cancel",
  /** Client acknowledges stream resumption */
  STREAM_RESUME_ACK = "cf_agent_stream_resume_ack",
  /** Client requests stream resume check */
  STREAM_RESUME_REQUEST = "cf_agent_stream_resume_request",
  /** Client sends tool result for client-side tool execution */
  TOOL_RESULT = "cf_agent_tool_result",
  /** Client sends tool approval/denial */
  TOOL_APPROVAL = "cf_agent_tool_approval",

  // Server → Client
  /** Server sends chat response chunk */
  CHAT_RESPONSE = "cf_agent_use_chat_response",
  /** Server sends updated messages (after persist) */
  // CHAT_MESSAGES is bidirectional
  // CHAT_CLEAR is bidirectional
  /** Server notifies client that active stream is resuming */
  STREAM_RESUMING = "cf_agent_stream_resuming",
  /** Server responds that no active stream exists for resume */
  STREAM_RESUME_NONE = "cf_agent_stream_resume_none",
  /** Server notifies client that a message was updated */
  MESSAGE_UPDATED = "cf_agent_message_updated",
}

// ─── Client → Server Messages ────────────────────────────────────────────────

/** Client sends a chat request to the agent */
export interface ChatRequestMessage {
  type: MessageType.CHAT_REQUEST;
  /** Unique ID for this request */
  id: string;
  /** Request init options (method, headers, body) */
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
}

/** Client sends updated message list */
export interface ChatMessagesMessage {
  type: MessageType.CHAT_MESSAGES;
  messages: unknown[];
}

/** Client clears chat history */
export interface ChatClearMessage {
  type: MessageType.CHAT_CLEAR;
}

/** Client cancels an in-progress request */
export interface ChatRequestCancelMessage {
  type: MessageType.CHAT_REQUEST_CANCEL;
  id: string;
}

/** Client acknowledges stream resumption */
export interface StreamResumeAckMessage {
  type: MessageType.STREAM_RESUME_ACK;
  id: string;
}

/** Client requests stream resume check */
export interface StreamResumeRequestMessage {
  type: MessageType.STREAM_RESUME_REQUEST;
}

/** Client sends tool result */
export interface ToolResultMessage {
  type: MessageType.TOOL_RESULT;
  toolCallId: string;
  toolName: string;
  output: unknown;
  /** Override tool part state */
  state?: "output-available" | "output-error";
  errorText?: string;
  /** Whether server should auto-continue after applying result */
  autoContinue?: boolean;
}

/** Client sends tool approval */
export interface ToolApprovalMessage {
  type: MessageType.TOOL_APPROVAL;
  toolCallId: string;
  approved: boolean;
  autoContinue?: boolean;
}

/** Union type for all client → server messages */
export type ClientMessage =
  | ChatRequestMessage
  | ChatMessagesMessage
  | ChatClearMessage
  | ChatRequestCancelMessage
  | StreamResumeAckMessage
  | StreamResumeRequestMessage
  | ToolResultMessage
  | ToolApprovalMessage;

// ─── Server → Client Messages ─────────────────────────────────────────────────

/** Server sends chat response chunk */
export interface ChatResponseMessage {
  type: MessageType.CHAT_RESPONSE;
  /** Request ID this response corresponds to */
  id: string;
  /** Response body (stream chunk) */
  body: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Whether this response contains an error */
  error?: boolean;
  /** Whether this is a continuation of a previous assistant message */
  continuation?: boolean;
  /** Whether this chunk is being replayed from storage */
  replay?: boolean;
  /** Signals that replay is complete (stream is still active) */
  replayComplete?: boolean;
}

/** Server sends updated messages */
export interface ServerChatMessagesMessage {
  type: MessageType.CHAT_MESSAGES;
  messages: unknown[];
}

/** Server clears chat history */
export interface ServerChatClearMessage {
  type: MessageType.CHAT_CLEAR;
}

/** Server notifies client that active stream is resuming */
export interface StreamResumingMessage {
  type: MessageType.STREAM_RESUMING;
  id: string;
}

/** Server responds that no active stream exists for resume */
export interface StreamResumeNoneMessage {
  type: MessageType.STREAM_RESUME_NONE;
}

/** Server notifies client that a message was updated */
export interface MessageUpdatedMessage {
  type: MessageType.MESSAGE_UPDATED;
  message: unknown;
}

/** Union type for all server → client messages */
export type ServerMessage =
  | ChatResponseMessage
  | ServerChatMessagesMessage
  | ServerChatClearMessage
  | StreamResumingMessage
  | StreamResumeNoneMessage
  | MessageUpdatedMessage;