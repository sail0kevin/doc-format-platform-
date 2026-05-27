// src/app/api/agent/route.ts

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages, tools } = await req.json();
    const provider = process.env.LLM_PROVIDER || "ollama";

    if (provider === "openai") return await callOpenAI(messages, tools);
    if (provider === "ollama") return await callOllama(messages, tools);
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  } catch (err: any) {
    console.error("[/api/agent]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function callOpenAI(messages: unknown[], tools: unknown[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY 未配置" }, { status: 500 });

  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const body: Record<string, unknown> = {
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    // DeepSeek 需要原样传回 reasoning_content
    messages: (messages as any[]).map((m) => {
      if (m.reasoning_content) return { ...m, reasoning_content: m.reasoning_content };
      return m;
    }),
    temperature: 0.3,
  };
  if (tools && Array.isArray(tools) && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error("OpenAI 返回为空");

  const toolCalls: { id: string; toolName: string; args: Record<string, any> }[] = [];
  if (choice.message?.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      try {
        toolCalls.push({ id: tc.id, toolName: tc.function.name, args: JSON.parse(tc.function.arguments) });
      } catch { /* skip parse failures */ }
    }
  }

  let content = choice.message?.content || "";

  // 如果模型没有返回原生 tool_calls，尝试从文本中提取
  if (toolCalls.length === 0 && content) {
    const extracted = extractToolCallsFromText(content);
    if (extracted.length > 0) {
      for (let i = 0; i < extracted.length; i++) {
        toolCalls.push({ id: `tc-${Date.now()}-${i}`, ...extracted[i] });
      }
      content = stripToolCallsFromText(content);
    }
  }

  return NextResponse.json({
    content,
    toolCalls,
    reasoningContent: choice.message?.reasoning_content || undefined,
  });
}

/** 从模型回复的文本中提取 JSON 格式的工具调用 */
function extractToolCallsFromText(text: string): { toolName: string; args: Record<string, any> }[] {
  const calls: { toolName: string; args: Record<string, any> }[] = [];
  const regex = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[2]);
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        calls.push({ toolName: match[1], args: parsed });
      }
    } catch { /* skip unparseable JSON */ }
  }
  return calls;
}

/** 从模型回复文本中移除 JSON 工具调用，保留纯文字 */
function stripToolCallsFromText(text: string): string {
  return text.replace(/\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*\{[\s\S]*?\}\s*\}/g, "").trim();
}

/**
 * 将聊天历史「扁平化」为纯文本对话。
 * qwen2.5-coder 等模型不支持原生 tool_calls，
 * 我们把所有工具调用和结果转为自然语言文本，模型就能理解。
 */
function flattenMessages(msgs: any[]): { role: string; content: string }[] {
  const result: { role: string; content: string }[] = [];
  for (const m of msgs) {
    if (m.role === "tool") {
      // 工具返回结果 → 转为 system 风格的消息
      result.push({ role: "user", content: `[工具执行结果] ${m.content}` });
    } else if (m.tool_calls) {
      // 工具调用 → 转为 assistant 文本描述
      const calls = m.tool_calls.map((tc: any) => {
        const args = typeof tc.function?.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function?.arguments || {});
        return `{"name":"${tc.function?.name}","arguments":${args}}`;
      }).join("\n");
      const text = m.content ? `${m.content}\n${calls}` : calls;
      result.push({ role: "assistant", content: text });
    } else {
      result.push({ role: m.role, content: m.content || "" });
    }
  }
  return result;
}

/** 从模型回复的文本中提取 JSON 格式的工具调用 */
function extractToolCalls(text: string): { toolName: string; args: Record<string, any> }[] {
  const calls: { toolName: string; args: Record<string, any> }[] = [];
  const regex = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[2]);
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        calls.push({ toolName: match[1], args: parsed });
      }
    } catch { /* skip unparseable JSON */ }
  }
  return calls;
}

/** 从模型回复文本中移除 JSON 工具调用，保留纯文字 */
function stripToolCalls(text: string): string {
  return text.replace(/\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*\{[\s\S]*?\}\s*\}/g, "").trim();
}

async function callOllama(messages: unknown[], tools: unknown[]) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";

  // 扁平化消息历史为纯文本（避免 tool_calls 格式兼容问题）
  const textMessages = flattenMessages(messages as any[]);

  const body: Record<string, unknown> = {
    model,
    messages: textMessages,
    stream: false,
    options: { temperature: 0.3 },
  };

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const content: string = data.message?.content || "";

  // 从文本中提取工具调用
  const rawCalls = extractToolCalls(content);
  const toolCalls = rawCalls.map((c, i) => ({
    id: `tc-${Date.now()}-${i}`,
    ...c,
  }));

  // 清理内容：去掉 JSON 工具调用部分，只保留自然语言
  const cleanContent = stripToolCalls(content);

  return NextResponse.json({ content: cleanContent, toolCalls });
}
