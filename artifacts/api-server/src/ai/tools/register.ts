import { register } from "./registry.js";
import { ReadFileTool, WriteFileTool, DeleteFileTool, ListDirTool, CreateDirTool, DeleteDirTool, MoveItemTool } from "./workspace-tools.js";

// ── Tool Registration ─────────────────────────────────────────────────────────
//
// Registers all built-in workspace tools. This runs once at module load.
// Future project types (e.g. GitHub-imported repos) can add their own tools
// by importing this module and calling register() with additional tools,
// or by creating a separate registry instance.

let registered = false;

export function registerWorkspaceTools(): void {
  if (registered) return;
  register(new ReadFileTool());
  register(new WriteFileTool());
  register(new DeleteFileTool());
  register(new ListDirTool());
  register(new CreateDirTool());
  register(new DeleteDirTool());
  register(new MoveItemTool());
  registered = true;
}

// Auto-register on import
registerWorkspaceTools();
