"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Chat } from "@/components/chat";

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentId, setAgentId] = useState<string>("default");

  return (
    <div className="flex h-screen w-full">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onSelect={setAgentId} currentAgentId={agentId} />
      <main className="flex-1 flex flex-col min-w-0">
        <Chat agentId={agentId} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      </main>
    </div>
  );
}
