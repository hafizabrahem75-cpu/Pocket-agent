// ── Run Manager ───────────────────────────────────────────────────────────────
//
// Detects the appropriate dev/run command for an agent's workspace by calling
// analyzeProject() and mapping detected frameworks + package manager to a known
// run script. Commands are returned but never executed here.

import { analyzeProject } from "../analyzer/index.js";
import type { DetectedFramework, PackageManagerName } from "../analyzer/types.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RunInfo {
  /** Name of the primary detected framework, or null if none found. */
  detectedFramework: string | null;
  /** Full run command string (e.g. "pnpm dev"), or null if unsupported. */
  command: string | null;
  /** Whether a supported run command could be determined. */
  supported: boolean;
}

// ── Framework → script mapping ────────────────────────────────────────────────
// Ordered: more specific / higher-priority entries first.
// Script is the npm script name ("dev" or "start").

interface FrameworkScript {
  framework: string;
  script: "dev" | "start";
}

const FRAMEWORK_SCRIPTS: FrameworkScript[] = [
  // ── Fullstack meta-frameworks ─────────────────────────────────────────────
  { framework: "Next.js",   script: "dev" },
  { framework: "Nuxt",      script: "dev" },
  { framework: "Remix",     script: "dev" },
  { framework: "SvelteKit", script: "dev" },
  { framework: "Astro",     script: "dev" },
  { framework: "Analog",    script: "dev" },

  // ── Frontend frameworks ───────────────────────────────────────────────────
  { framework: "React",     script: "dev" },
  { framework: "Vue",       script: "dev" },
  { framework: "Svelte",    script: "dev" },
  { framework: "Angular",   script: "dev" },
  { framework: "Solid.js",  script: "dev" },
  { framework: "Qwik",      script: "dev" },
  { framework: "Preact",    script: "dev" },
  { framework: "Lit",       script: "dev" },

  // ── Build tools (Vite/Webpack-only setups) ────────────────────────────────
  { framework: "Vite",      script: "dev" },
  { framework: "Webpack",   script: "dev" },
  { framework: "Rollup",    script: "dev" },

  // ── Backend with a dev script ─────────────────────────────────────────────
  { framework: "NestJS",    script: "dev" },

  // ── Backend / Node — use start ────────────────────────────────────────────
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

function runCommand(pm: PackageManagerName, script: "dev" | "start"): string {
  switch (pm) {
    case "pnpm":
      // pnpm supports shorthand for scripts that aren't npm lifecycle hooks
      return `pnpm ${script}`;
    case "yarn":
      return `yarn ${script}`;
    case "bun":
      return `bun run ${script}`;
    default:
      // npm needs `run` for non-lifecycle scripts; "start" is a lifecycle script
      return script === "start" ? "npm start" : `npm run ${script}`;
  }
}

// ── Framework priority sort ───────────────────────────────────────────────────

const CATEGORY_PRIORITY: Record<string, number> = {
  fullstack:          0,
  frontend:           1,
  "build-tool":       2,
  backend:            3,
  api:                4,
  mobile:             5,
  database:           6,
  testing:            7,
  "state-management": 8,
  styling:            9,
  other:              10,
};

const CONFIDENCE_SCORE: Record<string, number> = {
  certain:  0,
  likely:   1,
  possible: 2,
};

function prioritise(frameworks: DetectedFramework[]): DetectedFramework[] {
  return [...frameworks].sort((a, b) => {
    const catDiff =
      (CATEGORY_PRIORITY[a.category] ?? 99) -
      (CATEGORY_PRIORITY[b.category] ?? 99);
    if (catDiff !== 0) return catDiff;
    return (
      (CONFIDENCE_SCORE[a.confidence] ?? 9) -
      (CONFIDENCE_SCORE[b.confidence] ?? 9)
    );
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyse the workspace (or the given path) and return the detected run info.
 * Commands are never executed — this is detection only.
 */
export async function detectRun(workspacePath?: string): Promise<RunInfo> {
  const analysis = await analyzeProject({ rootPath: workspacePath });
  const { frameworks, packageManager, manifest } = analysis;

  const pm = packageManager.name;
  const scripts = manifest?.scripts ?? {};

  // Walk frameworks in priority order; find the first one whose target script
  // exists in package.json (or is `start`, a Node lifecycle script).
  for (const fw of prioritise(frameworks)) {
    const targetScript = SCRIPT_BY_FRAMEWORK.get(fw.name);
    if (!targetScript) continue;

    const manifestHasScript =
      Object.keys(scripts).length === 0 || // no scripts section → assume present
      targetScript in scripts ||
      targetScript === "start"; // always valid for Node

    if (manifestHasScript) {
      return {
        detectedFramework: fw.name,
        command: runCommand(pm, targetScript),
        supported: true,
      };
    }
  }

  // Fallback: manifest has a "dev" script but no framework matched
  if ("dev" in scripts) {
    return {
      detectedFramework: null,
      command: runCommand(pm, "dev"),
      supported: true,
    };
  }

  // Fallback: manifest has a "start" script
  if ("start" in scripts) {
    return {
      detectedFramework: null,
      command: runCommand(pm, "start"),
      supported: true,
    };
  }

  return {
    detectedFramework: null,
    command: null,
    supported: false,
  };
}
