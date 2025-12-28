import { Adapter, AdapterRegistry, Tool } from "./adapter.js";

export class ToolRegistry implements AdapterRegistry {
  public adapters = new Map<string, Adapter>();
  private tools = new Map<string, Tool>();

  register(adapter: Adapter): void {
    this.adapters.set(adapter.name, adapter);
    
    // Register all tools from this adapter
    adapter.tools.forEach((tool: Tool) => {
      this.tools.set(tool.name, tool);
    });
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getAdapter(name: string): Adapter | undefined {
    return this.adapters.get(name);
  }

  getAllAdapters(): Adapter[] {
    return Array.from(this.adapters.values());
  }
}

export const toolRegistry = new ToolRegistry();
