import { Tool, ToolResult, ToolContext } from "./types";

export const cleanupElements: Tool = {
  name: "cleanup_elements",
  description: "清理未使用的元素。删除当前文档中没有用到的标题或正文元素，只保留实际使用中的。如果 keepAll=true 则保留全部（不做删除）",
  parameters: [
    { name: "keepAll", description: "是否保留全部元素(true/false)，默认false", required: false, type: "string" },
  ],
  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const keepAll = String(args.keepAll || "false").toLowerCase() === "true";
    if (keepAll) return { message: "已保留全部元素，未做删除" };

    const usedIds = new Set(context.usedElementIds);
    const unused = context.elements.filter(e => !usedIds.has(e.id));

    if (unused.length === 0) return { message: "所有元素都在使用中，无需清理" };

    return {
      message: `将删除以下未使用的元素：${unused.map(e => e.label).join("、")}`,
      data: { action: "remove", unusedIds: unused.map(e => e.id) },
    };
  },
};
