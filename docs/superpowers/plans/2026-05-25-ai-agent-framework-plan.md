# AI Agent 框架实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 doc-format-platform 构建标准化的 AI Agent 框架（四层架构），ChatPanel 接入真实 LLM，Agent 能理解排版需求并操作页面配置。

**Architecture:** 四层架构（Tools → LLM Communication → Agent Engine → React Integration），每层通过接口通信互不影响。Tools 是纯函数，Engine 实现 ReAct 循环，Provider 桥接 Agent 与 React state。

**Tech Stack:** Next.js 16, TypeScript, OpenAI API / Ollama (通过环境变量切换), 无额外 npm 依赖

**前置准备：**
- 创建 `.env.local`，填入 LLM_PROVIDER（openai 或 ollama）和对应 API key
- 无需安装新 npm 包（所有代码纯 TypeScript 实现）

---

## 文件结构一览

```
src/lib/agent/
├── tools/
│   ├── types.ts           # Tool 接口定义
│   ├── index.ts           # 工具注册中心
│   ├── apply-preset.ts    # 切换预设
│   ├── add-element.ts     # 添加文档元素
│   ├── remove-element.ts  # 删除文档元素
│   ├── update-config.ts   # 修改元素配置
│   ├── set-margins.ts     # 设置页面边距
│   ├── undo-redo.ts       # 撤销/重做
│   └── suggest-format.ts  # 给出排版建议
├── llm/
│   ├── types.ts           # LLM 消息格式
│   └── client.ts          # LLM API 调用封装
├── engine/
│   ├── types.ts           # 引擎类型
│   ├── system-prompt.ts   # System Prompt 组装
│   └── agent-engine.ts    # ReAct 循环核心
└── react/
    ├── types.ts           # React 集成层类型
    └── agent-provider.tsx  # Provider + useAgent hook + Context
src/app/api/agent/
└── route.ts               # Next.js API 路由（服务端转发）
src/components/chat/
├── ChatPanel.tsx          # 改为用 useAgent() hook
└── ... (ChatMessage.tsx, ChatInput.tsx 不变)
```

---

### Task 1: 创建目录结构

- [ ] **Step 1: 创建所有需要的目录**

```bash
cd /g/projects/doc-format-platform
mkdir -p src/lib/agent/tools src/lib/agent/llm src/lib/agent/engine src/lib/agent/react src/app/api/agent
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent/ src/app/api/agent/
git commit -m "chore: create agent framework directory structure"
```

---

### Task 2: Layer 1 — 工具系统

**核心设计：** 每个工具一个文件，实现 Tool 接口。工具是纯逻辑，不依赖 React。execute() 返回结果描述，由上层决定如何应用。

**Files:**
- Create: `src/lib/agent/tools/types.ts`
- Create: `src/lib/agent/tools/index.ts`
- Create: `src/lib/agent/tools/apply-preset.ts`
- Create: `src/lib/agent/tools/add-element.ts`
- Create: `src/lib/agent/tools/remove-element.ts`
- Create: `src/lib/agent/tools/update-config.ts`
- Create: `src/lib/agent/tools/set-margins.ts`
- Create: `src/lib/agent/tools/undo-redo.ts`
- Create: `src/lib/agent/tools/suggest-format.ts`

- [ ] **Step 1: 创建 types.ts**

```typescript
// src/lib/agent/tools/types.ts

export interface ToolParameter {
  name: string;
  description: string;
  required: boolean;
  type: "string" | "number" | "boolean";
}

export interface ToolResult {
  message: string;
  data?: Record<string, unknown>;
}

export interface ToolContext {
  elements: Array<{
    id: string;
    label: string;
    type: "heading" | "body";
    wordStyles: string[];
    config: Record<string, string | boolean>;
  }>;
  pageMargins: Record<string, string>;
  headerConfig: {
    showHeader: boolean;
    text: string;
    useChapterHeader: boolean;
    showPageNumber: boolean;
    pageNumberAlign: string;
  };
  preset: string;
  canUndo: boolean;
  canRedo: boolean;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult>;
}

export interface ToolCallRecord {
  toolName: string;
  args: Record<string, any>;
  result: ToolResult;
}
```

- [ ] **Step 2: 创建 apply-preset.ts**

```typescript
// src/lib/agent/tools/apply-preset.ts

import { Tool, ToolResult, ToolContext } from "./types";

export const applyPreset: Tool = {
  name: "apply_preset",
  description: "应用内置排版预设方案。可用的预设：essay(学术论文), report(商业报告), official(政府公文), novel(小说/散文)。调用后会同时修改所有文档元素的字体、字号、间距、页边距等配置。",
  parameters: [
    {
      name: "presetName",
      description: "预设名称，可选值：essay, report, official, novel",
      required: true,
      type: "string",
    },
  ],
  async execute(args: Record<string, any>, _context: ToolContext): Promise<ToolResult> {
    const presetName = String(args.presetName || "");
    const valid = ["essay", "report", "official", "novel"];
    if (!valid.includes(presetName)) {
      return { message: `无效预设"${presetName}"，可用：${valid.join("、")}` };
    }
    const labels: Record<string, string> = { essay: "学术论文", report: "商业报告", official: "政府公文", novel: "小说/散文" };
    return { message: `已选择「${labels[presetName] || presetName}」预设`, data: { presetName } };
  },
};
```

- [ ] **Step 3: 创建 add-element.ts**

```typescript
// src/lib/agent/tools/add-element.ts

import { Tool, ToolResult, ToolContext } from "./types";

export const addElement: Tool = {
  name: "add_element",
  description: "添加新的文档元素（标题类或正文类）。标题用于章节/段落标题，正文用于普通文本段落。",
  parameters: [
    { name: "type", description: "元素类型：heading(标题类) 或 body(正文类)", required: true, type: "string" },
    { name: "label", description: "元素显示名称，如"大标题"、"二级标题"、"正文"", required: true, type: "string" },
    { name: "wordStyles", description: "匹配的 Word 样式名，多个用逗号分隔", required: false, type: "string" },
  ],
  async execute(args: Record<string, any>, _context: ToolContext): Promise<ToolResult> {
    const type = String(args.type || "");
    const label = String(args.label || "").trim();
    if (!["heading", "body"].includes(type)) return { message: `无效元素类型"${type}"` };
    if (!label) return { message: "元素名称不能为空" };
    return { message: `已添加${type === "heading" ? "标题" : "正文"}"${label}"`, data: { type, label, wordStyles: String(args.wordStyles || "") } };
  },
};
```

- [ ] **Step 4: 创建 remove-element.ts**

```typescript
// src/lib/agent/tools/remove-element.ts

import { Tool, ToolResult, ToolContext } from "./types";

export const removeElement: Tool = {
  name: "remove_element",
  description: "删除指定 ID 的文档元素。注意：至少保留一个正文元素。",
  parameters: [
    { name: "elementId", description: "要删除的元素 ID", required: true, type: "string" },
  ],
  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const elementId = String(args.elementId || "");
    const target = context.elements.find((e) => e.id === elementId);
    if (!target) return { message: `未找到元素"${elementId}"` };
    if (context.elements.length <= 1) return { message: `无法删除"${target.label}"：至少保留一个元素` };
    const bodyCount = context.elements.filter((e) => e.type === "body").length;
    if (target.type === "body" && bodyCount <= 1) return { message: `无法删除"${target.label}"：至少保留一个正文元素` };
    return { message: `已删除"${target.label}"`, data: { elementId } };
  },
};
```

- [ ] **Step 5: 创建 update-config.ts**

```typescript
// src/lib/agent/tools/update-config.ts

import { Tool, ToolResult, ToolContext } from "./types";

export const updateConfig: Tool = {
  name: "update_config",
  description: "修改某个文档元素的配置项。一次只改一个配置项。配置项：font(字体), size(字号pt), bold(是否加粗true/false), align(对齐left/center/right/justify), space_before(段前距pt), space_after(段后距pt), line_spacing(行间距倍数), color(6位十六进制色码), first_line_indent(首行缩进cm)",
  parameters: [
    { name: "elementId", description: "元素 ID", required: true, type: "string" },
    { name: "key", description: "配置项名称", required: true, type: "string" },
    { name: "value", description: "配置值", required: true, type: "string" },
  ],
  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const elementId = String(args.elementId || "");
    const key = String(args.key || "");
    const value = String(args.value ?? "");
    const target = context.elements.find((e) => e.id === elementId);
    if (!target) return { message: `未找到元素"${elementId}"` };
    const validKeys = ["font", "size", "bold", "align", "space_before", "space_after", "line_spacing", "color", "first_line_indent"];
    if (!validKeys.includes(key)) return { message: `无效配置项"${key}"` };
    if (key === "align" && !["left", "center", "right", "justify"].includes(value)) return { message: `对齐方式必须是 left/center/right/justify` };
    if ((key === "size" || key === "space_before" || key === "space_after") && (isNaN(Number(value)) || Number(value) <= 0)) return { message: `${key} 必须为正数` };
    return { message: `已将"${target.label}"的${key}设为${value}`, data: { elementId, key, value } };
  },
};
```

- [ ] **Step 6: 创建 set-margins.ts**

```typescript
// src/lib/agent/tools/set-margins.ts

import { Tool, ToolResult, ToolContext } from "./types";

export const setMargins: Tool = {
  name: "set_margins",
  description: "调整页面边距（单位 cm）。只传需要修改的边距值，不传的保持不变。",
  parameters: [
    { name: "top", description: "上边距 cm", required: false, type: "string" },
    { name: "bottom", description: "下边距 cm", required: false, type: "string" },
    { name: "left", description: "左边距 cm", required: false, type: "string" },
    { name: "right", description: "右边距 cm", required: false, type: "string" },
  ],
  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const changes: string[] = [];
    const newMargins = { ...context.pageMargins };
    const keys = ["top", "bottom", "left", "right"] as const;
    const nameMap: Record<string, string> = { top: "上", bottom: "下", left: "左", right: "右" };
    for (const k of keys) {
      if (args[k] !== undefined) {
        const v = parseFloat(args[k]);
        if (isNaN(v) || v < 0 || v > 10) return { message: `${nameMap[k]}边距需在 0-10cm 之间` };
        newMargins[`margin_${k}`] = String(v);
        changes.push(`${nameMap[k]}边距 ${v}cm`);
      }
    }
    if (changes.length === 0) return { message: "未指定要修改的边距" };
    return { message: `已调整：${changes.join("，")}`, data: { margins: newMargins } };
  },
};
```

- [ ] **Step 7: 创建 undo-redo.ts**

```typescript
// src/lib/agent/tools/undo-redo.ts

import { Tool, ToolResult, ToolContext } from "./types";

export const undo: Tool = {
  name: "undo",
  description: "撤销上一步操作，恢复到之前的状态。",
  parameters: [],
  async execute(_args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    if (!context.canUndo) return { message: "没有可以撤销的操作了" };
    return { message: "已撤销上一步操作", data: { action: "undo" } };
  },
};

export const redo: Tool = {
  name: "redo",
  description: "重做被撤销的操作。",
  parameters: [],
  async execute(_args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    if (!context.canRedo) return { message: "没有可以重做的操作了" };
    return { message: "已重做操作", data: { action: "redo" } };
  },
};
```

- [ ] **Step 8: 创建 suggest-format.ts**

```typescript
// src/lib/agent/tools/suggest-format.ts

import { Tool, ToolResult, ToolContext } from "./types";

export const suggestFormat: Tool = {
  name: "suggest_format",
  description: "根据当前文档内容给出排版建议。当用户需求不明确时调用，不会修改任何页面配置。",
  parameters: [],
  async execute(_args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const stats = [`${context.elements.length} 个文档元素`];
    stats.push(context.elements.some((e) => e.wordStyles.some((s) => /heading 1|标题 1|^title$/i.test(s))) ? "已配置大标题" : "无大标题");
    return { message: `当前：${stats.join("，")}。预设：${context.preset}。请根据用户描述给出排版建议。`, data: { preset: context.preset } };
  },
};
```

- [ ] **Step 9: 创建 index.ts**

```typescript
// src/lib/agent/tools/index.ts

import { Tool } from "./types";
import { applyPreset } from "./apply-preset";
import { addElement } from "./add-element";
import { removeElement } from "./remove-element";
import { updateConfig } from "./update-config";
import { setMargins } from "./set-margins";
import { undo, redo } from "./undo-redo";
import { suggestFormat } from "./suggest-format";

export const allTools: Tool[] = [
  applyPreset, addElement, removeElement, updateConfig,
  setMargins, undo, redo, suggestFormat,
];

export function buildToolMap(tools: Tool[]): Map<string, Tool> {
  const map = new Map<string, Tool>();
  for (const t of tools) map.set(t.name, t);
  return map;
}
```

- [ ] **Step 10: 验证编译**

```bash
cd /g/projects/doc-format-platform
npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: 无错误（仅已有项目的 warning 可忽略）

- [ ] **Step 11: Commit**

```bash
git add src/lib/agent/tools/
git commit -m "feat(agent): Layer 1 tool system with 8 tools"
```

---

### Task 3: Layer 2 — LLM 通信层

**Files:**
- Create: `src/lib/agent/llm/types.ts`
- Create: `src/lib/agent/llm/client.ts`
- Create: `src/app/api/agent/route.ts`
- Create: `.env.local`

- [ ] **Step 1: 创建 llm/types.ts**

```typescript
// src/lib/agent/llm/types.ts

import { Tool } from "../tools/types";

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface LLMResponse {
  content: string;
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
```

- [ ] **Step 2: 创建 llm/client.ts**

```typescript
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
```

- [ ] **Step 3: 创建 src/app/api/agent/route.ts**

```typescript
// src/app/api/agent/route.ts
//
// 服务端 LLM 代理路由。
// 前端不直接调 LLM API，通过这个路由转发。
// 支持 OpenAI 和 Ollama 两种后端，通过 LLM_PROVIDER 环境变量切换。

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

/** 调 OpenAI API */
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
      } catch { /* 解析失败跳过 */ }
    }
  }

  return NextResponse.json({ content: choice.message?.content || "", toolCalls });
}

/** 调本地 Ollama */
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
```

- [ ] **Step 4: 创建 .env.local**

```bash
# /g/projects/doc-format-platform/.env.local
# LLM 后端：openai 或 ollama
LLM_PROVIDER=ollama

# OpenAI（LLM_PROVIDER=openai 时使用）
# OPENAI_API_KEY=sk-xxx
# OPENAI_MODEL=gpt-4o-mini

# Ollama（LLM_PROVIDER=ollama 时使用）
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:7b
```

- [ ] **Step 5: 验证编译**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent/llm/ src/app/api/agent/ .env.local
git commit -m "feat(agent): Layer 2 LLM communication + API route"
```

---

### Task 4: Layer 3 — Agent 引擎

**核心设计：** ReAct 循环。收到用户输入 → 调 LLM → 有 tool_call 就执行工具 → 结果反馈给 LLM → 继续循环直到 LLM 直接回复。

**Files:**
- Create: `src/lib/agent/engine/types.ts`
- Create: `src/lib/agent/engine/system-prompt.ts`
- Create: `src/lib/agent/engine/agent-engine.ts`

- [ ] **Step 1: 创建 engine/types.ts**

```typescript
// src/lib/agent/engine/types.ts

export interface AgentConfig {
  systemPrompt: string;
  toolNames: string[];          // 可用工具名称列表
  maxToolCalls: number;         // 单轮最多 5 次
  maxHistoryLength: number;     // 最多保留 50 条
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
```

- [ ] **Step 2: 创建 system-prompt.ts**

```typescript
// src/lib/agent/engine/system-prompt.ts

import { ToolContext } from "../tools/types";
import { Tool } from "../tools/types";

export function buildSystemPrompt(tools: Tool[], context: ToolContext): string {
  return `你是文档排版助手。你可以调用工具来帮助用户排版 Word 文档。

【工作方式】
1. 用户提出排版需求
2. 需求明确 → 直接调工具完成，不要问"是否确定"
3. 需求模糊（"帮我排版""排好看点"）→ 建议 2-3 个方案让用户选
4. 每次只调一个工具，等结果返回再决定下一步
5. 完成后用一句话总结做了什么

【当前页面状态】
${buildPageState(context)}

【可用工具】
${tools.map((t) => `- ${t.name}：${t.description}\n  参数：${t.parameters.map((p) => `${p.name}(${p.required ? "必填" : "可选"})`).join("、") || "无"}`).join("\n")}`;
}

function buildPageState(ctx: ToolContext): string {
  const lines = [`- 预设：${ctx.preset}`];
  for (const el of ctx.elements) {
    const c = el.config;
    lines.push(`- ${el.label}(${el.id})：${c.font} ${c.size}pt ${c.bold ? "加粗" : "不加粗"} ${c.align} 段前${c.space_before} 段后${c.space_after} 行距${c.line_spacing}`);
  }
  lines.push(`- 边距：上${ctx.pageMargins.margin_top} 下${ctx.pageMargins.margin_bottom} 左${ctx.pageMargins.margin_left} 右${ctx.pageMargins.margin_right}`);
  return lines.join("\n");
}
```

- [ ] **Step 3: 创建 agent-engine.ts**

```typescript
// src/lib/agent/engine/agent-engine.ts
//
// 【核心逻辑 — ReAct 循环】
// 1. 组装 System Prompt（含页面状态）
// 2. 用户消息追加到历史
// 3. 循环：
//    a. 调 LLM
//    b. LLM 直接回复 → 结束
//    c. LLM 调工具 → 执行 → 结果放回历史 → 继续循环
// 4. 返回最终回复 + 工具调用记录

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

        // 把 LLM 的 tool_call 请求加入历史
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

    // 控制上下文窗口
    this.history = messages.slice(-this.config.maxHistoryLength);

    return { reply: reply || "操作完成", toolCalls };
  }

  clearHistory(): void {
    this.history = [];
  }
}
```

- [ ] **Step 4: 验证编译**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/engine/
git commit -m "feat(agent): Layer 3 Agent engine with ReAct loop"
```

---

### Task 5: Layer 4 — React 集成层

**核心设计：** AgentProvider 创建引擎实例，useAgent() hook 给组件用。Provider 负责把引擎返回的工具调用翻译成 React state 变更。

**Files:**
- Create: `src/lib/agent/react/agent-provider.tsx`（包含 types + context + provider + hook）

- [ ] **Step 1: 创建 agent-provider.tsx**

```typescript
// src/lib/agent/react/agent-provider.tsx
//
// 【作用】
// Agent 的 React 集成层。
// - AgentProvider：包裹整个应用，创建引擎实例
// - useAgent()：组件调用的 hook，返回 sendMessage、messages、isLoading 等
//
// 【数据流】
// 1. 用户输入 → sendMessage(text)
// 2. Provider 从 React state 构建 ToolContext
// 3. 引擎执行 ReAct 循环
// 4. 引擎返回 → Provider 解析 toolCalls → 更新 React state
// 5. LLM 回复追加到消息列表 → ChatPanel 渲染

"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { AgentEngine } from "../engine/agent-engine";
import { AgentMessage, genId } from "../engine/types";
import { ToolContext } from "../tools/types";
import { allTools } from "../tools/index";

// ══════════════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════════════

interface AgentContextValue {
  messages: AgentMessage[];
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  isLoading: boolean;
  error: string | null;
}

interface AgentProviderProps {
  children: React.ReactNode;
  /** 构建 ToolContext 的回调——每次发消息前从 React state 取最新值 */
  buildContext: () => ToolContext;
  /** 工具调用的响应函数——引擎返回 toolCalls 后，由 Provider 执行实际 state 变更 */
  onToolCall: (toolName: string, args: Record<string, any>) => void;
  /** System Prompt */
  systemPrompt?: string;
}

// ══════════════════════════════════════════════════════
// Context
// ══════════════════════════════════════════════════════

const AgentContext = createContext<AgentContextValue | null>(null);

// ══════════════════════════════════════════════════════
// Provider
// ══════════════════════════════════════════════════════

const DEFAULT_SYSTEM_PROMPT = "你是文档排版助手。你通过工具帮助用户排版 Word 文档。需求明确就操作，不明确就给建议。";

export function AgentProvider({ children, buildContext, onToolCall, systemPrompt }: AgentProviderProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "你好！我是 AI 排版助手。你可以告诉我排版需求，比如"排成学术论文格式"或"标题用黑体二号"。",
      timestamp: Date.now(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 引擎实例——整个生命周期只创建一次
  const engineRef = useRef<AgentEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new AgentEngine(
      { systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT, toolNames: allTools.map((t) => t.name), maxToolCalls: 5, maxHistoryLength: 50 },
      allTools
    );
  }

  // 组件卸载时清理历史
  useEffect(() => {
    return () => { engineRef.current?.clearHistory(); };
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    // 添加用户消息
    const userMsg: AgentMessage = { id: genId(), role: "user", content: trimmed, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    try {
      // 从 React state 构建当前上下文
      const context = buildContext();
      // 引擎执行 ReAct 循环
      const result = await engineRef.current!.processUserInput(trimmed, context);

      // 处理工具调用——更新 React state
      for (const tc of result.toolCalls) {
        onToolCall(tc.toolName, tc.args);
      }

      // 添加 AI 回复
      const aiMsg: AgentMessage = {
        id: genId(),
        role: "assistant",
        content: result.reply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setError(err.message || "请求失败，请检查 LLM 服务是否可用");
      // 添加错误提示消息
      const errMsg: AgentMessage = {
        id: genId(),
        role: "assistant",
        content: `抱歉，处理请求时出错：${err.message}。请检查 LLM 服务是否正常运行。`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, buildContext, onToolCall]);

  const clearMessages = useCallback(() => {
    engineRef.current?.clearHistory();
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "你好！我是 AI 排版助手。你可以告诉我排版需求，比如"排成学术论文格式"或"标题用黑体二号"。",
        timestamp: Date.now(),
      },
    ]);
    setError(null);
  }, []);

  return (
    <AgentContext.Provider value={{ messages, sendMessage, clearMessages, isLoading, error }}>
      {children}
    </AgentContext.Provider>
  );
}

// ══════════════════════════════════════════════════════
// Hook
// ══════════════════════════════════════════════════════

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent() 必须在 AgentProvider 内使用");
  return ctx;
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: 无错误（注意确认 ToolContext 类型匹配 page.tsx 中的实际数据类型）

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent/react/
git commit -m "feat(agent): Layer 4 React integration with AgentProvider + useAgent"
```

---

### Task 6: 接入 ChatPanel 和 Page

**核心改动：** page.tsx 用 AgentProvider 包裹，传入 buildContext 和 onToolCall。ChatPanel 改为用 useAgent() 替代内部模拟状态。

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: 修改 page.tsx — 用 AgentProvider 包裹**

在 page.tsx 中找到 `return (...)` 部分，在外层添加 AgentProvider。同时需要删除原有的 ChatPanel 导入和调用方式，改为由 AgentContext 管理。

在 page.tsx 的 Home 函数内，import 区域添加：

```typescript
import { useState, useCallback, useEffect, useRef } from "react";  // 已有
// ... 其他已有 imports ...
import { AgentProvider } from "@/lib/agent/react/agent-provider";
import { ToolContext } from "@/lib/agent/tools/types";
```

在 Home 函数内（useEffect 和 state 定义之后），添加 buildContext 和 onToolCall：

```typescript
const buildContext = useCallback((): ToolContext => ({
  elements: elements as any,     // elements 已存在
  pageMargins: pageMargins,      // pageMargins 已存在
  headerConfig: headerConfig,    // headerConfig 已存在
  preset,                        // preset 已存在
  canUndo: historyIdx > 0,       // historyIdx 已存在
  canRedo: historyIdx < history.length - 1,  // history 已存在
}), [elements, pageMargins, headerConfig, preset, historyIdx, history]);

const handleToolCall = useCallback((toolName: string, args: Record<string, any>) => {
  switch (toolName) {
    case "apply_preset":
      applyPreset(args.presetName);
      break;
    case "add_element":
      // 调用 page.tsx 的 addElement 逻辑
      // 由于 addElement 在 page.tsx 中有 UI 交互（弹窗），
      // 这里直接操作 elements
      if (args.type && args.label) {
        const newEl = {
          id: `agent-${Date.now()}`,
          label: args.label,
          type: args.type as "heading" | "body",
          wordStyles: args.wordStyles ? args.wordStyles.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean) : [],
          config: args.type === "body"
            ? { font: "宋体", size: "12", bold: false, align: "justify", space_before: "0", space_after: "0", color: "000000", line_spacing: "1.5", first_line_indent: "0.74" }
            : { font: "黑体", size: "14", bold: true, align: "left", space_before: "12", space_after: "6", color: "000000", line_spacing: "1.5" },
        };
        setElements((prev: any[]) => [...prev, newEl]);
      }
      break;
    case "remove_element":
      setElements((prev: any[]) => prev.filter((e) => e.id !== args.elementId));
      break;
    case "update_config":
      setElements((prev: any[]) => prev.map((e: any) =>
        e.id === args.elementId ? { ...e, config: { ...e.config, [args.key]: args.value } } : e
      ));
      break;
    case "set_margins":
      if (args.margins) setPageMargins(args.margins);
      break;
    case "undo":
      undo();
      break;
    case "redo":
      redo();
      break;
    // suggest_format 不需要操作页面
  }
}, []);
```

将返回的 JSX 外层用 AgentProvider 包裹：

```tsx
return (
  <AgentProvider buildContext={buildContext} onToolCall={handleToolCall}>
    <div className="h-screen flex flex-col bg-background">
      {/* ... 原有内容 ... */}
    </div>
  </AgentProvider>
);
```

- [ ] **Step 2: 修改 ChatPanel.tsx — 用 useAgent() 替代内部状态**

将 ChatPanel.tsx 中原来自己管理 messages、loading、timerRef 的逻辑，改为用 useAgent() hook。

```typescript
// src/components/chat/ChatPanel.tsx

"use client";

import { MessageSquare, PanelLeftClose } from "lucide-react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { useAgent } from "@/lib/agent/react/agent-provider";

interface ChatPanelProps {
  onToggle: () => void;
  loc: (key: string, params?: Record<string, string>) => string;
}

export default function ChatPanel({ onToggle, loc }: ChatPanelProps) {
  // 从 AgentProvider 获取状态，不再自己管理
  const { messages, sendMessage, isLoading, error, clearMessages } = useAgent();

  const handleSend = (text: string) => {
    sendMessage(text);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{loc("chat.title")}</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 1 && (
            <button
              onClick={clearMessages}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs"
              title={loc("chat.clear") || "清空对话"}
              aria-label={loc("chat.clear") || "清空对话"}
            >
              清空
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={loc("chat.collapse")}
            aria-label={loc("chat.collapse")}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4" role="log" aria-label={loc("chat.message_aria")}>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {/* 空状态提示 */}
        {messages.length === 1 && messages[0].id === "welcome" && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/50 gap-2">
            <MessageSquare className="w-8 h-8" />
            <p className="text-xs">{loc("chat.empty_hint")}</p>
          </div>
        )}
        {/* 错误提示 */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <ChatInput
        onSend={handleSend}
        loading={isLoading}
        placeholder={loc("chat.placeholder")}
        inputAriaLabel={loc("chat.input_aria")}
        sendAriaLabel={loc("chat.send_aria")}
      />
    </div>
  );
}
```

注意：需要在翻译文件中添加 `chat.clear` 键（可选）。

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit --pretty 2>&1 | head -40
```
Expected: 无类型错误。如果出现 ToolContext 类型不匹配问题，调整 `buildContext` 中的类型转换。

- [ ] **Step 4: 启动 Ollama 并测试**

```bash
# 确保 Ollama 在运行
curl http://localhost:11434/api/tags 2>/dev/null && echo "Ollama OK" || echo "Ollama 未启动"

# 确认模型存在
ollama list | grep qwen2.5-coder

# 启动开发服务器
cd /g/projects/doc-format-platform
npx next dev -p 3030 --webpack
```

在浏览器中打开 localhost:3030，在聊天面板中输入消息，观察 Agent 是否响应。

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/chat/ChatPanel.tsx
git commit -m "feat(agent): wire up ChatPanel with AgentProvider + useAgent"
```

---

### Task 7: 最终验证

- [ ] **Step 1: 完整编译检查**

```bash
npx tsc --noEmit --pretty 2>&1
```

- [ ] **Step 2: 验证目录完整性**

```bash
ls -la src/lib/agent/tools/
ls -la src/lib/agent/llm/
ls -la src/lib/agent/engine/
ls -la src/lib/agent/react/
ls -la src/app/api/agent/
```

Expected: 所有文件都在，共约 15 个文件

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat(agent): complete AI Agent framework implementation

- Layer 1: Tool system with 8 tools (apply_preset, add_element, etc.)
- Layer 2: LLM communication via /api/agent route (OpenAI + Ollama)
- Layer 3: Agent engine with ReAct loop
- Layer 4: React integration with AgentProvider + useAgent hook
- Wire up ChatPanel to use real Agent instead of simulated responses"
```

---

## 验证清单

| 检查项 | 方法 | 预期 |
|--------|------|------|
| TypeScript 编译 | `npx tsc --noEmit` | 无错误 |
| API 路由启动 | `curl localhost:3030/api/agent -d '{}'` | 返回错误（非 404） |
| Ollama 连接 | 环境变量 LLM_PROVIDER=ollama | Agent 调本地模型 |
| ChatPanel 发送 | 输入文字点发送 | 调用引擎，不再用 setTimeout |
| 工具调用 | 说"排成学术论文" | 触发 apply_preset 工具 |
| 页面操作 | Agent 调工具后 | 页面配置自动更新 |
| 错误处理 | 停掉 Ollama 后发消息 | ChatPanel 显示错误提示 |
