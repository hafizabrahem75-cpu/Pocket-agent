import { z } from "zod";
import type { ITool, ToolResult } from "./types.js";
import {
  readFile,
  writeFile,
  deleteFile,
  createDir,
  deleteDir,
  moveItem,
  listDir,
} from "../../workspace/service.js";
import { WorkspaceError } from "../../workspace/types.js";

// ── Workspace Tools ────────────────────────────────────────────────────────────
//
// Each tool wraps a workspace service function. The AI emits a tool-call
// directive; the tool validates args via Zod, then delegates to the safe
// workspace service. The AI never touches the filesystem.

function handleError(err: unknown): ToolResult {
  if (err instanceof WorkspaceError) {
    return { ok: false, message: `${err.code}: ${err.message}` };
  }
  const msg = err instanceof Error ? err.message : "Unexpected error";
  return { ok: false, message: msg };
}

// ── read_file ─────────────────────────────────────────────────────────────────

export class ReadFileTool implements ITool {
  readonly name = "read_file";
  readonly description =
    "Read the content of a text file in the workspace. Returns the file content, size, and metadata.";
  readonly params = z.object({
    path: z.string().min(1).describe("Relative path from workspace root, e.g. 'src/index.ts'"),
  });

  execute(params: z.infer<typeof this.params>): ToolResult {
    try {
      const result = readFile(params.path);
      return {
        ok: true,
        message: `Read ${result.path} (${result.size} bytes)`,
        data: result,
      };
    } catch (err) {
      return handleError(err);
    }
  }
}

// ── write_file ────────────────────────────────────────────────────────────────

export class WriteFileTool implements ITool {
  readonly name = "write_file";
  readonly description =
    "Create or overwrite a file in the workspace. Parent directories are created automatically.";
  readonly params = z.object({
    path: z.string().min(1).describe("Relative path from workspace root"),
    content: z.string().describe("Full file content to write"),
  });

  execute(params: z.infer<typeof this.params>): ToolResult {
    try {
      const result = writeFile(params.path, params.content, {
        overwrite: true,
        createParents: true,
      });
      return {
        ok: true,
        message: `${result.created ? "Created" : "Updated"} ${result.path} (${result.size} bytes)`,
        data: result,
      };
    } catch (err) {
      return handleError(err);
    }
  }
}

// ── delete_file ───────────────────────────────────────────────────────────────

export class DeleteFileTool implements ITool {
  readonly name = "delete_file";
  readonly description = "Delete a single file from the workspace.";
  readonly params = z.object({
    path: z.string().min(1).describe("Relative path from workspace root"),
  });

  execute(params: z.infer<typeof this.params>): ToolResult {
    try {
      const result = deleteFile(params.path);
      return {
        ok: true,
        message: `Deleted ${result.path}`,
        data: result,
      };
    } catch (err) {
      return handleError(err);
    }
  }
}

// ── list_dir ──────────────────────────────────────────────────────────────────

export class ListDirTool implements ITool {
  readonly name = "list_dir";
  readonly description =
    "List the entries of a directory in the workspace (non-recursive). Returns file and directory names with metadata.";
  readonly params = z.object({
    path: z.string().default(".").describe("Relative directory path from workspace root. Use '.' for root."),
  });

  execute(params: z.infer<typeof this.params>): ToolResult {
    try {
      const result = listDir(params.path);
      return {
        ok: true,
        message: `Listed ${result.path} (${result.entries.length} entries)`,
        data: result,
      };
    } catch (err) {
      return handleError(err);
    }
  }
}

// ── create_dir ─────────────────────────────────────────────────────────────────

export class CreateDirTool implements ITool {
  readonly name = "create_dir";
  readonly description = "Create a directory in the workspace (and any missing parents).";
  readonly params = z.object({
    path: z.string().min(1).describe("Relative directory path from workspace root"),
  });

  execute(params: z.infer<typeof this.params>): ToolResult {
    try {
      const result = createDir(params.path);
      return {
        ok: true,
        message: `${result.alreadyExisted ? "Directory already existed" : "Created directory"}: ${result.path}`,
        data: result,
      };
    } catch (err) {
      return handleError(err);
    }
  }
}

// ── delete_dir ────────────────────────────────────────────────────────────────

export class DeleteDirTool implements ITool {
  readonly name = "delete_dir";
  readonly description = "Delete a directory from the workspace. Use recursive: true for non-empty directories.";
  readonly params = z.object({
    path: z.string().min(1).describe("Relative directory path from workspace root"),
    recursive: z.boolean().optional().default(false).describe("Allow deleting non-empty directories"),
  });

  execute(params: z.infer<typeof this.params>): ToolResult {
    try {
      const result = deleteDir(params.path, { recursive: params.recursive });
      return {
        ok: true,
        message: `Deleted directory ${result.path}`,
        data: result,
      };
    } catch (err) {
      return handleError(err);
    }
  }
}

// ── move_item ──────────────────────────────────────────────────────────────────

export class MoveItemTool implements ITool {
  readonly name = "move_item";
  readonly description =
    "Move or rename a file/directory in the workspace. If the destination is an existing directory, the item is moved inside it.";
  readonly params = z.object({
    from: z.string().min(1).describe("Relative source path from workspace root"),
    to: z.string().min(1).describe("Relative destination path from workspace root"),
  });

  execute(params: z.infer<typeof this.params>): ToolResult {
    try {
      const result = moveItem(params.from, params.to);
      return {
        ok: true,
        message: `Moved ${result.from} to ${result.to}`,
        data: result,
      };
    } catch (err) {
      return handleError(err);
    }
  }
}
