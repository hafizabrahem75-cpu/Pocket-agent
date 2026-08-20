// ── APK Web Build Verification ────────────────────────────────────────────────
//
// Runs only the build command already approved by APK readiness detection.
// This does not install dependencies or create an Android/Capacitor project.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../lib/workspaceRoot.js";
import type { Agent } from "../store/agents.js";
import { checkApkReadiness } from "./apkReadiness.js";

export interface ApkBuildVerification {
  buildStatus: "succeeded" | "failed" | "not_ready" | "output_missing";
  command: string | null;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  outputDirectory: string | null;
  outputDirectoryExists: boolean;
  reason?: string;
}

function resolveWorkspace(workspacePath?: string): string | null {
  if (!workspacePath) return null;
  const resolved = path.resolve(WORKSPACE_ROOT, workspacePath);
  const inside =
    resolved === WORKSPACE_ROOT ||
    resolved.startsWith(`${WORKSPACE_ROOT}${path.sep}`);
  if (!inside) return null;

  try {
    return fs.statSync(resolved).isDirectory() ? resolved : null;
  } catch {
    return null;
  }
}

export async function verifyApkBuild(agent: Agent): Promise<ApkBuildVerification> {
  const readiness = await checkApkReadiness(agent);
  const base = {
    command: readiness.buildCommand,
    outputDirectory: readiness.outputDirectory,
  };

  if (!readiness.ready || !readiness.buildCommand || !readiness.outputDirectory) {
    return {
      ...base,
      buildStatus: "not_ready",
      exitCode: null,
      stdout: "",
      stderr: "",
      outputDirectoryExists: false,
      reason: readiness.reason,
    };
  }

  const cwd = resolveWorkspace(agent.workspacePath);
  if (!cwd) {
    return {
      ...base,
      buildStatus: "not_ready",
      exitCode: null,
      stdout: "",
      stderr: "An existing agent workspacePath is required to build the project.",
      outputDirectoryExists: false,
    };
  }

  const [bin, ...args] = readiness.buildCommand.trim().split(/\s+/);
  const result = spawnSync(bin, args, {
    cwd,
    encoding: "utf-8",
    timeout: 120_000,
    shell: false,
    env: { ...process.env },
  });

  const stdout = result.stdout ?? "";
  const stderr = result.error
    ? `${result.stderr ?? ""}${result.error.message}`
    : result.stderr ?? "";
  const exitCode = result.status;
  const outputPath = path.join(cwd, readiness.outputDirectory);
  const outputDirectoryExists = fs.existsSync(outputPath);

  return {
    ...base,
    buildStatus:
      exitCode === 0
        ? outputDirectoryExists ? "succeeded" : "output_missing"
        : "failed",
    exitCode,
    stdout,
    stderr,
    outputDirectoryExists,
  };
}