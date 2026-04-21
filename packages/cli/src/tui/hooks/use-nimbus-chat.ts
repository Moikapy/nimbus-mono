/**
 * Nimbus Chat Hook — WebSocket client for Nimbus agents.
 */

import { createSignal } from "solid-js";
import type { Msg } from "../types.js";

function genId(p: string): string {
  return `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createNimbusChat(wsUrl: string) {
  let ws: WebSocket | null = null;
  let reconnects = 0;

  const [msgs, setMsgs] = createSignal<Msg[]>([]);
  const [streaming, setStreaming] = createSignal(false);
  const [err, setErr] = createSignal("");
  const [connected, setConnected] = createSignal(false);

  let reqId: string | null = null;
  let asstId: string | null = null;
  let buf = "";

  function connect() {
    if (ws?.readyState === WebSocket.OPEN) return;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      setErr(`Failed: ${e}`);
      return;
    }
    ws.onopen = () => {
      setConnected(true);
      setErr("");
      reconnects = 0;
      ws?.send(JSON.stringify({ type: "cf_agent_stream_resume_request" }));
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        switch (data.type) {
          case "cf_agent_use_chat_response": {
            if (data.done) {
              setStreaming(false);
              if (asstId) {
                setMsgs((prev) => prev.map((m) => (m.id === asstId ? { ...m, content: buf || m.content } : m)));
              }
              reqId = null;
              asstId = null;
              buf = "";
              return;
            }
            if (data.error) {
              setStreaming(false);
              setErr(data.body || "agent error");
              return;
            }
            if (data.body != null) {
              buf += data.body;
              if (asstId) {
                setMsgs((prev) => prev.map((m) => (m.id === asstId ? { ...m, content: buf } : m)));
              }
            }
            break;
          }
          case "cf_agent_chat_messages": {
            if (Array.isArray(data.messages)) {
              setMsgs(
                data.messages
                  .filter((m: any) => m.role === "user" || m.role === "assistant")
                  .map((m: any) => ({
                    id: m.id || genId("msg"),
                    role: m.role,
                    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
                  })),
              );
            }
            break;
          }
        }
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => setErr("WebSocket error");
    ws.onclose = () => {
      setConnected(false);
      if (reconnects < 3) {
        reconnects++;
        setTimeout(connect, 1000 * reconnects);
      }
    };
  }

  function disconnect() {
    ws?.close();
    ws = null;
  }

  function send(text: string) {
    if (!text.trim() || streaming()) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setErr("Not connected");
      return;
    }
    reqId = genId("req");
    buf = "";
    const userMsg: Msg = { id: genId("u"), role: "user", content: text.trim() };
    asstId = genId("a");
    const asstMsg: Msg = { id: asstId, role: "assistant", content: "" };
    setMsgs((prev) => [...prev, userMsg, asstMsg]);
    setStreaming(true);
    setErr("");
    ws.send(
      JSON.stringify({
        type: "cf_agent_use_chat_request",
        id: reqId,
        init: {
          body: JSON.stringify({
            messages: [
              {
                id: userMsg.id,
                role: "user",
                content: userMsg.content,
                parts: [{ type: "text", text: userMsg.content }],
              },
            ],
          }),
        },
      }),
    );
  }

  function abort() {
    if (reqId && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "cf_agent_chat_request_cancel", id: reqId }));
    }
    setStreaming(false);
    if (asstId) {
      setMsgs((prev) => prev.map((m) => (m.id === asstId ? { ...m, content: m.content || "[aborted]" } : m)));
    }
    reqId = null;
    asstId = null;
    buf = "";
  }

  function clear() {
    ws?.send(JSON.stringify({ type: "cf_agent_chat_clear" }));
    setMsgs([]);
  }

  connect();

  return { msgs, streaming, err, connected, send, abort, clear, connect, disconnect };
}
