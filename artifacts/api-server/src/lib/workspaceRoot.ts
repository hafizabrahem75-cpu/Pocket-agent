import path from "path";
import fs from "fs";

// ── Workspace root detection ──────────────────────────────────────────────────
// Walk up from `startDir` looking for a pnpm-workspace.yaml or a package.json
// with a "workspaces" field. This makes the workspace root stable regardless of
// which sub-package the server runs from inside a monorepo.

export function findWorkspaceRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;

    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.workspaces) return dir;
      } catch { /* malformed JSON — keep walking */ }
    }

    const parent = path.dirname(dir);
    if (parent === dir) return startDir; // reached filesystem root
    dir = parent;
  }
}

/** Absolute path to the monorepo/project root. Resolved once at startup. */
export const WORKSPACE_ROOT: string = findWorkspaceRoot(process.cwd());
