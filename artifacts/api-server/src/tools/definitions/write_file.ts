// ── Tool: write_file ──────────────────────────────────────────────────────────
//
// Creates or overwrites a text file in the workspace.
// Delegates all path validation and safety checks to the workspace service.

import { writeFile as wsWriteFile } from "../../workspace/service.js";
import type { WriteResult } from "../../workspace/types.js";
import type { ToolDefinition } from "../types.js";

export interface WriteFileInput extends Record<string, unknown> {
  /** Workspace-relative path to write (e.g. "src/hello.ts"). */
  path: string;
  /** Text content to write. Must be valid UTF-8. */
  content: string;
  /**
   * Whether to overwrite an existing file.
   * Defaults to true. Pass false to fail if the file already exists.
   */
  overwrite?: boolean;
  /**
   * Whether to create missing parent directories automatically.
   * Defaults to true.
   */
  createParents?: boolean;
}

export const writeFileTool: ToolDefinition<WriteFileInput, WriteResult> = {
  name: "write_file",
  description:
    "Create or overwrite a text file in the workspace. " +
    "Returns the path, whether the file was newly created, and the byte size written. " +
    "Protected paths (e.g. .git/) and paths outside the workspace are rejected.",

  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Workspace-relative path for the file to write (e.g. \"src/hello.ts\").",
      },
      content: {
        type: "string",
        description: "UTF-8 text content to write to the file.",
      },
      overwrite: {
        type: "boolean",
        description:
          "Allow overwriting an existing file. Defaults to true.",
      },
      createParents: {
        type: "boolean",
        description:
          "Create any missing parent directories. Defaults to true.",
      },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },

  execute({ path, content, overwrite, createParents }): WriteResult {
    return wsWriteFile(path, content, { overwrite, createParents });
  },
};
