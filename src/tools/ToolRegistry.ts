import { Tool } from "../types/tools";

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name:string): Tool | undefined {
    return this.tools.get(name);
  }

  getToolDefinitions(): any[] {
    const definitions: any[] = [];
    for (const tool of this.tools.values()) {
      definitions.push({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      });
    }
    return definitions;
  }
}
