// src/lib/agent/llm/types.ts

import { Tool } from "../tools/types";

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  /** DeepSeek 推理内容，必须在后续请求中原样传回 */
  reasoning_content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface LLMResponse {
  content: string;
  /** DeepSeek 推理内容，需传给引擎保存 */
  reasoningContent?: string;
  toolCalls: Array<{ id: string; toolName: string; args: Record<string, any> }>;
}

export interface LLMToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
}

export function toolToLLMDef(tool: Tool): LLMToolDef {
  const properties: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];
  for (const p of tool.parameters) {
    properties[p.name] = { type: p.type, description: p.description };
    if (p.required) required.push(p.name);
  }
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: { type: "object", properties, required },
    },
  };
}
