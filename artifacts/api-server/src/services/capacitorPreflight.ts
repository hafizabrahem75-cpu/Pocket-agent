// ── Capacitor Export Preflight ─────────────────────────────────────────────────
//
// Detection only. This service does not install packages, initialize Capacitor,
// create Android projects, or run Gradle.

import fs from "node:fs";
import path from "node:path";
import type { Agent } from "../store/agents.js";
import { planCapacitorExportWorkspace } from "./capacitorExport.js";

export interface CapacitorPreflightResult {
  ready: boolean;
  availableTools: string[];
  missingTools: string[];
  environment: {
    JAVA_HOME: boolean;
    ANDROID_HOME: boolean;
    ANDROID_SDK_ROOT: boolean;
  };
  workspacePath: string | null;
  exportPath: string | null;
  expectedWebDirectory: string | null;
  reasons: string[];
}

function findExecutable(command: string): string | null {
  const pathValue = process.env.PATH ?? "";
  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, command);
    try {
      if (fs.statSync(candidate).isFile() && (fs.statSync(candidate).mode & 0o111) !== 0) {
        return candidate;
      }
    } catch {
      // Continue searching PATH.
    }
  }
  return null;
}

function configuredDirectory(name: string): boolean {
  const value = process.env[name];
  if (!value) return false;

  try {
    return fs.statSync(value).isDirectory();
  } catch {
    return false;
  }
}

export async function preflightCapacitorExport(
  agent: Agent,
): Promise<CapacitorPreflightResult> {
  const plan = await planCapacitorExportWorkspace(agent);
  const commands = ["node", "npm", "pnpm", "java", "javac", "gradle", "adb", "sdkmanager"];
  const availableTools = commands.filter((command) => findExecutable(command));
  const missingTools: string[] = [];
  const reasons: string[] = [];

  if (!availableTools.includes("node")) missingTools.push("Node.js");
  if (!availableTools.includes("npm") && !availableTools.includes("pnpm")) {
    missingTools.push("npm or pnpm");
  }
  if (!availableTools.includes("java") || !availableTools.includes("javac")) {
    missingTools.push("Java/JDK");
  }
  if (!availableTools.includes("gradle")) missingTools.push("Gradle");
  if (!availableTools.includes("adb")) missingTools.push("Android SDK platform tools (adb)");
  if (!availableTools.includes("sdkmanager")) {
    missingTools.push("Android SDK command-line tools (sdkmanager)");
  }

  const environment = {
    JAVA_HOME: configuredDirectory("JAVA_HOME"),
    ANDROID_HOME: configuredDirectory("ANDROID_HOME"),
    ANDROID_SDK_ROOT: configuredDirectory("ANDROID_SDK_ROOT"),
  };

  if (!environment.JAVA_HOME) {
    reasons.push("JAVA_HOME is not configured to an existing directory.");
  }
  if (!environment.ANDROID_HOME && !environment.ANDROID_SDK_ROOT) {
    reasons.push("ANDROID_HOME or ANDROID_SDK_ROOT must point to an existing Android SDK directory.");
  }
  if (!plan.readyForInitialization) {
    reasons.push(`Capacitor workspace is not ready: ${plan.reason}`);
  }
  if (missingTools.length > 0) {
    reasons.push(`Missing required tools: ${missingTools.join(", ")}.`);
  }

  return {
    ready: plan.readyForInitialization && missingTools.length === 0 &&
      environment.JAVA_HOME &&
      (environment.ANDROID_HOME || environment.ANDROID_SDK_ROOT),
    availableTools,
    missingTools,
    environment,
    workspacePath: plan.workspacePath,
    exportPath: plan.exportPath,
    expectedWebDirectory: plan.expectedWebDirectory,
    reasons,
  };
}