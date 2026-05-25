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
    messages,
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

  return NextResponse.json({ content: choice.message?.content || "", toolCalls });
}

async function callOllama(messages: unknown[], tools: unknown[]) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";
  const body: Record<string, unknown> = { model, messages, stream: false, options: { temperature: 0.3 } };
  if (tools && Array.isArray(tools) && tools.length > 0) body.tools = tools;

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const message = data.message || {};
  const toolCalls: { id: string; toolName: string; args: Record<string, any> }[] = [];
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      toolCalls.push({ id: tc.id || `tc-${Date.now()}`, toolName: tc.function?.name || "", args: tc.function?.arguments || {} });
    }
  }

  return NextResponse.json({ content: message.content || "", toolCalls });
}
