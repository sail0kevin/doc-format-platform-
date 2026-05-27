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
    const toolDefs = this.tools.map(toolToLLMDef);

    const messages: LLMMessage[] = [
      { role: "system", content: buildSystemPrompt(this.tools, context) },
      ...this.history,
      { role: "user", content: userText },
    ];

    const toolCalls: AgentResult["toolCalls"] = [];
    let reply = "";

    // ── ReAct 循环 ──
    for (let i = 0; i < this.config.maxToolCalls; i++) {
      const response = await this.client.chat(messages, toolDefs);

      if (!response.toolCalls || response.toolCalls.length === 0) {
        reply = response.content;
        const msg: LLMMessage = { role: "assistant", content: response.content };
        if (response.reasoningContent) msg.reasoning_content = response.reasoningContent;
        messages.push(msg);
        break;
      }

      if (response.content) {
        const msg: LLMMessage = { role: "assistant", content: response.content };
        if (response.reasoningContent) msg.reasoning_content = response.reasoningContent;
        messages.push(msg);
      }

      for (const tc of response.toolCalls) {
        const tool = this.toolMap.get(tc.toolName);
        if (!tool) {
          messages.push({ role: "tool", content: `错误：找不到工具"${tc.toolName}"`, tool_call_id: tc.id });
          continue;
        }

        const toolCallMsg: LLMMessage = {
          role: "assistant",
          content: null,
          tool_calls: [{ id: tc.id, type: "function", function: { name: tc.toolName, arguments: JSON.stringify(tc.args) } }],
        };
        if (response.reasoningContent) toolCallMsg.reasoning_content = response.reasoningContent;
        messages.push(toolCallMsg);

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

    this.history = messages.slice(1).slice(-this.config.maxHistoryLength);

    return { reply: reply || "收到，正在处理…", toolCalls };
  }

  clearHistory(): void {
    this.history = [];
  }
}
