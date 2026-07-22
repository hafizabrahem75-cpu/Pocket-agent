import type { ITool } from "./types.js";

// ── Tool Registry ─────────────────────────────────────────────────────────────
//
// Central registry of all tools available to the AI. Tools are registered once
// at module load time and looked up by name during execution.
//
// To add a new tool:
//   import { MyTool } from "./tools/my-tool.js";
//   register(new MyTool());
//
// The registry is modular — future project types (e.g. GitHub-imported repos)
// can register different tool sets by adding their tools here or by creating
// a separate registry instance.

const registry = new Map<string, ITool>();

export function register(tool: ITool): void {
  if (registry.has(tool.name)) {
    throw new Error(`Tool "${tool.name}" is already registered`);
  }
  registry.set(tool.name, tool);
}

export function getTool(name: string): ITool | undefined {
  return registry.get(name);
}

export function getAllTools(): ITool[] {
  return [...registry.values()];
}

export function isKnownTool(name: string): boolean {
  return registry.has(name);
}
