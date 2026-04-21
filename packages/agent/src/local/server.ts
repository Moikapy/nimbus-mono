/**
 * 0xNIMBUS — Local WebSocket Server
 *
 * Full-featured server speaking the same wire protocol as Cloudflare.
 * Handles: message in/out, tool calls, cancellation, multi-client broadcast.
 *
 * The CHAT_REQUEST flow:
 *   1. Parse incoming user messages from request body
 *   2. Add to agent.messages + persist
 *   3. Call streamText → get text chunks
 *   4. Forward each chunk to client as CHAT_RESPONSE
 *   5. After stream ends, build AssistantMessage + append to agent.messages
 *   6. Persist + broadcast updated messages to all clients
 */

import { streamText, convertToModelMessages } from "ai";
import { NimbusLocal } from "./nimbus-local";
import type { SessionStore } from "./session-store";
import { AbortRegistry } from "./abort-registry";
import { MessageType } from "./wire-protocol";
import type { ClientMessage, ServerMessage } from "./wire-protocol";

export type AgentClass = new (sessionId: string, store: SessionStore) => NimbusLocal;

export interface ServeOptions {
  agent: AgentClass;
  store: SessionStore;
  port?: number;
  hostname?: string;
  env?: Record<string, unknown>;
  onSessionCreate?: (sessionId: string, agent: NimbusLocal) => void | Promise<void>;
  onSessionClose?: (sessionId: string) => void | Promise<void>;
}

interface SessionState {
  agent: NimbusLocal;
  clients: Set<WebSocket>;
  abortRegistry: AbortRegistry;
  /** The ID of the most recent stream that may be resumable */
  activeStreamId?: string;
}

const sessions = new Map<string, SessionState>();

function parseUrl(url: string): { agentName: string; sessionId: string } {
  try {
    const parsed = new URL(url, "http://localhost");
    const match = parsed.pathname.match(/^\/(?:agents\/)?([^/]+)\/([^/]+)/);
    if (match) return { agentName: match[1], sessionId: match[2] };
  } catch { /* ignore */ }
  return { agentName: "default", sessionId: crypto.randomUUID() };
}

async function getOrCreateSession(
  sessionId: string,
  options: ServeOptions
): Promise<SessionState> {
  let session = sessions.get(sessionId);
  if (!session) {
    const agent = new options.agent(sessionId, options.store);
    if (options.env) agent.setEnv(options.env);
    await agent.init();
    session = {
      agent,
      abortRegistry: new AbortRegistry(),
      clients: new Set<WebSocket>(),
    };
    sessions.set(sessionId, session);
    await options.onSessionCreate?.(sessionId, agent);
  }
  return session;
}

/**
 * Parse incoming messages from the CHAT_REQUEST body.
 * Client sends messages array in the request body.
 */
function parseIncomingMessages(initBody?: string): Array<{
  id: string;
  role: string;
  content: string;
  parts?: unknown[];
}> {
  if (!initBody) return [];
  try {
    const body = JSON.parse(initBody);
    return body.messages || [];
  } catch {
    return [];
  }
}

async function handleMessage(
  data: string,
  sessionId: string,
  options: ServeOptions,
  ws: WebSocket
): Promise<void> {
  let message: ClientMessage;
  try {
    message = JSON.parse(data);
  } catch {
    return;
  }

  const session = await getOrCreateSession(sessionId, options);
  const { agent, abortRegistry, clients } = session;

  switch (message.type) {
    case MessageType.CHAT_REQUEST: {
      const controller = abortRegistry.add(message.id);

      try {
        // ── 1. Parse incoming user messages ───────────────────────────
        const incomingMessages = parseIncomingMessages(message.init.body);

        // Build full message list: historical + new incoming
        const currentMessages = [...agent.messages];
        const userUIMessages = incomingMessages
          .filter((m) => !currentMessages.some((existing) => (existing as any).id === m.id))
          .map(
            (m) =>
              ({
                id: m.id,
                role: m.role,
                content: m.content,
                parts: m.parts || [{ type: "text", text: m.content }],
              } as any)
          );

        agent.messages = [...currentMessages, ...userUIMessages];
        await agent.persistMessages(agent.messages);
        session.activeStreamId = message.id;

        // ── 2. Call LLM ────────────────────────────────────────────
        const isOverridden =
          agent.onChatMessage !== (NimbusLocal.prototype as any).onChatMessage;
        let fullText = "";

        if (isOverridden) {
          const response = await agent.onChatMessage();
          if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
              if (controller.signal.aborted) break;
              const { value, done } = await reader.read();
              if (done) break;

              const text = decoder.decode(value, { stream: true });
              let chunk = "";
              for (const line of text.split("\n")) {
                if (!line) continue;
                try {
                  const data = JSON.parse(line.trim());
                  chunk += data.text || data.content || JSON.stringify(data);
                } catch {
                  chunk += line;
                }
              }

              if (chunk) {
                fullText += chunk;
                await agent.store.saveStreamChunk(sessionId, message.id, chunk);
                ws.send(
                  JSON.stringify({
                    type: MessageType.CHAT_RESPONSE,
                    id: message.id,
                    body: chunk,
                    done: false,
                  })
                );
              }
            }
          }
        } else {
          const result = streamText({
            model: agent.resolveModel(),
            system: agent.callGetSystemInstructions(),
            messages: await convertToModelMessages(agent.messages as any),
            tools: agent.callNimbusTools(),
            abortSignal: controller.signal,
          });

          for await (const textChunk of result.textStream) {
            if (controller.signal.aborted) break;
            fullText += textChunk;
            await agent.store.saveStreamChunk(sessionId, message.id, textChunk);
            ws.send(
              JSON.stringify({
                type: MessageType.CHAT_RESPONSE,
                id: message.id,
                body: textChunk,
                done: false,
              })
            );
          }
        }

        // ── 3. Save final result & clear chunk buffer ───────────
        session.activeStreamId = undefined;
        await agent.store.deleteStreamChunks(sessionId, message.id);

        // ── 4. Build and append assistant message ────────────────────
        const assistantMessage = {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: fullText,
          parts: [{ type: "text" as const, text: fullText }],
        };

        agent.messages = [...agent.messages, assistantMessage];
        await agent.persistMessages(agent.messages);

        // ── 5. Send final done message ──────────────────────────────
        ws.send(
          JSON.stringify({
            type: MessageType.CHAT_RESPONSE,
            id: message.id,
            body: "",
            done: true,
            error: false,
          })
        );

        // ── 6. Broadcast updated messages to all clients ──────────────
        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: MessageType.CHAT_MESSAGES,
                messages: agent.messages,
              })
            );
          }
        }
      } catch (err) {
        ws.send(
          JSON.stringify({
            type: MessageType.CHAT_RESPONSE,
            id: message.id,
            body: controller.signal.aborted ? "Aborted" : String(err),
            done: true,
            error: !controller.signal.aborted,
          })
        );
      } finally {
        abortRegistry.remove(message.id);
      }
      break;
    }

    case MessageType.CHAT_REQUEST_CANCEL: {
      abortRegistry.abort(message.id, "User cancelled");
      break;
    }

    case MessageType.CHAT_MESSAGES: {
      // Client sends updated message list
      if (Array.isArray(message.messages)) {
        agent.messages = message.messages as any[];
        await agent.persistMessages(agent.messages);
        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: MessageType.CHAT_MESSAGES,
                messages: agent.messages,
              })
            );
          }
        }
      }
      break;
    }

    case MessageType.CHAT_CLEAR: {
      await agent.persistMessages([]);
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: MessageType.CHAT_CLEAR }));
        }
      }
      break;
    }

    case MessageType.TOOL_RESULT: {
      // TODO: Handle client-side tool results (continuation)
      break;
    }

    case MessageType.TOOL_APPROVAL: {
      // TODO: Handle tool approval
      break;
    }

    case MessageType.STREAM_RESUME_REQUEST: {
      const streamId = session.activeStreamId;
      if (streamId) {
        const chunks = await agent.store.loadStreamChunks(sessionId, streamId);
        if (chunks.length > 0) {
          ws.send(JSON.stringify({ type: MessageType.STREAM_RESUMING, id: streamId }));
          for (const chunk of chunks) {
            ws.send(
              JSON.stringify({
                type: MessageType.CHAT_RESPONSE,
                id: streamId,
                body: chunk,
                done: false,
                replay: true,
              })
            );
          }
          ws.send(
            JSON.stringify({
              type: MessageType.CHAT_RESPONSE,
              id: streamId,
              body: "",
              done: false,
              replayComplete: true,
            })
          );
          break;
        }
      }
      ws.send(JSON.stringify({ type: MessageType.STREAM_RESUME_NONE }));
      break;
    }

    default:
      break;
  }
}

export function serve(options: ServeOptions): void {
  const port = options.port ?? 8787;
  const hostname = options.hostname ?? "0.0.0.0";

  // Runtime check: Bun required
  let bunServe: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    bunServe = require("bun").serve;
  } catch {
    throw new Error(
      "NimbusLocal server requires Bun runtime. Install: https://bun.sh"
    );
  }

  bunServe({
    port,
    hostname,
    async fetch(request: Request, server: any) {
      const url = new URL(request.url);

      if (request.headers.get("upgrade") === "websocket") {
        const { sessionId } = parseUrl(url.pathname);
        await getOrCreateSession(sessionId, options);
        const success = server.upgrade(request, { data: { sessionId } });
        if (success) return;
        return new Response("WebSocket upgrade failed", { status: 500 });
      }

      const messagesMatch = url.pathname.match(
        /\/(?:agents\/)?([^/]+)\/([^/]+)\/get-messages$/
      );
      if (messagesMatch && request.method === "GET") {
        const sessionId = messagesMatch[2];
        const session = await getOrCreateSession(sessionId, options);
        const messages = await session.agent.store.loadMessages(sessionId);
        return new Response(JSON.stringify(messages), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/" || url.pathname === "/health") {
        return new Response(
          JSON.stringify({ status: "ok", sessions: sessions.size }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("Not Found", { status: 404 });
    },
    websocket: {
      open(ws: any) {
        const sessionId = ws.data?.sessionId as string;
        const session = sessions.get(sessionId);
        if (session) session.clients.add(ws);
      },
      close(ws: any) {
        const sessionId = ws.data?.sessionId as string;
        const session = sessions.get(sessionId);
        if (session) session.clients.delete(ws);
      },
      message(ws: any, message: string) {
        const sessionId = ws.data?.sessionId as string;
        handleMessage(message, sessionId, options, ws)
          .catch((err) => console.error("handleMessage error:", err));
      },
    },
  });
}
