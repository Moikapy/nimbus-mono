-- 0xNIMBUS D1 schema for memory + tracing
-- Used by d1Memory and d1TraceStore

-- Conversation summaries (compacted from previous sessions)
CREATE TABLE IF NOT EXISTS nimbus_conversations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  summary TEXT,
  metadata TEXT
);

-- Individual messages within conversations
CREATE TABLE IF NOT EXISTS nimbus_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES nimbus_conversations(id),
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  call_id TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON nimbus_messages(conversation_id, timestamp);

-- Execution traces (full audit trail)
CREATE TABLE IF NOT EXISTS nimbus_traces (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('model_call', 'tool_call', 'tool_result', 'response')),
  model TEXT,
  input TEXT,
  output TEXT,
  tool_results TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_traces_run ON nimbus_traces(run_id, step);