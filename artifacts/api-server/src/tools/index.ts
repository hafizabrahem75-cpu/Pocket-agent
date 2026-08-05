// ── Tool Registry — Public API ────────────────────────────────────────────────
//
// Builds and exports the default ToolRegistry pre-loaded with all built-in
// tools. Import `toolRegistry` anywhere in the server that needs to look up
// or enumerate tools.

import { ToolRegistry } from "./types.js";
import { readFileTool } from "./definitions/read_file.js";
import { writeFileTool } from "./definitions/write_file.js";
import { analyzeProjectTool } from "./definitions/analyze_project.js";

export { ToolRegistry } from "./types.js";
export type { ToolDefinition, JsonSchema, JsonSchemaProperty } from "./types.js";
export type { ReadFileInput } from "./definitions/read_file.js";
export type { WriteFileInput } from "./definitions/write_file.js";
export type { AnalyzeProjectInput, AnalyzeProjectOutput } from "./definitions/analyze_project.js";

// ── Default registry ───────────────────────────────────────────────────────────

const toolRegistry = new ToolRegistry();

toolRegistry.register(readFileTool);
toolRegistry.register(writeFileTool);
toolRegistry.register(analyzeProjectTool);

export { toolRegistry };
