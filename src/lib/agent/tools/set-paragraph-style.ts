import { Tool, ToolResult, ToolContext } from "./types";

export const setParagraphStyle: Tool = {
  name: "set_paragraph_style",
  description: "修改指定段落的样式类型。paragraphIndex 是段落序号（从0开始），elementId 是目标元素ID（如 title/subtitle/heading/body）",
  parameters: [
    { name: "paragraphIndex", description: "段落序号（从0开始）", required: true, type: "number" },
    { name: "elementId", description: "目标元素ID（title/subtitle/heading/body 等）", required: true, type: "string" },
  ],
  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const index = Number(args.paragraphIndex);
    const elementId = String(args.elementId || "");
    if (isNaN(index) || index < 0) return { message: "段落序号必须是非负整数" };
    const validIds = context.elements.map(e => e.id);
    if (!validIds.includes(elementId)) return { message: `无效的元素ID"${elementId}"，可选：${validIds.join(", ")}` };
    const el = context.elements.find(e => e.id === elementId);
    return { message: `已将第${index + 1}段设为"${el?.label}"`, data: { paragraphIndex: index, elementId } };
  },
};
