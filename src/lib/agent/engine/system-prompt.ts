// src/lib/agent/engine/system-prompt.ts

import { Tool, ToolContext } from "../tools/types";

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
