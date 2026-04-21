"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Chat } from "./chat";

export default function ChatWrapper() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-full w-full">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={() => setSidebarOpen(false)}
        currentAgentId="default"
      />
      <div className="flex-1 min-w-0 lg:pl-72 transition-all duration-200">
        <Chat agentId="default" onToggleSidebar={() => setSidebarOpen((s) => !s)} />
      </div>
    </div>
  );
}
