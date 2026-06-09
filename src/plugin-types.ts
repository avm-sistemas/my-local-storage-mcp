export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type RecallFormat = "full" | "compact";

export interface RecallOptions {
  type_filter?: string;
  format?:      RecallFormat;
  max_chars?:   number;
  limit?:       number;
}

export interface RecallContext {
  query: string;
  recallText: string;
  format: RecallFormat;
}

export interface PluginHostContext {
  executeRecall: (
    whereClause: string,
    params: unknown[],
    options: RecallOptions
  ) => Promise<string>;
}

export interface McpToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface McpPlugin {
  readonly name: string;
  init(env: NodeJS.ProcessEnv, host?: PluginHostContext): Promise<boolean>;
  getTools(): ToolDefinition[];
  handleTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<McpToolResult | null>;
  afterRecall?(ctx: RecallContext): Promise<string | undefined>;
}
