import { Tool, ToolResult, ToolContext } from "./types";

export const updateHeader: Tool = {
  name: "update_header",
  description: "修改页眉/页码设置。showHeader 是否显示页眉(true/false), text 页眉文字, useChapterHeader 是否自动使用章节标题(true/false), showPageNumber 是否显示页码(true/false), pageNumberAlign 页码对齐(left/center/right)",
  parameters: [
    { name: "key", description: "配置项名称(showHeader/text/useChapterHeader/showPageNumber/pageNumberAlign)", required: true, type: "string" },
    { name: "value", description: "配置值", required: true, type: "string" },
  ],
  async execute(args: Record<string, any>, _context: ToolContext): Promise<ToolResult> {
    const key = String(args.key || "");
    const value = String(args.value ?? "");
    const validKeys = ["showHeader", "text", "useChapterHeader", "showPageNumber", "pageNumberAlign"];
    if (!validKeys.includes(key)) return { message: `无效配置项"${key}"` };
    if (key === "pageNumberAlign" && !["left", "center", "right"].includes(value)) return { message: "页码对齐方式必须是 left/center/right" };
    if ((key === "showHeader" || key === "useChapterHeader" || key === "showPageNumber") && value !== "true" && value !== "false") return { message: `${key} 必须为 true 或 false` };
    return { message: `已将页眉设置${key}设为${value}`, data: { key, value } };
  },
};
