"use client";

import { Chat } from "@/components/chat";

export default function Page() {
  return (
    <div className="flex h-screen w-full">
      <Chat agentId="default" onToggleSidebar={() => {}} />
    </div>
  );
}
