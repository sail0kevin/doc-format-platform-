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
