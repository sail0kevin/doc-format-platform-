import { Tool } from "./types";
import { applyPreset } from "./apply-preset";
import { addElement } from "./add-element";
import { removeElement } from "./remove-element";
import { updateConfig } from "./update-config";
import { setMargins } from "./set-margins";
import { undo, redo } from "./undo-redo";
import { suggestFormat } from "./suggest-format";

export const allTools: Tool[] = [
  applyPreset, addElement, removeElement, updateConfig,
  setMargins, undo, redo, suggestFormat,
];

export function buildToolMap(tools: Tool[]): Map<string, Tool> {
  const map = new Map<string, Tool>();
  for (const t of tools) map.set(t.name, t);
  return map;
}
