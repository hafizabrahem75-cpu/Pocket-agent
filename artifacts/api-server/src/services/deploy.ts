// ── Deploy Manager ─────────────────────────────────────────────────────────────
//
// Detects whether an agent's workspace can be deployed by combining build
// detection (via analyzeProject + detectBuild) with preview URL resolution.
//
// No deployment is executed — this is detection and analysis only.

import { detectBuild } from "./build.js";
import { resolvePreview } from "./preview.js";
import type { Agent } from "../store/agents.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeployInfo {
  /** Name of the primary detected framework, or null if none found. */
  detectedFramework: string | null;
  /** Full build command string (e.g. "pnpm build"), or null if unsupported. */
  buildCommand: string | null;
  /** Live preview URL for the agent's workspace, or null if unavailable. */
  previewUrl: string | null;
  /** Whether the project has enough signals to support deployment. */
  deploySupported: boolean;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyse the agent's workspace and return deploy readiness information.
 *
 * Combines:
 *  - `analyzeProject()` — full project analysis (frameworks, package manager, metadata)
 *  - `detectBuild()`    — maps frameworks → build command
 *  - `resolvePreview()` — resolves the live dev-server URL from artifact.toml / agent field
 *
 * Commands are never executed — this is detection only.
 */
export async function detectDeploy(agent: Agent): Promise<DeployInfo> {
  // detectBuild internally calls analyzeProject — no need to call it again.
  const buildInfo = await detectBuild(agent.workspacePath);
  const { previewUrl } = resolvePreview(agent);

  // A deployment is considered supported when a build command can be determined.
  const deploySupported = buildInfo.supported;

  return {
    detectedFramework: buildInfo.detectedFramework,
    buildCommand: buildInfo.command,
    previewUrl,
    deploySupported,
  };
}
