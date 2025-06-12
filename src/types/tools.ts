export interface Tool {
  name: string;
  description: string;
  input_schema: object;
  execute: (args: any) => Promise<any>;
}

export interface FunctionCall {
  tool_name: string;
  arguments: any;
}
