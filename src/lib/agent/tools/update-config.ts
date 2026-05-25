import { Tool, ToolResult, ToolContext } from "./types";

export const updateConfig: Tool = {
  name: "update_config",
  description: "修改某个文档元素的配置项。一次只改一个配置项。配置项：font(字体), size(字号pt), bold(是否加粗true/false), align(对齐left/center/right/justify), space_before(段前距pt), space_after(段后距pt), line_spacing(行间距倍数), color(6位十六进制色码), first_line_indent(首行缩进cm)",
  parameters: [
    { name: "elementId", description: "元素 ID", required: true, type: "string" },
    { name: "key", description: "配置项名称", required: true, type: "string" },
    { name: "value", description: "配置值", required: true, type: "string" },
  ],
  async execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const elementId = String(args.elementId || "");
    const key = String(args.key || "");
    const value = String(args.value ?? "");
    const target = context.elements.find((e) => e.id === elementId);
    if (!target) return { message: `未找到元素"${elementId}"` };
    const validKeys = ["font", "size", "bold", "align", "space_before", "space_after", "line_spacing", "color", "first_line_indent"];
    if (!validKeys.includes(key)) return { message: `无效配置项"${key}"` };
    if (key === "align" && !["left", "center", "right", "justify"].includes(value)) return { message: `对齐方式必须是 left/center/right/justify` };
    if ((key === "size" || key === "space_before" || key === "space_after") && (isNaN(Number(value)) || Number(value) <= 0)) return { message: `${key} 必须为正数` };
    return { message: `已将"${target.label}"的${key}设为${value}`, data: { elementId, key, value } };
  },
};
