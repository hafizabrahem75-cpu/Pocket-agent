import fs from "fs";
import path from "path";
import { validatePath, toRelative, WORKSPACE_ROOT } from "./safety.js";
import {
  WorkspaceError,
  type FileContent,
  type WriteResult,
  type DeleteResult,
  type MoveResult,
  type MkdirResult,
  type DirListing,
  type DirEntry,
} from "./types.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_READ_BYTES = 5 * 1024 * 1024; // 5 MB

// Extensions we treat as text (everything else = binary → rejected)
const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "json", "jsonc", "json5",
  "yaml", "yml", "toml",
  "md", "mdx", "txt", "csv", "tsv",
  "html", "htm", "xml", "svg",
  "css", "scss", "sass", "less",
  "sh", "bash", "zsh", "fish",
  "py", "rb", "rs", "go", "java", "kt", "dart", "swift", "c", "cpp", "h", "hpp",
  "sql", "prisma", "graphql", "gql",
  "env", "gitignore", "prettierrc", "eslintrc", "editorconfig",
  "lock",          // lock files (text)
  "map",           // source maps
  "conf", "cfg", "ini",
]);

function isBinaryExtension(ext: string): boolean {
  if (!ext) return false; // no extension → assume text
  return !TEXT_EXTENSIONS.has(ext.toLowerCase());
}

function hasBinaryContent(buffer: Buffer): boolean {
  // Heuristic: null byte anywhere in first 8KB → binary
  const sample = buffer.slice(0, 8192);
  return sample.includes(0);
}

function guessMimeType(ext: string): string {
  const map: Record<string, string> = {
    ts: "text/typescript", tsx: "text/typescript",
    js: "text/javascript", jsx: "text/javascript", mjs: "text/javascript",
    json: "application/json", jsonc: "application/json",
    yaml: "text/yaml", yml: "text/yaml",
    md: "text/markdown", mdx: "text/markdown",
    html: "text/html", htm: "text/html",
    css: "text/css", scss: "text/css",
    svg: "image/svg+xml",
    xml: "application/xml",
    py: "text/x-python",
    sh: "text/x-sh",
    sql: "text/x-sql",
  };
  return map[ext.toLowerCase()] ?? "text/plain";
}

// ── Stat helpers ──────────────────────────────────────────────────────────────

function statOrNull(absPath: string): fs.Stats | null {
  try { return fs.statSync(absPath); }
  catch { return null; }
}

function assertExists(absPath: string, relPath: string): fs.Stats {
  const s = statOrNull(absPath);
  if (!s) throw new WorkspaceError(`Not found: ${relPath}`, "not_found");
  return s;
}

// ── Read file ─────────────────────────────────────────────────────────────────

export function readFile(userPath: string): FileContent {
  const absPath = validatePath(userPath);
  const stat = assertExists(absPath, userPath);

  if (!stat.isFile()) {
    throw new WorkspaceError(`Not a file: ${userPath}`, "not_a_file");
  }
  if (stat.size > MAX_READ_BYTES) {
    throw new WorkspaceError(
      `File too large: ${(stat.size / 1024 / 1024).toFixed(1)} MB (limit 5 MB)`,
      "file_too_large"
    );
  }

  const ext = path.extname(userPath).slice(1);
  if (isBinaryExtension(ext)) {
    throw new WorkspaceError(
      `Binary file type ".${ext}" is not supported — only text files can be read`,
      "binary_file"
    );
  }

  const buffer = fs.readFileSync(absPath);
  if (hasBinaryContent(buffer)) {
    throw new WorkspaceError(
      "File appears to be binary and cannot be read as text",
      "binary_file"
    );
  }

  const relPath = toRelative(absPath);
  return {
    path: relPath,
    content: buffer.toString("utf-8"),
    encoding: "utf-8",
    size: stat.size,
    lastModified: stat.mtime.toISOString(),
    mimeType: guessMimeType(ext),
  };
}

// ── Write file (create or update) ─────────────────────────────────────────────

export interface WriteOptions {
  /** If false, throws when the file already exists (default: true) */
  overwrite?: boolean;
  /** Create parent directories if they don't exist (default: true) */
  createParents?: boolean;
}

export function writeFile(
  userPath: string,
  content: string,
  options: WriteOptions = {}
): WriteResult {
  const { overwrite = true, createParents = true } = options;
  const absPath = validatePath(userPath, { requireWritable: true });

  const existing = statOrNull(absPath);
  if (existing?.isDirectory()) {
    throw new WorkspaceError(`Path is a directory: ${userPath}`, "not_a_file");
  }
  if (existing && !overwrite) {
    throw new WorkspaceError(`File already exists: ${userPath}`, "already_exists");
  }

  if (createParents) {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
  }

  const buf = Buffer.from(content, "utf-8");
  fs.writeFileSync(absPath, buf);

  return {
    path: toRelative(absPath),
    created: !existing,
    size: buf.length,
  };
}

// ── Delete file ───────────────────────────────────────────────────────────────

export function deleteFile(userPath: string): DeleteResult {
  const absPath = validatePath(userPath, { requireWritable: true, rejectRoot: true });
  const stat = assertExists(absPath, userPath);

  if (!stat.isFile()) {
    throw new WorkspaceError(`Not a file: ${userPath}`, "not_a_file");
  }

  fs.unlinkSync(absPath);
  return { path: toRelative(absPath), type: "file" };
}

// ── Create directory ──────────────────────────────────────────────────────────

export function createDir(userPath: string): MkdirResult {
  const absPath = validatePath(userPath, { requireWritable: true, rejectRoot: true });
  const existing = statOrNull(absPath);

  if (existing?.isFile()) {
    throw new WorkspaceError(`Path exists as a file: ${userPath}`, "not_a_directory");
  }

  const alreadyExisted = !!existing?.isDirectory();
  fs.mkdirSync(absPath, { recursive: true });

  return { path: toRelative(absPath), alreadyExisted };
}

// ── Delete directory ──────────────────────────────────────────────────────────

export interface DeleteDirOptions {
  /** Allow non-empty directories to be removed (default: false) */
  recursive?: boolean;
}

export function deleteDir(
  userPath: string,
  options: DeleteDirOptions = {}
): DeleteResult {
  const { recursive = false } = options;
  const absPath = validatePath(userPath, { requireWritable: true, rejectRoot: true });
  const stat = assertExists(absPath, userPath);

  if (!stat.isDirectory()) {
    throw new WorkspaceError(`Not a directory: ${userPath}`, "not_a_directory");
  }

  if (!recursive) {
    const entries = fs.readdirSync(absPath);
    if (entries.length > 0) {
      throw new WorkspaceError(
        `Directory is not empty: ${userPath} — pass recursive: true to force`,
        "dir_not_empty"
      );
    }
  }

  fs.rmSync(absPath, { recursive: true, force: false });
  return { path: toRelative(absPath), type: "directory" };
}

// ── Move / rename ─────────────────────────────────────────────────────────────

export function moveItem(fromUserPath: string, toUserPath: string): MoveResult {
  const fromAbs = validatePath(fromUserPath, { requireWritable: true, rejectRoot: true });
  const toAbs   = validatePath(toUserPath,   { requireWritable: true, rejectRoot: true });

  assertExists(fromAbs, fromUserPath);

  const dest = statOrNull(toAbs);
  // If destination is an existing directory, move source inside it
  const finalAbs = dest?.isDirectory()
    ? path.join(toAbs, path.basename(fromAbs))
    : toAbs;

  // Create parent dirs for the final destination
  fs.mkdirSync(path.dirname(finalAbs), { recursive: true });
  fs.renameSync(fromAbs, finalAbs);

  return {
    from: toRelative(fromAbs),
    to:   toRelative(finalAbs),
  };
}

// ── List directory ────────────────────────────────────────────────────────────

export function listDir(userPath: string = "."): DirListing {
  const absPath = validatePath(userPath);
  const stat = assertExists(absPath, userPath);

  if (!stat.isDirectory()) {
    throw new WorkspaceError(`Not a directory: ${userPath}`, "not_a_directory");
  }

  const names = fs.readdirSync(absPath);
  const entries: DirEntry[] = [];

  for (const name of names) {
    const childAbs = path.join(absPath, name);
    let childStat: fs.Stats | null;
    try { childStat = fs.statSync(childAbs); }
    catch { continue; }

    const isDir = childStat.isDirectory();
    const ext = isDir ? undefined : path.extname(name).slice(1) || undefined;

    entries.push({
      name,
      relativePath: toRelative(childAbs),
      type: isDir ? "directory" : "file",
      size: isDir ? undefined : childStat.size,
      extension: ext,
      lastModified: childStat.mtime.toISOString(),
    });
  }

  // Sort: directories first, then files, both alphabetical
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { path: toRelative(absPath), entries };
}
