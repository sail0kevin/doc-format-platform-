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
