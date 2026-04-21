"use client";

import { useEffect, useState } from "react";
import { Chat } from "./chat";

export default function ChatWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  return <Chat agentId="default" onToggleSidebar={() => {}} />;
}
