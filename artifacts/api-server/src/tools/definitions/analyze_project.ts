// ── Tool: analyze_project ─────────────────────────────────────────────────────
//
// Analyzes a project directory and returns its type, detected frameworks,
// package manager, and a human-readable summary.
// Delegates to the existing analyzeProject() function in the analyzer module.

import { analyzeProject } from "../../analyzer/index.js";
import type {
  ProjectType,
  PackageManagerInfo,
  DetectedFramework,
} from "../../analyzer/types.js";
import type { ToolDefinition } from "../types.js";

export interface AnalyzeProjectInput extends Record<string, unknown> {
  /**
   * Workspace-relative or absolute path to the directory to analyze.
   * Defaults to the workspace root when omitted.
   */
  path?: string;
}

export interface AnalyzeProjectOutput {
  projectType: ProjectType;
  frameworks: DetectedFramework[];
  packageManager: PackageManagerInfo;
  summary: string;
}

export const analyzeProjectTool: ToolDefinition<
  AnalyzeProjectInput,
  AnalyzeProjectOutput
> = {
  name: "analyze_project",
  description:
    "Analyze a project directory and return its type, detected frameworks, " +
    "package manager, and a human-readable summary. " +
    "Accepts an optional path (workspace-relative or absolute); " +
    "defaults to the workspace root when omitted.",

  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Workspace-relative or absolute path to the directory to analyze " +
          "(e.g. \"artifacts/pocket-agent-ui\"). Omit to analyze the workspace root.",
      },
    },
    required: [],
    additionalProperties: false,
  },

  async execute({ path }): Promise<AnalyzeProjectOutput> {
    const analysis = await analyzeProject({ rootPath: path });
    return {
      projectType: analysis.projectType,
      frameworks: analysis.frameworks,
      packageManager: analysis.packageManager,
      summary: analysis.summary,
    };
  },
};
