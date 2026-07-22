// ── Project Analyzer — Shared Types ──────────────────────────────────────────
//
// All types used across the analyzer subsystem. Designed to be serializable
// so the full analysis can be stored, cached, or sent over the API as-is.

// ── File importance ───────────────────────────────────────────────────────────

export type FileImportance = "critical" | "high" | "medium" | "low";

export interface FileRole {
  importance: FileImportance;
  /** Human-readable description of why this file matters */
  role: string;
}

// ── File / directory tree ─────────────────────────────────────────────────────

export interface FileNode {
  name: string;
  /** Path relative to the analyzed root */
  relativePath: string;
  type: "file" | "directory";
  /** File size in bytes (files only) */
  size?: number;
  extension?: string;
  importance?: FileImportance;
  /** e.g. "entry point", "config", "API spec", "schema" */
  role?: string;
  children?: FileNode[];
}

// ── Package manager ───────────────────────────────────────────────────────────

export type PackageManagerName =
  | "npm"
  | "yarn"
  | "pnpm"
  | "bun"
  | "pip"
  | "poetry"
  | "cargo"
  | "go"
  | "pub"      // Dart / Flutter
  | "maven"
  | "gradle"
  | "unknown";

export interface PackageManagerInfo {
  name: PackageManagerName;
  /** Lock file that confirmed this choice */
  lockFile?: string;
  /** Workspace file (pnpm-workspace.yaml, etc.) */
  workspaceFile?: string;
  isMonorepo: boolean;
}

// ── Framework / library detection ─────────────────────────────────────────────

export type FrameworkCategory =
  | "frontend"
  | "backend"
  | "fullstack"
  | "mobile"
  | "testing"
  | "build-tool"
  | "styling"
  | "database"
  | "state-management"
  | "api"
  | "other";

export type Confidence = "certain" | "likely" | "possible";

export interface DetectedFramework {
  name: string;
  category: FrameworkCategory;
  version?: string;
  confidence: Confidence;
  /** Specific files / deps that led to this conclusion */
  evidence: string[];
}

// ── Project type ──────────────────────────────────────────────────────────────

export type ProjectPrimary =
  | "frontend"
  | "backend"
  | "fullstack"
  | "mobile"
  | "library"
  | "monorepo"
  | "cli"
  | "unknown";

export type ProjectLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "dart"
  | "rust"
  | "go"
  | "java"
  | "kotlin"
  | "mixed"
  | "unknown";

export interface ProjectType {
  primary: ProjectPrimary;
  /** Additional descriptors, e.g. ["spa", "ssr"] */
  tags: string[];
  language: ProjectLanguage;
}

// ── Package manifest ──────────────────────────────────────────────────────────

export interface PackageManifest {
  name?: string;
  version?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
  engines?: Record<string, string>;
  main?: string;
  module?: string;
  type?: "module" | "commonjs";
}

// ── Metadata flags ────────────────────────────────────────────────────────────

export interface ProjectMetadata {
  totalFiles: number;
  totalDirectories: number;
  hasTests: boolean;
  hasDocker: boolean;
  hasCi: boolean;
  hasEnvFile: boolean;
  hasReadme: boolean;
  hasOpenApiSpec: boolean;
  hasTypeScript: boolean;
  hasLinting: boolean;
}

// ── Top-level result ──────────────────────────────────────────────────────────

export interface ProjectAnalysis {
  analyzedAt: string;
  /** Absolute path that was analyzed */
  rootPath: string;
  projectType: ProjectType;
  packageManager: PackageManagerInfo;
  frameworks: DetectedFramework[];
  /** Flat list of files deemed notable (importance >= medium) */
  importantFiles: ImportantFile[];
  /** Depth-limited directory tree */
  structure: FileNode;
  /** Human-readable paragraph summary */
  summary: string;
  metadata: ProjectMetadata;
  /** Raw manifest from package.json / pubspec.yaml / Cargo.toml etc. */
  manifest?: PackageManifest;
}

export interface ImportantFile {
  relativePath: string;
  name: string;
  importance: FileImportance;
  role: string;
  size?: number;
}
