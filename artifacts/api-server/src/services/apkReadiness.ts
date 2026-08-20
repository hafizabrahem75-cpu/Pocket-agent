// ── APK Export Readiness ───────────────────────────────────────────────────────
//
// Detection only. This service does not install packages, build the project, or
// create an Android/Capacitor project.

import { analyzeProject } from "../analyzer/index.js";
import type { DetectedFramework, ProjectAnalysis } from "../analyzer/types.js";
import { detectBuild } from "./build.js";
import type { Agent } from "../store/agents.js";

export interface ApkReadinessInfo {
  ready: boolean;
  supported: boolean;
  projectType: ProjectAnalysis["projectType"];
  framework: string | null;
  packageManager: ProjectAnalysis["packageManager"];
  buildCommand: string | null;
  outputDirectory: string | null;
  reason: string;
}

function inferOutputDirectory(frameworks: DetectedFramework[]): string | null {
  // These are the static output conventions we can identify without reading
  // or executing framework-specific configuration.
  const names = new Set(frameworks.map((framework) => framework.name));
  if (names.has("Vite") || names.has("Webpack")) return "dist";
  return null;
}

export async function checkApkReadiness(agent: Agent): Promise<ApkReadinessInfo> {
  const [analysis, build] = await Promise.all([
    analyzeProject({ rootPath: agent.workspacePath }),
    detectBuild(agent.workspacePath),
  ]);

  const framework = build.detectedFramework;
  const outputDirectory = inferOutputDirectory(analysis.frameworks);
  const isFrontendSpa =
    analysis.projectType.primary === "frontend" &&
    analysis.projectType.tags.includes("spa");
  const supported = isFrontendSpa;

  let reason = "Ready for a future Capacitor export; no build was run.";
  if (!supported) {
    reason = "APK export currently supports frontend SPA projects only.";
  } else if (!build.supported || !build.command) {
    reason = "No supported build command was detected for this SPA.";
  } else if (!outputDirectory) {
    reason = "The static build output directory could not be determined safely.";
  }

  return {
    ready: supported && build.supported && Boolean(build.command) && Boolean(outputDirectory),
    supported,
    projectType: analysis.projectType,
    framework,
    packageManager: analysis.packageManager,
    buildCommand: build.command,
    outputDirectory,
    reason,
  };
}