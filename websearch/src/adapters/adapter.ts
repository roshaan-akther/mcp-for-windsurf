import { z } from "zod";

export interface Tool {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handler: (args: any) => Promise<any>;
}

export interface Adapter {
  name: string;
  description: string;
  tools: Tool[];
}

export interface AdapterRegistry {
  adapters: Map<string, Adapter>;
  register(adapter: Adapter): void;
  getTool(name: string): Tool | undefined;
  getAllTools(): Tool[];
}
