import { Tool, ToolResult, ToolContext } from "./types";

export const updateLabel: Tool = {
  name: "update_label",
  description: "修改元素的名称（标签）。比如把'副标题'改名为'二级标题'",
  parameters: [
    { name: "elementId", description: "元素 ID", required: true, type: "string" },
    { name: "label", description: "新的名称", required: true, type: "string" },
  ],
  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const elementId = String(args.elementId || "");
    const label = String(args.label || "");
    const target = context.elements.find((e) => e.id === elementId);
    if (!target) return { message: `未找到元素"${elementId}"` };
    if (!label) return { message: "名称不能为空" };
    return { message: `已将"${target.label}"改名为"${label}"`, data: { elementId, label } };
  },
};
