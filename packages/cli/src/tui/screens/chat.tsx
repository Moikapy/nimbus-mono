/// <reference types="@opentui/solid" />
import { For, Show } from "solid-js";
import { colors } from "@moikapy/kapy-components";
import type { Msg } from "../types.js";

export function ChatScreen(props: {
  msgs: () => Msg[];
  streaming: () => boolean;
  err: () => string;
  onSend: (text: string) => void;
}) {
  return (
    <box flexDirection="column" height="100%" padding={1}>
      <Show when={props.err().length > 0}>
        <text fg={colors.error}>⚠️ {props.err()}</text>
      </Show>

      <scrollbox flexGrow={1} flexShrink={1} borderColor={colors.border}>
        <For each={props.msgs()}>
          {(msg) => (
            <box padding={1}>
              <text fg={msg.role === "user" ? colors.primary : colors.success} attributes={1}>
                {msg.role === "user" ? "You" : "Nimbus"} ›
              </text>
              <box paddingLeft={2}>
                <text fg={colors.text}>{msg.content || " "}</text>
              </box>
            </box>
          )}
        </For>

        <Show when={props.streaming() && props.msgs().length === 0}>
          <text fg={colors.muted}>Waiting...</text>
        </Show>
      </scrollbox>
    </box>
  );
}
