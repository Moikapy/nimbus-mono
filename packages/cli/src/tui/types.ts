export type MsgRole = "user" | "assistant" | "system";

export interface Msg {
  id: string;
  role: MsgRole;
  content: string;
}
