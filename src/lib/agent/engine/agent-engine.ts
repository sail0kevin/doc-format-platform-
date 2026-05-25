// src/lib/agent/engine/agent-engine.ts

import { AgentConfig, AgentResult } from "./types";
import { Tool, ToolContext } from "../tools/types";
import { ApiRouteClient } from "../llm/client";
import { LLMMessage, toolToLLMDef } from "../llm/types";
import { buildSystemPrompt } from "./system-prompt";
import { buildToolMap } from "../tools/index";

export class AgentEngine {
  private config: AgentConfig;
  private tools: Tool[];
  private toolMap: Map<string, Tool>;
  private client: ApiRouteClient;
  private history: LLMMessage[] = [];

  constructor(config: AgentConfig, tools: Tool[]) {
    this.config = config;
    this.tools = tools;
    this.toolMap = buildToolMap(tools);
    this.client = new ApiRouteClient();
  }

  async processUserInput(userText: string, context: ToolContext): Promise<AgentResult> {
    const systemPrompt = buildSystemPrompt(this.tools, context);
    const toolDefs = this.tools.map(toolToLLMDef);

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      ...this.history,
      { role: "user", content: userText },
    ];

    const toolCalls: AgentResult["toolCalls"] = [];
    let reply = "";

    for (let i = 0; i < this.config.maxToolCalls; i++) {
      const response = await this.client.chat(messages, toolDefs);

      if (!response.toolCalls || response.toolCalls.length === 0) {
        reply = response.content;
        messages.push({ role: "assistant", content: response.content });
        break;
      }

      for (const tc of response.toolCalls) {
        const tool = this.toolMap.get(tc.toolName);
        if (!tool) {
          messages.push({ role: "tool", content: `错误：找不到工具"${tc.toolName}"`, tool_call_id: tc.id });
          continue;
        }

        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [{ id: tc.id, type: "function", function: { name: tc.toolName, arguments: JSON.stringify(tc.args) } }],
        });

        try {
          const result = await tool.execute(tc.args, context);
          toolCalls.push({ toolName: tc.toolName, args: tc.args, resultMessage: result.message });
          messages.push({ role: "tool", content: result.message, tool_call_id: tc.id });
        } catch (err: any) {
          toolCalls.push({ toolName: tc.toolName, args: tc.args, resultMessage: `执行失败：${err.message}` });
          messages.push({ role: "tool", content: `执行失败：${err.message}`, tool_call_id: tc.id });
        }
      }
    }

    this.history = messages.slice(-this.config.maxHistoryLength);

    return { reply: reply || "操作完成", toolCalls };
  }

  clearHistory(): void {
    this.history = [];
  }
}
