// ── APK Export Directory ───────────────────────────────────────────────────────
//
// Resolves the isolated location reserved for future APK export artifacts.
// This does not create the directory or perform any export work.

import fs from "node:fs";
import path from "node:path";
import type { Agent } from "../store/agents.js";
import { validatePath, WORKSPACE_ROOT } from "../workspace/safety.js";

const APK_EXPORT_RELATIVE_PATH = path.join(".pocket-agent", "apk");

/**
 * Returns the safe absolute APK export directory for an agent workspace.
 *
 * The agent workspace is validated against the shared workspace boundary and
 * must already exist as a directory. The derived export path is then checked
 * against that workspace so it cannot escape through path traversal.
 */
export function resolveApkExportDirectory(agent: Agent): string | null {
  if (!agent.workspacePath) return null;

  let workspace: string;
  try {
    workspace = validatePath(agent.workspacePath, { requireWritable: true });
  } catch {
    return null;
  }

  try {
    if (!fs.statSync(workspace).isDirectory()) return null;
  } catch {
    return null;
  }

  const exportDirectory = path.resolve(workspace, APK_EXPORT_RELATIVE_PATH);
  const relativeToWorkspace = path.relative(workspace, exportDirectory);
  const remainsInsideWorkspace =
    relativeToWorkspace !== "" &&
    !relativeToWorkspace.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativeToWorkspace);

  if (!remainsInsideWorkspace) return null;

  try {
    return validatePath(path.relative(WORKSPACE_ROOT, exportDirectory), {
      requireWritable: true,
    });
  } catch {
    return null;
  }
}