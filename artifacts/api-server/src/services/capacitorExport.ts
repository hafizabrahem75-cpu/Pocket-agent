// ── Capacitor Export Foundation ────────────────────────────────────────────────
//
// Prepares only the isolated directory reserved for future Capacitor output.
// This does not install Capacitor, create Android files, or run a build.

import fs from "node:fs";
import type { Agent } from "../store/agents.js";
import { resolveApkExportDirectory } from "./apkExport.js";

export interface CapacitorExportWorkspace {
  agentWorkspace: string;
  exportDirectory: string;
}

/**
 * Creates the empty isolated export directory for a validated agent workspace.
 * All future Capacitor-generated files must be written below exportDirectory.
 */
export function prepareCapacitorExportWorkspace(
  agent: Agent,
): CapacitorExportWorkspace | null {
  const exportDirectory = resolveApkExportDirectory(agent);
  if (!exportDirectory || !agent.workspacePath) return null;

  fs.mkdirSync(exportDirectory, { recursive: true });

  return {
    agentWorkspace: agent.workspacePath,
    exportDirectory,
  };
}