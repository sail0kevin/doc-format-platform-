import { Tool, ToolResult, ToolContext } from "./types";

export const applyPreset: Tool = {
  name: "apply_preset",
  description: "应用内置排版预设方案。可用的预设：essay(学术论文), report(商业报告), official(政府公文), novel(小说/散文)。调用后会同时修改所有文档元素的字体、字号、间距、页边距等配置。",
  parameters: [
    {
      name: "presetName",
      description: "预设名称，可选值：essay, report, official, novel",
      required: true,
      type: "string",
    },
  ],
  async execute(args: Record<string, any>, _context: ToolContext): Promise<ToolResult> {
    const presetName = String(args.presetName || "");
    const valid = ["essay", "report", "official", "novel"];
    if (!valid.includes(presetName)) {
      return { message: `无效预设"${presetName}"，可用：${valid.join("、")}` };
    }
    const labels: Record<string, string> = { essay: "学术论文", report: "商业报告", official: "政府公文", novel: "小说/散文" };
    return { message: `已选择「${labels[presetName] || presetName}」预设`, data: { presetName } };
  },
};
