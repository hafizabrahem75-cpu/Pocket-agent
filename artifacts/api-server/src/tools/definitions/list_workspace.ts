// ── Tool: list_workspace ──────────────────────────────────────────────────────
//
// Lists the contents of a workspace directory, returning directories and files
// as separate arrays with a combined total count.
// Delegates all path validation and safety checks to the workspace service.

import { listDir } from "../../workspace/service.js";
import type { DirEntry } from "../../workspace/types.js";
import type { ToolDefinition } from "../types.js";

export interface ListWorkspaceInput extends Record<string, unknown> {
  /**
   * Workspace-relative path to the directory to list (e.g. "src").
   * Defaults to the workspace root when omitted.
   */
  path?: string;
}

export interface ListWorkspaceOutput {
  /** Entries whose type is "directory", sorted alphabetically. */
  directories: DirEntry[];
  /** Entries whose type is "file", sorted alphabetically. */
  files: DirEntry[];
  /** Total number of entries (directories + files). */
  total: number;
}

export const listWorkspaceTool: ToolDefinition<
  ListWorkspaceInput,
  ListWorkspaceOutput
> = {
  name: "list_workspace",
  description:
    "List the immediate contents of a workspace directory. " +
    "Returns directories and files as separate arrays, plus a total count. " +
    "Accepts an optional workspace-relative path; defaults to the workspace root. " +
    "Protected paths (e.g. .git/) and paths outside the workspace are rejected.",

  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Workspace-relative path to the directory to list (e.g. \"src\"). " +
          "Omit to list the workspace root.",
      },
    },
    required: [],
    additionalProperties: false,
  },

  execute({ path }): ListWorkspaceOutput {
    const listing = listDir(path ?? ".");
    const directories = listing.entries.filter((e) => e.type === "directory");
    const files = listing.entries.filter((e) => e.type === "file");
    return {
      directories,
      files,
      total: listing.entries.length,
    };
  },
};
