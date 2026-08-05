// ── Build Manager ─────────────────────────────────────────────────────────────
//
// Detects the appropriate build command for an agent's workspace by calling
// analyzeProject() and mapping the detected frameworks + package manager to a
// known build script. Commands are returned but never executed here.

import { analyzeProject } from "../analyzer/index.js";
import type { DetectedFramework, PackageManagerName } from "../analyzer/types.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BuildInfo {
  /** Name of the primary detected framework, or null if none found. */
  detectedFramework: string | null;
  /** Full build command string (e.g. "pnpm build"), or null if unsupported. */
  command: string | null;
  /** Whether a supported build command could be determined. */
  supported: boolean;
}

// ── Framework → script mapping ────────────────────────────────────────────────
// Ordered: more specific / higher-priority entries first.
// Each entry names the exact framework string from the detector and the npm
// script it maps to ("build" or "start").

interface FrameworkScript {
  framework: string;
  script: "build" | "start";
}

const FRAMEWORK_SCRIPTS: FrameworkScript[] = [
  // ── Fullstack meta-frameworks ─────────────────────────────────────────────
  { framework: "Next.js",   script: "build" },
  { framework: "Nuxt",      script: "build" },
  { framework: "Remix",     script: "build" },
  { framework: "SvelteKit", script: "build" },
  { framework: "Astro",     script: "build" },
  { framework: "Analog",    script: "build" },

  // ── Frontend frameworks ───────────────────────────────────────────────────
  { framework: "React",     script: "build" },
  { framework: "Vue",       script: "build" },
  { framework: "Svelte",    script: "build" },
  { framework: "Angular",   script: "build" },
  { framework: "Solid.js",  script: "build" },
  { framework: "Qwik",      script: "build" },
  { framework: "Preact",    script: "build" },
  { framework: "Lit",       script: "build" },

  // ── Build tools (catches Vite/Webpack-only setups) ────────────────────────
  { framework: "Vite",      script: "build" },
  { framework: "Webpack",   script: "build" },
  { framework: "Rollup",    script: "build" },
  { framework: "esbuild",   script: "build" },

  // ── Backend with a build step ─────────────────────────────────────────────
  { framework: "NestJS",    script: "build" },

  // ── Backend / Node — no static build, use start ───────────────────────────
  { framework: "Express",   script: "start" },
  { framework: "Fastify",   script: "start" },
  { framework: "Hono",      script: "start" },
  { framework: "Koa",       script: "start" },
  { framework: "Elysia",    script: "start" },
];

const SCRIPT_BY_FRAMEWORK = new Map(
  FRAMEWORK_SCRIPTS.map((e) => [e.framework, e.script])
);

// ── Package-manager command builder ───────────────────────────────────────────

function buildCommand(pm: PackageManagerName, script: "build" | "start"): string {
  switch (pm) {
    case "pnpm":
      // pnpm supports shorthand: `pnpm build` instead of `pnpm run build`
      return `pnpm ${script}`;
    case "yarn":
      return `yarn ${script}`;
    case "bun":
      return `bun run ${script}`;
    default:
      // npm (and unknown) always need `run` for non-lifecycle scripts
      return script === "start" ? "npm start" : `npm run ${script}`;
  }
}

// ── Framework priority sort ───────────────────────────────────────────────────
// Prefer fullstack → frontend → build-tool → backend, then by confidence.

const CATEGORY_PRIORITY: Record<string, number> = {
  fullstack:        0,
  frontend:         1,
  "build-tool":     2,
  backend:          3,
  api:              4,
  mobile:           5,
  database:         6,
  testing:          7,
  "state-management": 8,
  styling:          9,
  other:            10,
};

const CONFIDENCE_SCORE: Record<string, number> = {
  certain:  0,
  likely:   1,
  possible: 2,
};

function prioritise(frameworks: DetectedFramework[]): DetectedFramework[] {
  return [...frameworks].sort((a, b) => {
    const catDiff = (CATEGORY_PRIORITY[a.category] ?? 99) - (CATEGORY_PRIORITY[b.category] ?? 99);
    if (catDiff !== 0) return catDiff;
    return (CONFIDENCE_SCORE[a.confidence] ?? 9) - (CONFIDENCE_SCORE[b.confidence] ?? 9);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyse the workspace (or the given path) and return the detected build info.
 * Commands are never executed — this is detection only.
 */
export async function detectBuild(workspacePath?: string): Promise<BuildInfo> {
  const analysis = await analyzeProject({ rootPath: workspacePath });
  const { frameworks, packageManager, manifest } = analysis;

  const pm = packageManager.name;
  const scripts = manifest?.scripts ?? {};

  // Walk frameworks in priority order; find the first one that:
  //   a) has a known mapping AND
  //   b) the corresponding script exists in package.json (or is "start", a Node built-in)
  for (const fw of prioritise(frameworks)) {
    const targetScript = SCRIPT_BY_FRAMEWORK.get(fw.name);
    if (!targetScript) continue;

    // Accept if the manifest has the script, or if there's no manifest (can't verify)
    const manifestHasScript =
      Object.keys(scripts).length === 0 || // no scripts section → assume present
      targetScript in scripts ||
      (targetScript === "start"); // `npm start` is always valid for Node

    if (manifestHasScript) {
      return {
        detectedFramework: fw.name,
        command: buildCommand(pm, targetScript),
        supported: true,
      };
    }
  }

  // Fallback: if the manifest has a "build" script but no framework matched
  if ("build" in scripts) {
    return {
      detectedFramework: null,
      command: buildCommand(pm, "build"),
      supported: true,
    };
  }

  return {
    detectedFramework: null,
    command: null,
    supported: false,
  };
}
