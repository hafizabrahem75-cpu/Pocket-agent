import fs from "fs";
import path from "path";
import type { DetectedFramework, FrameworkCategory, Confidence, PackageManifest } from "../types.js";
import { allDeps } from "../scanners/packageScanner.js";

// ── Detection rule definition ─────────────────────────────────────────────────

interface FrameworkRule {
  name: string;
  category: FrameworkCategory;
  /** If any of these dep names are present → detected */
  deps?: string[];
  /** If any of these files exist → detected */
  files?: string[];
  /** Config file patterns (checked in root) */
  configFiles?: string[];
  confidence: Confidence;
}

// Ordered: more specific rules first
const RULES: FrameworkRule[] = [
  // ── Fullstack / meta-frameworks ──────────────────────────────────────────
  { name: "Next.js",    category: "fullstack",  deps: ["next"],            configFiles: ["next.config.js", "next.config.ts", "next.config.mjs"], confidence: "certain" },
  { name: "Nuxt",       category: "fullstack",  deps: ["nuxt"],            configFiles: ["nuxt.config.ts", "nuxt.config.js"], confidence: "certain" },
  { name: "Remix",      category: "fullstack",  deps: ["@remix-run/node", "@remix-run/react"], confidence: "certain" },
  { name: "SvelteKit",  category: "fullstack",  deps: ["@sveltejs/kit"],   configFiles: ["svelte.config.js"], confidence: "certain" },
  { name: "Astro",      category: "fullstack",  deps: ["astro"],           configFiles: ["astro.config.mjs", "astro.config.ts"], confidence: "certain" },
  { name: "Analog",     category: "fullstack",  deps: ["@analogjs/vite-plugin-angular"], confidence: "certain" },

  // ── Frontend frameworks ───────────────────────────────────────────────────
  { name: "React",      category: "frontend",   deps: ["react"],           confidence: "certain" },
  { name: "Vue",        category: "frontend",   deps: ["vue"],             confidence: "certain" },
  { name: "Svelte",     category: "frontend",   deps: ["svelte"],          confidence: "certain" },
  { name: "Angular",    category: "frontend",   deps: ["@angular/core"],   files: ["angular.json"], confidence: "certain" },
  { name: "Solid.js",   category: "frontend",   deps: ["solid-js"],        confidence: "certain" },
  { name: "Qwik",       category: "frontend",   deps: ["@builder.io/qwik"], confidence: "certain" },
  { name: "Preact",     category: "frontend",   deps: ["preact"],          confidence: "certain" },
  { name: "Lit",        category: "frontend",   deps: ["lit"],             confidence: "certain" },

  // ── Mobile ───────────────────────────────────────────────────────────────
  { name: "Flutter",    category: "mobile",     files: ["pubspec.yaml"],   confidence: "certain" },
  { name: "Expo",       category: "mobile",     deps: ["expo"],            configFiles: ["expo.config.js", "expo.config.ts", "app.json"], confidence: "certain" },
  { name: "React Native", category: "mobile",   deps: ["react-native"],    confidence: "certain" },

  // ── Backend frameworks ────────────────────────────────────────────────────
  { name: "Express",    category: "backend",    deps: ["express"],         confidence: "certain" },
  { name: "Fastify",    category: "backend",    deps: ["fastify"],         confidence: "certain" },
  { name: "NestJS",     category: "backend",    deps: ["@nestjs/core"],    confidence: "certain" },
  { name: "Hono",       category: "backend",    deps: ["hono"],            confidence: "certain" },
  { name: "Koa",        category: "backend",    deps: ["koa"],             confidence: "certain" },
  { name: "Elysia",     category: "backend",    deps: ["elysia"],          confidence: "certain" },
  { name: "tRPC",       category: "api",        deps: ["@trpc/server"],    confidence: "certain" },
  { name: "GraphQL",    category: "api",        deps: ["graphql", "apollo-server", "@apollo/server"], confidence: "likely" },
  { name: "Flask",      category: "backend",    files: ["requirements.txt", "app.py"], confidence: "possible" },
  { name: "Django",     category: "backend",    files: ["manage.py"],      confidence: "certain" },
  { name: "FastAPI",    category: "backend",    files: ["requirements.txt"], confidence: "possible" },

  // ── Build tools ───────────────────────────────────────────────────────────
  { name: "Vite",       category: "build-tool", deps: ["vite"],            configFiles: ["vite.config.ts", "vite.config.js", "vite.config.mjs"], confidence: "certain" },
  { name: "Webpack",    category: "build-tool", deps: ["webpack"],         configFiles: ["webpack.config.js", "webpack.config.ts"], confidence: "certain" },
  { name: "Rollup",     category: "build-tool", deps: ["rollup"],          confidence: "certain" },
  { name: "esbuild",    category: "build-tool", deps: ["esbuild"],         confidence: "certain" },
  { name: "Turbopack",  category: "build-tool", deps: ["turbopack"],       confidence: "certain" },
  { name: "Turborepo",  category: "build-tool", files: ["turbo.json"],     confidence: "certain" },
  { name: "Nx",         category: "build-tool", files: ["nx.json"],        confidence: "certain" },

  // ── Styling ───────────────────────────────────────────────────────────────
  { name: "Tailwind CSS",   category: "styling", deps: ["tailwindcss"],    confidence: "certain" },
  { name: "shadcn/ui",      category: "styling", deps: ["@radix-ui/react-dialog", "@radix-ui/react-slot"], confidence: "likely" },
  { name: "Radix UI",       category: "styling", deps: ["@radix-ui/react-dialog"], confidence: "certain" },
  { name: "Chakra UI",      category: "styling", deps: ["@chakra-ui/react"], confidence: "certain" },
  { name: "MUI",            category: "styling", deps: ["@mui/material"],  confidence: "certain" },
  { name: "Ant Design",     category: "styling", deps: ["antd"],           confidence: "certain" },
  { name: "styled-components", category: "styling", deps: ["styled-components"], confidence: "certain" },
  { name: "Emotion",        category: "styling", deps: ["@emotion/react"],  confidence: "certain" },

  // ── State management ──────────────────────────────────────────────────────
  { name: "Zustand",    category: "state-management", deps: ["zustand"],   confidence: "certain" },
  { name: "Redux Toolkit", category: "state-management", deps: ["@reduxjs/toolkit"], confidence: "certain" },
  { name: "Jotai",      category: "state-management", deps: ["jotai"],     confidence: "certain" },
  { name: "Recoil",     category: "state-management", deps: ["recoil"],    confidence: "certain" },
  { name: "MobX",       category: "state-management", deps: ["mobx"],      confidence: "certain" },
  { name: "TanStack Query", category: "state-management", deps: ["@tanstack/react-query"], confidence: "certain" },

  // ── Database / ORM ────────────────────────────────────────────────────────
  { name: "Drizzle ORM",  category: "database", deps: ["drizzle-orm"],    configFiles: ["drizzle.config.ts", "drizzle.config.js"], confidence: "certain" },
  { name: "Prisma",       category: "database", deps: ["@prisma/client"],  files: ["prisma/schema.prisma"], confidence: "certain" },
  { name: "TypeORM",      category: "database", deps: ["typeorm"],         confidence: "certain" },
  { name: "Sequelize",    category: "database", deps: ["sequelize"],       confidence: "certain" },
  { name: "Mongoose",     category: "database", deps: ["mongoose"],        confidence: "certain" },
  { name: "Kysely",       category: "database", deps: ["kysely"],          confidence: "certain" },

  // ── Testing ───────────────────────────────────────────────────────────────
  { name: "Vitest",     category: "testing",    deps: ["vitest"],          confidence: "certain" },
  { name: "Jest",       category: "testing",    deps: ["jest", "@jest/core"], confidence: "certain" },
  { name: "Playwright", category: "testing",    deps: ["@playwright/test"], confidence: "certain" },
  { name: "Cypress",    category: "testing",    deps: ["cypress"],         confidence: "certain" },
  { name: "Testing Library", category: "testing", deps: ["@testing-library/react", "@testing-library/dom"], confidence: "certain" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileExists(filePath: string): boolean {
  try { fs.accessSync(filePath, fs.constants.F_OK); return true; }
  catch { return false; }
}

function getDepVersion(manifest: PackageManifest, dep: string): string | undefined {
  return (
    manifest.dependencies?.[dep] ??
    manifest.devDependencies?.[dep] ??
    manifest.peerDependencies?.[dep]
  );
}

// ── Main detector ─────────────────────────────────────────────────────────────

export function detectFrameworks(
  rootPath: string,
  manifest: PackageManifest | null
): DetectedFramework[] {
  const deps = manifest ? allDeps(manifest) : new Set<string>();
  const detected: DetectedFramework[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    if (seen.has(rule.name)) continue;

    const evidence: string[] = [];
    let matched = false;

    // Check deps
    if (rule.deps) {
      for (const dep of rule.deps) {
        if (deps.has(dep)) {
          evidence.push(`dep: ${dep}`);
          if (manifest) {
            const version = getDepVersion(manifest, dep);
            if (version) evidence[evidence.length - 1] += `@${version}`;
          }
          matched = true;
        }
      }
    }

    // Check config files
    if (rule.configFiles) {
      for (const cfgFile of rule.configFiles) {
        if (fileExists(path.join(rootPath, cfgFile))) {
          evidence.push(`file: ${cfgFile}`);
          matched = true;
        }
      }
    }

    // Check arbitrary files
    if (rule.files) {
      for (const f of rule.files) {
        if (fileExists(path.join(rootPath, f))) {
          evidence.push(`file: ${f}`);
          matched = true;
        }
      }
    }

    if (matched) {
      // Extract version from first matched dep
      let version: string | undefined;
      if (manifest && rule.deps) {
        for (const dep of rule.deps) {
          const v = getDepVersion(manifest, dep);
          if (v) { version = v.replace(/^[\^~>=<]/, ""); break; }
        }
      }

      detected.push({
        name: rule.name,
        category: rule.category as FrameworkCategory,
        version,
        confidence: rule.confidence as Confidence,
        evidence,
      });
      seen.add(rule.name);
    }
  }

  return detected;
}
