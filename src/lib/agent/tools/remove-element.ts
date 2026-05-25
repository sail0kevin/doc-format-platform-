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
