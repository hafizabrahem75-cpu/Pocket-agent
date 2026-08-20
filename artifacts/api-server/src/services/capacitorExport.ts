// ── Capacitor Export Foundation ────────────────────────────────────────────────
//
// Prepares only the isolated directory reserved for future Capacitor output.
// This does not install Capacitor, create Android files, or run a build.

import fs from "node:fs";
import type { Agent } from "../store/agents.js";
import { checkApkReadiness } from "./apkReadiness.js";
import { resolveApkExportDirectory } from "./apkExport.js";

export interface CapacitorExportWorkspace {
  agentWorkspace: string;
  exportDirectory: string;
}

export interface CapacitorExportPlan {
  workspacePath: string | null;
  exportPath: string | null;
  expectedWebDirectory: string | null;
  readyForInitialization: boolean;
  reason: string;
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

/**
 * Describes the isolated workspace and web output expected by a future
 * Capacitor initialization. This does not initialize Capacitor or Android.
 */
export async function planCapacitorExportWorkspace(
  agent: Agent,
): Promise<CapacitorExportPlan> {
  const prepared = prepareCapacitorExportWorkspace(agent);

  try {
    const readiness = await checkApkReadiness(agent);
    const readyForInitialization =
      Boolean(prepared) && readiness.ready && Boolean(readiness.outputDirectory);

    return {
      workspacePath: prepared?.agentWorkspace ?? agent.workspacePath ?? null,
      exportPath: prepared?.exportDirectory ?? null,
      expectedWebDirectory: readiness.outputDirectory,
      readyForInitialization,
      reason: readyForInitialization
        ? "Isolated export workspace and web output are ready for future Capacitor initialization."
        : readiness.reason,
    };
  } catch {
    return {
      workspacePath: prepared?.agentWorkspace ?? agent.workspacePath ?? null,
      exportPath: prepared?.exportDirectory ?? null,
      expectedWebDirectory: null,
      readyForInitialization: false,
      reason: "The selected workspace could not be analyzed for future Capacitor initialization.",
    };
  }
}