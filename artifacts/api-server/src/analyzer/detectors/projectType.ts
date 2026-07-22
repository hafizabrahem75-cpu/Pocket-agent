import type {
  DetectedFramework,
  ProjectType,
  ProjectPrimary,
  ProjectLanguage,
  PackageManifest,
  PackageManagerInfo,
} from "../types.js";
import fs from "fs";
import path from "path";

// ── Language detection ────────────────────────────────────────────────────────

function detectLanguage(
  rootPath: string,
  manifest: PackageManifest | null,
  packageManager: PackageManagerInfo
): ProjectLanguage {
  if (packageManager.name === "pub") return "dart";
  if (packageManager.name === "cargo") return "rust";
  if (packageManager.name === "go") return "go";
  if (packageManager.name === "pip" || packageManager.name === "poetry") return "python";
  if (packageManager.name === "maven" || packageManager.name === "gradle") return "java";

  // JS ecosystem: check for TypeScript
  if (manifest) {
    const hasTsDep =
      "typescript" in (manifest.devDependencies ?? {}) ||
      "typescript" in (manifest.dependencies ?? {});
    const hasTsConfig = exists(path.join(rootPath, "tsconfig.json"));
    if (hasTsDep || hasTsConfig) return "typescript";
    return "javascript";
  }

  // Fallback: scan for TS files
  try {
    const srcPath = path.join(rootPath, "src");
    const base = fs.existsSync(srcPath) ? srcPath : rootPath;
    const entries = fs.readdirSync(base);
    const hasTs = entries.some((e) => e.endsWith(".ts") || e.endsWith(".tsx"));
    const hasJs = entries.some((e) => e.endsWith(".js") || e.endsWith(".jsx"));
    if (hasTs && hasJs) return "mixed";
    if (hasTs) return "typescript";
    if (hasJs) return "javascript";
  } catch { /* ignore */ }

  return "unknown";
}

function exists(p: string): boolean {
  try { fs.accessSync(p, fs.constants.F_OK); return true; }
  catch { return false; }
}

// ── Primary type detection ────────────────────────────────────────────────────

function detectPrimary(
  frameworks: DetectedFramework[],
  packageManager: PackageManagerInfo,
  manifest: PackageManifest | null
): ProjectPrimary {
  if (packageManager.isMonorepo) return "monorepo";

  const cats = new Set(frameworks.map((f) => f.category));
  const names = new Set(frameworks.map((f) => f.name));

  // Mobile
  if (names.has("Flutter") || names.has("Expo") || names.has("React Native"))
    return "mobile";

  // Fullstack meta-frameworks
  if (names.has("Next.js") || names.has("Nuxt") || names.has("Remix") ||
      names.has("SvelteKit") || names.has("Astro"))
    return "fullstack";

  // Both frontend and backend detected
  if (cats.has("frontend") && cats.has("backend")) return "fullstack";

  // Pure backend
  if (cats.has("backend") || cats.has("api")) {
    if (!cats.has("frontend")) return "backend";
  }

  // Pure frontend
  if (cats.has("frontend")) return "frontend";

  // Library: has no app deps but has a main/module entry
  if (manifest?.main || manifest?.module) return "library";

  // CLI: bin field in package.json
  if (manifest && "bin" in (manifest as Record<string, unknown>)) return "cli";

  // Language-specific non-JS
  if (packageManager.name === "cargo") return "backend";
  if (packageManager.name === "go") return "backend";
  if (packageManager.name === "pip" || packageManager.name === "poetry") return "backend";

  return "unknown";
}

// ── Tags ─────────────────────────────────────────────────────────────────────

function buildTags(
  frameworks: DetectedFramework[],
  packageManager: PackageManagerInfo,
  primary: ProjectPrimary,
  manifest: PackageManifest | null
): string[] {
  const tags: string[] = [];
  const names = new Set(frameworks.map((f) => f.name));

  if (packageManager.isMonorepo) tags.push("monorepo");
  if (names.has("Vite")) tags.push("vite");
  if (names.has("Turborepo")) tags.push("turborepo");
  if (names.has("Nx")) tags.push("nx");
  if (names.has("Tailwind CSS")) tags.push("tailwind");
  if (names.has("Drizzle ORM") || names.has("Prisma") || names.has("TypeORM"))
    tags.push("has-orm");
  if (names.has("tRPC")) tags.push("trpc");
  if (names.has("GraphQL")) tags.push("graphql");
  if (names.has("Vitest") || names.has("Jest") || names.has("Playwright") || names.has("Cypress"))
    tags.push("has-tests");
  if (primary === "fullstack") tags.push("fullstack");
  if (manifest?.type === "module") tags.push("esm");

  // SPA detection: frontend with Vite/Webpack but no SSR framework
  if (
    primary === "frontend" &&
    (names.has("Vite") || names.has("Webpack")) &&
    !names.has("Next.js") && !names.has("Nuxt")
  ) tags.push("spa");

  return [...new Set(tags)];
}

// ── Main detector ─────────────────────────────────────────────────────────────

export function detectProjectType(
  rootPath: string,
  frameworks: DetectedFramework[],
  packageManager: PackageManagerInfo,
  manifest: PackageManifest | null
): ProjectType {
  const language = detectLanguage(rootPath, manifest, packageManager);
  const primary = detectPrimary(frameworks, packageManager, manifest);
  const tags = buildTags(frameworks, packageManager, primary, manifest);

  return { primary, tags, language };
}
