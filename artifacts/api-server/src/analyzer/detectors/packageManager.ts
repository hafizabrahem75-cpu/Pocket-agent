import fs from "fs";
import path from "path";
import type { PackageManagerInfo, PackageManagerName } from "../types.js";

// ── Detection rules (checked in priority order) ───────────────────────────────

interface Rule {
  file: string;
  name: PackageManagerName;
  isLockFile: boolean;
}

const RULES: Rule[] = [
  { file: "pnpm-lock.yaml",    name: "pnpm",  isLockFile: true },
  { file: "bun.lockb",         name: "bun",   isLockFile: true },
  { file: "bun.lock",          name: "bun",   isLockFile: true },
  { file: "yarn.lock",         name: "yarn",  isLockFile: true },
  { file: "package-lock.json", name: "npm",   isLockFile: true },
  // Non-JS package managers
  { file: "Cargo.toml",        name: "cargo", isLockFile: false },
  { file: "go.mod",            name: "go",    isLockFile: false },
  { file: "pubspec.yaml",      name: "pub",   isLockFile: false },
  { file: "pyproject.toml",    name: "poetry", isLockFile: false },
  { file: "requirements.txt",  name: "pip",   isLockFile: false },
  { file: "pom.xml",           name: "maven", isLockFile: false },
  { file: "build.gradle",      name: "gradle", isLockFile: false },
  { file: "build.gradle.kts",  name: "gradle", isLockFile: false },
];

// ── Workspace file indicators ─────────────────────────────────────────────────

const WORKSPACE_FILES: Record<string, string> = {
  "pnpm-workspace.yaml": "pnpm-workspace.yaml",
  "lerna.json":          "lerna.json",
  "turbo.json":          "turbo.json",
  "nx.json":             "nx.json",
};

function exists(filePath: string): boolean {
  try { fs.accessSync(filePath, fs.constants.F_OK); return true; }
  catch { return false; }
}

function isMonorepo(rootPath: string, pkgMgr: PackageManagerName): boolean {
  // Explicit workspace files
  for (const file of Object.keys(WORKSPACE_FILES)) {
    if (exists(path.join(rootPath, file))) return true;
  }
  // pnpm is almost always a monorepo if it has a workspace yaml
  if (pkgMgr === "pnpm" && exists(path.join(rootPath, "pnpm-workspace.yaml")))
    return true;
  // yarn / npm workspaces: check package.json for "workspaces" key
  const pkgPath = path.join(rootPath, "package.json");
  if (exists(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.workspaces) return true;
    } catch { /* ignore */ }
  }
  return false;
}

// ── Main detector ─────────────────────────────────────────────────────────────

export function detectPackageManager(rootPath: string): PackageManagerInfo {
  for (const rule of RULES) {
    const filePath = path.join(rootPath, rule.file);
    if (exists(filePath)) {
      const pkgMgr = rule.name;
      const workspaceFile = Object.keys(WORKSPACE_FILES).find((f) =>
        exists(path.join(rootPath, f))
      );
      return {
        name: pkgMgr,
        lockFile: rule.isLockFile ? rule.file : undefined,
        workspaceFile,
        isMonorepo: isMonorepo(rootPath, pkgMgr),
      };
    }
  }

  // Fallback: package.json with no lock file → assume npm
  if (exists(path.join(rootPath, "package.json"))) {
    return { name: "npm", isMonorepo: false };
  }

  return { name: "unknown", isMonorepo: false };
}
