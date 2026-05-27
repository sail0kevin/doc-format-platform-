import { Tool, ToolResult, ToolContext } from "./types";

/**
 * set_raw_text：将文字内容写入文档输入框，替换当前全部内容。
 * 用户在聊天里粘贴的文字，或要求"放到文档里"时使用。
 */
export const setRawText: Tool = {
  name: "set_raw_text",
  description: "将文字内容设置到文档输入框中，替换当前全部内容。用户在聊天中粘贴的文字可通过此工具写入文档",
  parameters: [
    { name: "text", description: "要写入文档的文字内容", required: true, type: "string" },
  ],
  async execute(args: Record<string, any>, _context: ToolContext): Promise<ToolResult> {
    const text = String(args.text || "");
    if (!text.trim()) return { message: "文字内容不能为空" };
    return {
      message: `已写入 ${text.length} 个字符到文档输入框`,
      data: { text, length: text.length, lines: text.split("\n").filter(Boolean).length },
    };
  },
};
