export class ToolRegistry {
    adapters = new Map();
    tools = new Map();
    register(adapter) {
        this.adapters.set(adapter.name, adapter);
        // Register all tools from this adapter
        adapter.tools.forEach((tool) => {
            this.tools.set(tool.name, tool);
        });
    }
    getTool(name) {
        return this.tools.get(name);
    }
    getAllTools() {
        return Array.from(this.tools.values());
    }
    getAdapter(name) {
        return this.adapters.get(name);
    }
    getAllAdapters() {
        return Array.from(this.adapters.values());
    }
}
export const toolRegistry = new ToolRegistry();
