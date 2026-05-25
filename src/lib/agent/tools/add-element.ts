import { Tool, ToolResult, ToolContext } from "./types";

export const addElement: Tool = {
  name: "add_element",
  description: "添加新的文档元素（标题类或正文类）。标题用于章节/段落标题，正文用于普通文本段落。",
  parameters: [
    { name: "type", description: "元素类型：heading(标题类) 或 body(正文类)", required: true, type: "string" },
    { name: "label", description: "元素显示名称，如「大标题」「二级标题」「正文」", required: true, type: "string" },
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
