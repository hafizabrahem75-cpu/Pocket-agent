import path from "path";
import { WORKSPACE_ROOT } from "../lib/workspaceRoot.js";
import { WorkspaceError } from "./types.js";

// ── Protected paths (writes blocked, reads allowed) ───────────────────────────

const WRITE_BLOCKED_SEGMENTS = new Set([
  ".git",
  "node_modules",
]);

// Files/dirs that cannot be deleted or moved regardless of operation
const ALWAYS_PROTECTED = new Set([
  "pnpm-workspace.yaml",
  "package.json",      // root-level only — checked separately
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function containsBlockedSegment(segments: string[]): string | null {
  for (const seg of segments) {
    if (WRITE_BLOCKED_SEGMENTS.has(seg)) return seg;
  }
  return null;
}

// ── Core validator ────────────────────────────────────────────────────────────

export interface ValidateOptions {
  /** Reject paths that land inside write-blocked directories (default: false) */
  requireWritable?: boolean;
  /** Reject paths that are the workspace root itself (default: false) */
  rejectRoot?: boolean;
}

/**
 * Validates a user-supplied path and returns the safe absolute path.
 *
 * Rules enforced:
 *  1. No null bytes
 *  2. Must be relative (no leading /)
 *  3. Resolved absolute path must be inside WORKSPACE_ROOT
 *  4. If requireWritable: must not be inside .git or node_modules
 *  5. If rejectRoot: must not equal WORKSPACE_ROOT itself
 *
 * @throws WorkspaceError with a descriptive code on any violation
 */
export function validatePath(
  userPath: string,
  options: ValidateOptions = {}
): string {
  const { requireWritable = false, rejectRoot = false } = options;

  // 1. Reject null bytes (classic shell injection vector)
  if (userPath.includes("\0")) {
    throw new WorkspaceError("Path contains null bytes", "path_traversal");
  }

  // 2. Normalise separators; reject obviously absolute paths
  const normalised = userPath.replace(/\\/g, "/").trim();
  if (path.isAbsolute(normalised)) {
    throw new WorkspaceError(
      "Absolute paths are not allowed — use a path relative to the workspace root",
      "outside_workspace"
    );
  }

  // 3. Resolve and sandbox
  const resolved = path.resolve(WORKSPACE_ROOT, normalised);

  // Must equal the root OR be strictly inside it (root + sep prefix)
  const inside =
    resolved === WORKSPACE_ROOT ||
    resolved.startsWith(WORKSPACE_ROOT + path.sep);

  if (!inside) {
    throw new WorkspaceError(
      "Path escapes the workspace root — directory traversal is not allowed",
      "path_traversal"
    );
  }

  // 4. Reject root itself when requested (e.g. delete / move operations)
  if (rejectRoot && resolved === WORKSPACE_ROOT) {
    throw new WorkspaceError(
      "Cannot operate on the workspace root itself",
      "protected_path"
    );
  }

  // 5. Write-protection check
  if (requireWritable) {
    const relative = path.relative(WORKSPACE_ROOT, resolved);
    const segments = relative.split(path.sep);
    const blocked = containsBlockedSegment(segments);
    if (blocked) {
      throw new WorkspaceError(
        `Path is inside a protected directory: ${blocked}`,
        "protected_path"
      );
    }

    // Block mutations to the root-level workspace manifest
    if (segments.length === 1 && ALWAYS_PROTECTED.has(segments[0])) {
      throw new WorkspaceError(
        `"${segments[0]}" is a protected file and cannot be modified through the workspace API`,
        "protected_path"
      );
    }
  }

  return resolved;
}

/** Convert an absolute path back to a workspace-relative path for API responses. */
export function toRelative(absolutePath: string): string {
  return path.relative(WORKSPACE_ROOT, absolutePath);
}

/** Expose the root so service/route layers can use it without re-importing. */
export { WORKSPACE_ROOT };
