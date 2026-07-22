// ── Workspace Service — Shared Types ─────────────────────────────────────────

// ── Directory listing ─────────────────────────────────────────────────────────

export interface DirEntry {
  name: string;
  /** Path relative to the workspace root */
  relativePath: string;
  type: "file" | "directory";
  /** File size in bytes (files only) */
  size?: number;
  extension?: string;
  lastModified: string; // ISO 8601
}

export interface DirListing {
  /** Relative path that was listed */
  path: string;
  entries: DirEntry[];
}

// ── File content ──────────────────────────────────────────────────────────────

export interface FileContent {
  /** Relative path from workspace root */
  path: string;
  content: string;
  encoding: "utf-8";
  /** File size in bytes */
  size: number;
  lastModified: string; // ISO 8601
  mimeType: string;
}

// ── Operation results ─────────────────────────────────────────────────────────

export interface WriteResult {
  path: string;
  /** true = newly created, false = overwritten */
  created: boolean;
  size: number;
}

export interface DeleteResult {
  path: string;
  type: "file" | "directory";
}

export interface MoveResult {
  from: string;
  to: string;
}

export interface MkdirResult {
  path: string;
  /** true if the directory already existed */
  alreadyExisted: boolean;
}

// ── Error helpers ─────────────────────────────────────────────────────────────

export class WorkspaceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "path_traversal"
      | "outside_workspace"
      | "not_found"
      | "already_exists"
      | "not_a_file"
      | "not_a_directory"
      | "binary_file"
      | "file_too_large"
      | "protected_path"
      | "dir_not_empty"
      | "io_error"
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}
