import path from "path";
import fs from "fs";
import { scanProject } from "./scanners/fileScanner.js";
import {
  readPackageJson,
  readPubspec,
  readCargoToml,
  readGoMod,
  readPyproject,
} from "./scanners/packageScanner.js";
import { detectPackageManager } from "./detectors/packageManager.js";
import { detectFrameworks } from "./detectors/framework.js";
import { detectProjectType } from "./detectors/projectType.js";
import { generateSummary } from "./summarizer.js";
import type {
  ProjectAnalysis,
  PackageManifest,
  ProjectMetadata,
} from "./types.js";

// ── Workspace root detection ──────────────────────────────────────────────────
// Walk up from startDir until we find a pnpm-workspace.yaml, yarn workspaces
// root, or the filesystem root. Used to resolve relative paths correctly when
// the server runs inside a monorepo sub-package.

function findWorkspaceRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    // package.json with "workspaces" field = yarn/npm workspace root
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.workspaces) return dir;
      } catch { /* ignore */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return startDir; // reached fs root, fall back to cwd
    dir = parent;
  }
}

const WORKSPACE_ROOT = findWorkspaceRoot(process.cwd());

// ── Metadata flags ────────────────────────────────────────────────────────────

function buildMetadata(
  rootPath: string,
  totalFiles: number,
  totalDirectories: number,
  manifest: PackageManifest | null
): ProjectMetadata {
  function exists(...segments: string[]): boolean {
    try { fs.accessSync(path.join(rootPath, ...segments), fs.constants.F_OK); return true; }
    catch { return false; }
  }

  function existsAny(...paths: string[]): boolean {
    return paths.some((p) => exists(p));
  }

  const hasTypeScript =
    exists("tsconfig.json") ||
    !!(manifest?.devDependencies?.typescript || manifest?.dependencies?.typescript);

  const hasTests =
    exists("vitest.config.ts") ||
    exists("vitest.config.js") ||
    exists("jest.config.ts") ||
    exists("jest.config.js") ||
    exists("jest.config.json") ||
    exists("playwright.config.ts") ||
    exists("cypress.config.ts") ||
    exists("__tests__") ||
    exists("test") ||
    exists("tests") ||
    exists("spec") ||
    !!(
      manifest?.devDependencies?.vitest ||
      manifest?.devDependencies?.jest ||
      manifest?.devDependencies?.["@playwright/test"] ||
      manifest?.devDependencies?.cypress
    );

  const hasDocker =
    existsAny("Dockerfile", "Dockerfile.dev", "Dockerfile.prod") ||
    existsAny("docker-compose.yml", "docker-compose.yaml");

  const hasCi =
    exists(".github", "workflows") ||
    existsAny(".gitlab-ci.yml", "Jenkinsfile", ".circleci", ".travis.yml", "azure-pipelines.yml");

  const hasEnvFile = existsAny(".env", ".env.local", ".env.example", ".env.development");

  const hasReadme = existsAny("README.md", "README.txt", "README");

  const hasOpenApiSpec =
    existsAny("openapi.yaml", "openapi.json", "swagger.yaml", "swagger.json") ||
    existsAny(
      "lib/api-spec/openapi.yaml",
      "api-spec/openapi.yaml",
      "docs/openapi.yaml",
      "docs/swagger.yaml"
    );

  const hasLinting =
    existsAny(
      ".eslintrc.js", ".eslintrc.json", ".eslintrc.yaml", ".eslintrc",
      "eslint.config.js", "eslint.config.ts", "eslint.config.mjs",
      ".biome.json", "biome.json"
    ) ||
    !!(manifest?.devDependencies?.eslint || manifest?.devDependencies?.biome);

  return {
    totalFiles,
    totalDirectories,
    hasTests,
    hasDocker,
    hasCi,
    hasEnvFile,
    hasReadme,
    hasOpenApiSpec,
    hasTypeScript,
    hasLinting,
  };
}

// ── Normalize manifest from different sources ─────────────────────────────────

function buildManifestFromAlternate(rootPath: string): PackageManifest | null {
  const pubspec = readPubspec(rootPath);
  if (pubspec) return { name: pubspec.name, version: pubspec.version, description: pubspec.description };

  const cargo = readCargoToml(rootPath);
  if (cargo) return { name: cargo.name, version: cargo.version, description: cargo.edition ? `Rust ${cargo.edition} edition` : undefined };

  const goMod = readGoMod(rootPath);
  if (goMod) return { name: goMod.module, version: goMod.goVersion ? `go ${goMod.goVersion}` : undefined };

  const pyproject = readPyproject(rootPath);
  if (pyproject) return { name: pyproject.name, version: pyproject.version, description: pyproject.description };

  return null;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export interface AnalyzeOptions {
  /** Absolute or cwd-relative path to the directory to analyze */
  rootPath?: string;
  /** Maximum directory depth to scan (default: 5) */
  maxDepth?: number;
}

export async function analyzeProject(options: AnalyzeOptions = {}): Promise<ProjectAnalysis> {
  // Resolve relative paths from the workspace root so callers can pass
  // paths like "artifacts/pocket-agent-ui" regardless of server CWD.
  const rootPath = options.rootPath
    ? path.isAbsolute(options.rootPath)
      ? options.rootPath
      : path.resolve(WORKSPACE_ROOT, options.rootPath)
    : process.cwd();
  const maxDepth = options.maxDepth ?? 5;

  // 1. Scan directory tree
  const scan = scanProject({ rootPath, maxDepth });

  // 2. Read package manifest
  const manifest = readPackageJson(rootPath) ?? buildManifestFromAlternate(rootPath);

  // 3. Detect package manager
  const packageManager = detectPackageManager(rootPath);

  // 4. Detect frameworks (needs manifest for dep inspection)
  const frameworks = detectFrameworks(rootPath, manifest);

  // 5. Detect project type
  const projectType = detectProjectType(rootPath, frameworks, packageManager, manifest);

  // 6. Build metadata flags
  const metadata = buildMetadata(
    rootPath,
    scan.totalFiles,
    scan.totalDirectories,
    manifest
  );

  // 7. Assemble partial analysis (without summary yet)
  const partial = {
    analyzedAt: new Date().toISOString(),
    rootPath,
    projectType,
    packageManager,
    frameworks,
    importantFiles: scan.importantFiles,
    structure: scan.tree,
    metadata,
    manifest: manifest ?? undefined,
  };

  // 8. Generate human-readable summary
  const summary = generateSummary(partial);

  return { ...partial, summary };
}
