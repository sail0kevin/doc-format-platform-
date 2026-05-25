// src/lib/agent/engine/types.ts

export interface AgentConfig {
  systemPrompt: string;
  toolNames: string[];
  maxToolCalls: number;
  maxHistoryLength: number;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  metadata?: {
    type?: "tool_call" | "tool_result";
    toolName?: string;
  };
}

export interface AgentResult {
  reply: string;
  toolCalls: Array<{
    toolName: string;
    args: Record<string, any>;
    resultMessage: string;
  }>;
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
