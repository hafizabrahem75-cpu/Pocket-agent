// ── Tool: read_file ───────────────────────────────────────────────────────────
//
// Reads a text file from the workspace and returns its content.
// Delegates all path validation and safety checks to the workspace service.

import { readFile as wsReadFile } from "../../workspace/service.js";
import type { FileContent } from "../../workspace/types.js";
import type { ToolDefinition } from "../types.js";

export interface ReadFileInput extends Record<string, unknown> {
  /** Workspace-relative path to the file (e.g. "src/index.ts"). */
  path: string;
}

export const readFileTool: ToolDefinition<ReadFileInput, FileContent> = {
  name: "read_file",
  description:
    "Read the text content of a file in the workspace. " +
    "Returns the file content, size, MIME type, and last-modified timestamp. " +
    "Binary files and files larger than 5 MB are rejected.",

  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Workspace-relative path to the file to read (e.g. \"src/index.ts\").",
      },
    },
    required: ["path"],
    additionalProperties: false,
  },

  execute({ path }): FileContent {
    return wsReadFile(path);
  },
};
