export interface ToolParameter {
  name: string;
  description: string;
  required: boolean;
  type: "string" | "number" | "boolean";
}

export interface ToolResult {
  message: string;
  data?: Record<string, unknown>;
}

export interface ToolContext {
  elements: Array<{
    id: string;
    label: string;
    type: "heading" | "body";
    wordStyles: string[];
    config: Record<string, string | boolean>;
  }>;
  pageMargins: Record<string, string>;
  headerConfig: {
    showHeader: boolean;
    text: string;
    useChapterHeader: boolean;
    showPageNumber: boolean;
    pageNumberAlign: string;
  };
  preset: string;
  canUndo: boolean;
  canRedo: boolean;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult>;
}

export interface ToolCallRecord {
  toolName: string;
  args: Record<string, any>;
  result: ToolResult;
}
