/// <reference types="@opentui/solid" />
/**
 * Nimbus TUI App
 */
import { createCliRenderer } from "@opentui/core";
import { render } from "@opentui/solid";
import { Show } from "solid-js";
import { colors } from "@moikapy/kapy-components";
import { createNimbusChat } from "./hooks/use-nimbus-chat.js";
import { ChatScreen } from "./screens/chat.js";

export async function launchNimbusTUI(
  wsUrl = "ws://localhost:8787/agents/demo/demo-session",
) {
  const chat = createNimbusChat(wsUrl);

  const _renderer = await createCliRenderer({
    backgroundColor: colors.bg,
  });

  render(
    () => (
      <box flexDirection="column" height="100%">
        <box flexDirection="row" padding={1}>
          <text fg={colors.primary} attributes={1}>
            Nimbus ☁️
          </text>
          <box flexGrow={1} />
          <Show when={chat.connected()}>
            <text fg={colors.success}>● connected</text>
          </Show>
          <Show when={!chat.connected()}>
            <text fg={colors.error}>○ disconnected</text>
          </Show>
        </box>

        <box flexGrow={1}>
          <ChatScreen
            msgs={chat.msgs}
            streaming={chat.streaming}
            err={chat.err}
            onSend={chat.send}
          />
        </box>
      </box>
    ),
    _renderer,
  );
}
