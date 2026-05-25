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
