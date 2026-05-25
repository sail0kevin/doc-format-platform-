// src/lib/agent/llm/client.ts

import { LLMMessage, LLMResponse, LLMToolDef } from "./types";

export class ApiRouteClient {
  async chat(messages: LLMMessage[], tools: LLMToolDef[]): Promise<LLMResponse> {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, tools }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new Error(`LLM API error (${res.status}): ${text}`);
    }
    return res.json();
  }
}
