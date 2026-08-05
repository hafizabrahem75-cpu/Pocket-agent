// ── Preview Service ───────────────────────────────────────────────────────────
//
// Resolves the live dev-server preview URL for an agent.
//
// Detection order:
//   1. Agent's stored previewUrl field (explicit override).
//   2. artifact.toml in the agent's workspacePath — extracts `previewPath` and
//      combines it with the REPLIT_DEV_DOMAIN env var.
//
// No shell execution; all detection is done via filesystem reads.

import fs from "fs";
import path from "path";
import { WORKSPACE_ROOT } from "../lib/workspaceRoot.js";
import type { Agent } from "../store/agents.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PreviewStatus = "available" | "unavailable";

export interface PreviewInfo {
  previewUrl: string | null;
  status: PreviewStatus;
}

// ── artifact.toml parser (minimal) ───────────────────────────────────────────
// Extracts the previewPath value from an artifact.toml without a full TOML
// parser. The value is always a quoted string on a single line.

function extractPreviewPath(tomlContent: string): string | null {
  // Match: previewPath = "/some/path"  (with optional surrounding whitespace)
  const match = tomlContent.match(/^\s*previewPath\s*=\s*"([^"]+)"/m);
  return match ? match[1] : null;
}

function readArtifactToml(workspacePath: string): string | null {
  const tomlPath = path.resolve(WORKSPACE_ROOT, workspacePath, "artifact.toml");
  try {
    return fs.readFileSync(tomlPath, "utf-8");
  } catch {
    return null;
  }
}

// ── URL construction ──────────────────────────────────────────────────────────

function buildDevUrl(previewPath: string): string | null {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (!domain) return null;
  // Ensure exactly one slash between domain and path
  const normalised = previewPath.startsWith("/") ? previewPath : `/${previewPath}`;
  return `https://${domain}${normalised}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolves preview information for the given agent.
 *
 * Returns `{ previewUrl, status }`:
 *  - `status: "available"` when a URL could be determined.
 *  - `status: "unavailable"` when no URL can be detected.
 */
export function resolvePreview(agent: Agent): PreviewInfo {
  // 1. Explicit override stored on the agent
  if (agent.previewUrl) {
    return { previewUrl: agent.previewUrl, status: "available" };
  }

  // 2. Detect from artifact.toml in the agent's workspacePath
  if (agent.workspacePath) {
    const toml = readArtifactToml(agent.workspacePath);
    if (toml) {
      const previewPath = extractPreviewPath(toml);
      if (previewPath) {
        const url = buildDevUrl(previewPath);
        if (url) {
          return { previewUrl: url, status: "available" };
        }
      }
    }
  }

  return { previewUrl: null, status: "unavailable" };
}
