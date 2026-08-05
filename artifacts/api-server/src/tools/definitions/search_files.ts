// ── Tool: search_files ────────────────────────────────────────────────────────
//
// Recursively searches for files whose names match a query string (case-insensitive
// substring match) within the workspace, optionally scoped to a subdirectory.
// Path validation and workspace scoping are enforced via validatePath / WORKSPACE_ROOT.

import fs from "fs";
import path from "path";
import { validatePath, toRelative, WORKSPACE_ROOT } from "../../workspace/safety.js";
import { WorkspaceError } from "../../workspace/types.js";
import type { ToolDefinition } from "../types.js";

// ── Directories skipped during traversal ─────────────────────────────────────

const SKIP_DIRS = new Set([".git", "node_modules", ".cache", "dist", ".next"]);

// ── Match result ──────────────────────────────────────────────────────────────

export interface SearchMatch {
  /** Workspace-relative path of the matching file. */
  relativePath: string;
  /** File name (basename). */
  name: string;
  /** File size in bytes. */
  size: number;
  /** Last-modified timestamp (ISO 8601). */
  lastModified: string;
}

// ── Tool I/O ──────────────────────────────────────────────────────────────────

export interface SearchFilesInput extends Record<string, unknown> {
  /** Case-insensitive substring to match against file names. */
  query: string;
  /**
   * Workspace-relative path to the directory to search within.
   * Defaults to the workspace root when omitted.
   */
  path?: string;
}

export interface SearchFilesOutput {
  /** Files whose names contain the query string. */
  matches: SearchMatch[];
  /** Total number of matching files. */
  total: number;
}

// ── Recursive walk ────────────────────────────────────────────────────────────

function walk(dir: string, lowerQuery: string, results: SearchMatch[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // skip unreadable directories silently
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walk(path.join(dir, entry.name), lowerQuery, results);
      }
    } else if (entry.isFile()) {
      if (entry.name.toLowerCase().includes(lowerQuery)) {
        const absPath = path.join(dir, entry.name);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(absPath);
        } catch {
          continue;
        }
        results.push({
          relativePath: toRelative(absPath),
          name: entry.name,
          size: stat.size,
          lastModified: stat.mtime.toISOString(),
        });
      }
    }
  }
}

// ── Tool definition ───────────────────────────────────────────────────────────

export const searchFilesTool: ToolDefinition<SearchFilesInput, SearchFilesOutput> = {
  name: "search_files",
  description:
    "Search for files by name within the workspace. " +
    "Performs a case-insensitive substring match against file names (not content). " +
    "Accepts an optional path to limit the search to a subdirectory; " +
    "defaults to the workspace root. " +
    "Skips .git, node_modules, dist, .cache, and .next directories.",

  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Case-insensitive substring to match against file names.",
      },
      path: {
        type: "string",
        description:
          "Workspace-relative path to the directory to search (e.g. \"src\"). " +
          "Omit to search the entire workspace.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },

  execute({ query, path: userPath }): SearchFilesOutput {
    if (!query.trim()) {
      throw new WorkspaceError(
        "query must be a non-empty string",
        "not_found"
      );
    }

    const rootAbs = userPath ? validatePath(userPath) : WORKSPACE_ROOT;

    // Ensure the resolved path is actually a directory
    let stat: fs.Stats;
    try {
      stat = fs.statSync(rootAbs);
    } catch {
      throw new WorkspaceError(`Not found: ${userPath ?? "."}`, "not_found");
    }
    if (!stat.isDirectory()) {
      throw new WorkspaceError(
        `Not a directory: ${userPath ?? "."}`,
        "not_a_directory"
      );
    }

    const matches: SearchMatch[] = [];
    walk(rootAbs, query.toLowerCase(), matches);

    // Sort results alphabetically by relative path for stable output
    matches.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    return { matches, total: matches.length };
  },
};
