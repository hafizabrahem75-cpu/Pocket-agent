import fs from "fs";
import path from "path";
import type { FileNode, FileImportance } from "../types.js";

// ── Directories to skip entirely ──────────────────────────────────────────────

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".svn", ".hg",
  "dist", "build", "out", ".next", ".nuxt", ".output",
  "__pycache__", ".mypy_cache", ".pytest_cache", ".ruff_cache",
  ".dart_tool", ".pub-cache", "target", "vendor",
  ".idea", ".vscode", ".fleet",
  "coverage", ".nyc_output",
  "ios/Pods", "android/.gradle", "android/build",
  ".tsbuildinfo",
]);

const SKIP_DIR_PATTERNS = [/^\./, /^__/];

// ── Important file registry ───────────────────────────────────────────────────

interface KnownFile {
  importance: FileImportance;
  role: string;
}

const KNOWN_FILES: Record<string, KnownFile> = {
  // Package / workspace
  "package.json":         { importance: "critical", role: "package manifest" },
  "pnpm-workspace.yaml":  { importance: "critical", role: "pnpm workspace config" },
  "pnpm-lock.yaml":       { importance: "high",     role: "pnpm lockfile" },
  "yarn.lock":            { importance: "high",     role: "yarn lockfile" },
  "package-lock.json":    { importance: "high",     role: "npm lockfile" },
  "bun.lockb":            { importance: "high",     role: "bun lockfile" },
  "bun.lock":             { importance: "high",     role: "bun lockfile" },

  // TypeScript / JavaScript config
  "tsconfig.json":        { importance: "critical", role: "TypeScript config" },
  "tsconfig.base.json":   { importance: "high",     role: "shared TypeScript config" },
  "jsconfig.json":        { importance: "high",     role: "JavaScript config" },

  // Build tools
  "vite.config.ts":       { importance: "critical", role: "Vite config" },
  "vite.config.js":       { importance: "critical", role: "Vite config" },
  "next.config.js":       { importance: "critical", role: "Next.js config" },
  "next.config.ts":       { importance: "critical", role: "Next.js config" },
  "nuxt.config.ts":       { importance: "critical", role: "Nuxt config" },
  "webpack.config.js":    { importance: "critical", role: "Webpack config" },
  "webpack.config.ts":    { importance: "critical", role: "Webpack config" },
  "rollup.config.js":     { importance: "high",     role: "Rollup config" },
  "esbuild.config.js":    { importance: "high",     role: "esbuild config" },
  "build.mjs":            { importance: "high",     role: "build script" },
  "turbo.json":           { importance: "high",     role: "Turborepo config" },

  // Framework / runtime
  "remix.config.js":      { importance: "critical", role: "Remix config" },
  "svelte.config.js":     { importance: "critical", role: "SvelteKit config" },
  "astro.config.mjs":     { importance: "critical", role: "Astro config" },
  "angular.json":         { importance: "critical", role: "Angular workspace" },
  "expo.config.js":       { importance: "critical", role: "Expo config" },
  "app.json":             { importance: "high",     role: "Expo/React Native app manifest" },
  "pubspec.yaml":         { importance: "critical", role: "Flutter/Dart manifest" },
  "Cargo.toml":           { importance: "critical", role: "Rust manifest" },
  "go.mod":               { importance: "critical", role: "Go module" },
  "pyproject.toml":       { importance: "critical", role: "Python project config" },
  "requirements.txt":     { importance: "critical", role: "Python dependencies" },
  "setup.py":             { importance: "high",     role: "Python package setup" },

  // Database / ORM
  "drizzle.config.ts":    { importance: "high",     role: "Drizzle ORM config" },
  "drizzle.config.js":    { importance: "high",     role: "Drizzle ORM config" },
  "prisma/schema.prisma": { importance: "critical", role: "Prisma schema" },
  "schema.prisma":        { importance: "critical", role: "Prisma schema" },

  // API spec
  "openapi.yaml":         { importance: "critical", role: "OpenAPI spec" },
  "openapi.json":         { importance: "critical", role: "OpenAPI spec" },
  "swagger.yaml":         { importance: "critical", role: "Swagger / OpenAPI spec" },
  "swagger.json":         { importance: "critical", role: "Swagger / OpenAPI spec" },

  // Environment / secrets
  ".env":                 { importance: "high",     role: "environment variables" },
  ".env.example":         { importance: "high",     role: "env template" },
  ".env.local":           { importance: "high",     role: "local environment overrides" },

  // Docker / infra
  "Dockerfile":           { importance: "high",     role: "Docker image definition" },
  "docker-compose.yml":   { importance: "high",     role: "Docker Compose config" },
  "docker-compose.yaml":  { importance: "high",     role: "Docker Compose config" },

  // CI / CD
  ".github/workflows":    { importance: "high",     role: "GitHub Actions workflows" },
  ".gitlab-ci.yml":       { importance: "high",     role: "GitLab CI config" },
  "Jenkinsfile":          { importance: "high",     role: "Jenkins pipeline" },

  // Linting / formatting
  ".eslintrc.js":         { importance: "medium",   role: "ESLint config" },
  ".eslintrc.json":       { importance: "medium",   role: "ESLint config" },
  "eslint.config.js":     { importance: "medium",   role: "ESLint config" },
  ".prettierrc":          { importance: "medium",   role: "Prettier config" },
  ".prettierrc.json":     { importance: "medium",   role: "Prettier config" },
  "biome.json":           { importance: "medium",   role: "Biome config" },

  // Docs
  "README.md":            { importance: "high",     role: "project readme" },
  "CHANGELOG.md":         { importance: "medium",   role: "changelog" },
  "replit.md":            { importance: "high",     role: "Replit project notes" },

  // Common entry points
  "src/index.ts":         { importance: "critical", role: "entry point" },
  "src/index.js":         { importance: "critical", role: "entry point" },
  "src/main.ts":          { importance: "critical", role: "entry point" },
  "src/main.tsx":         { importance: "critical", role: "entry point" },
  "src/app.ts":           { importance: "critical", role: "app bootstrap" },
  "src/App.tsx":          { importance: "critical", role: "root React component" },
  "src/App.jsx":          { importance: "critical", role: "root React component" },
  "src/server.ts":        { importance: "critical", role: "server entry" },
  "src/server.js":        { importance: "critical", role: "server entry" },
  "lib/main.dart":        { importance: "critical", role: "Flutter entry point" },
  "main.py":              { importance: "critical", role: "Python entry point" },
  "app.py":               { importance: "critical", role: "Python app entry" },
  "index.ts":             { importance: "high",     role: "module entry point" },
  "index.js":             { importance: "high",     role: "module entry point" },
};

// ── Pattern matchers for files not in the registry ───────────────────────────

function inferImportance(relativePath: string): KnownFile | null {
  const name = path.basename(relativePath);
  const rel = relativePath.replace(/\\/g, "/");

  // Test files
  if (/\.(test|spec)\.(ts|tsx|js|jsx|py|dart|rs|go)$/.test(name))
    return { importance: "medium", role: "test file" };
  if (/__(tests|specs|mocks)__/.test(rel))
    return { importance: "medium", role: "test directory" };

  // Route / controller files
  if (/\/routes?\//.test(rel) && /\.(ts|js)$/.test(name))
    return { importance: "high", role: "route handler" };
  if (/\/(controllers?|handlers?)\//.test(rel) && /\.(ts|js)$/.test(name))
    return { importance: "high", role: "controller" };

  // Schema / model files
  if (/\/(schema|schemas|models?)\//.test(rel) && /\.(ts|js|prisma)$/.test(name))
    return { importance: "high", role: "data schema / model" };

  // Middleware
  if (/\/middlewares?\//.test(rel) && /\.(ts|js)$/.test(name))
    return { importance: "medium", role: "middleware" };

  // Config patterns
  if (/\.config\.(ts|js|mjs|cjs)$/.test(name))
    return { importance: "high", role: "config file" };

  // GitHub Actions
  if (rel.startsWith(".github/workflows/") && /\.ya?ml$/.test(name))
    return { importance: "high", role: "CI workflow" };

  return null;
}

// ── Scanner ───────────────────────────────────────────────────────────────────

export interface ScanOptions {
  maxDepth?: number;
  rootPath: string;
}

export interface ScanResult {
  tree: FileNode;
  totalFiles: number;
  totalDirectories: number;
  importantFiles: Array<{
    relativePath: string;
    name: string;
    importance: FileImportance;
    role: string;
    size?: number;
  }>;
}

function shouldSkipDir(name: string): boolean {
  if (SKIP_DIRS.has(name)) return true;
  return SKIP_DIR_PATTERNS.some((p) => p.test(name));
}

function scanDir(
  absPath: string,
  rootPath: string,
  depth: number,
  maxDepth: number,
  result: ScanResult
): FileNode {
  const name = path.basename(absPath);
  const relativePath = path.relative(rootPath, absPath) || ".";
  const node: FileNode = { name, relativePath, type: "directory", children: [] };

  result.totalDirectories += 1;

  if (depth >= maxDepth) return node;

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(absPath, { withFileTypes: true });
  } catch {
    return node;
  }

  // Sort: dirs first, then files, alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory())
      return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    const entryAbs = path.join(absPath, entry.name);
    const entryRel = path.relative(rootPath, entryAbs).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      const child = scanDir(entryAbs, rootPath, depth + 1, maxDepth, result);
      node.children!.push(child);
    } else if (entry.isFile()) {
      result.totalFiles += 1;

      let size: number | undefined;
      try { size = fs.statSync(entryAbs).size; } catch { /* ignore */ }

      const ext = path.extname(entry.name).slice(1) || undefined;

      // Look up importance
      const known =
        KNOWN_FILES[entryRel] ??
        KNOWN_FILES[entry.name] ??
        inferImportance(entryRel);

      const fileNode: FileNode = {
        name: entry.name,
        relativePath: entryRel,
        type: "file",
        size,
        extension: ext,
        importance: known?.importance,
        role: known?.role,
      };
      node.children!.push(fileNode);

      if (known && known.importance !== "low") {
        result.importantFiles.push({
          relativePath: entryRel,
          name: entry.name,
          importance: known.importance,
          role: known.role,
          size,
        });
      }
    }
  }

  return node;
}

export function scanProject(options: ScanOptions): ScanResult {
  const { rootPath, maxDepth = 5 } = options;
  const result: ScanResult = {
    tree: { name: ".", relativePath: ".", type: "directory", children: [] },
    totalFiles: 0,
    totalDirectories: 0,
    importantFiles: [],
  };

  result.tree = scanDir(rootPath, rootPath, 0, maxDepth, result);

  // Deduplicate important files and sort by importance
  const importanceOrder: Record<FileImportance, number> = {
    critical: 0, high: 1, medium: 2, low: 3,
  };
  result.importantFiles.sort(
    (a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]
  );

  return result;
}
