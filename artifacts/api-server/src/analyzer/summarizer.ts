import type {
  ProjectAnalysis,
  DetectedFramework,
  ProjectType,
  PackageManagerInfo,
  ProjectMetadata,
} from "./types.js";

// ── Section builders ──────────────────────────────────────────────────────────

function describeType(projectType: ProjectType): string {
  const lang = projectType.language !== "unknown" ? projectType.language : null;
  const primary = projectType.primary;

  const langStr = lang ? `${lang} ` : "";

  switch (primary) {
    case "monorepo":   return `a ${langStr}monorepo`;
    case "fullstack":  return `a ${langStr}full-stack application`;
    case "frontend":   return `a ${langStr}frontend application`;
    case "backend":    return `a ${langStr}backend service`;
    case "mobile":     return `a ${langStr}mobile application`;
    case "library":    return `a ${langStr}library / package`;
    case "cli":        return `a ${langStr}CLI tool`;
    default:           return `a ${langStr}project`;
  }
}

function describePackageManager(pm: PackageManagerInfo): string {
  if (pm.name === "unknown") return "";
  const mono = pm.isMonorepo ? " (workspace)" : "";
  return `Uses ${pm.name}${mono} for package management.`;
}

function describeFrameworks(frameworks: DetectedFramework[]): string {
  if (frameworks.length === 0) return "";

  // Group by category, keep only certain/likely
  const grouped: Record<string, string[]> = {};
  for (const f of frameworks) {
    if (f.confidence === "possible") continue;
    const cat = f.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f.version ? `${f.name} ${f.version}` : f.name);
  }

  const parts: string[] = [];

  const order = [
    "fullstack", "frontend", "backend", "mobile", "api",
    "build-tool", "styling", "state-management", "database", "testing", "other",
  ];

  for (const cat of order) {
    if (!grouped[cat]?.length) continue;
    const list = grouped[cat].join(", ");
    switch (cat) {
      case "fullstack":        parts.push(`Built with ${list}`); break;
      case "frontend":         parts.push(`Frontend: ${list}`); break;
      case "backend":          parts.push(`Backend: ${list}`); break;
      case "mobile":           parts.push(`Mobile: ${list}`); break;
      case "api":              parts.push(`API layer: ${list}`); break;
      case "build-tool":       parts.push(`Build tooling: ${list}`); break;
      case "styling":          parts.push(`Styling: ${list}`); break;
      case "state-management": parts.push(`State: ${list}`); break;
      case "database":         parts.push(`Data layer: ${list}`); break;
      case "testing":          parts.push(`Testing: ${list}`); break;
      default:                 parts.push(list); break;
    }
  }

  return parts.join(". ") + (parts.length ? "." : "");
}

function describeMetadata(meta: ProjectMetadata): string {
  const flags: string[] = [];
  if (meta.hasTypeScript)    flags.push("TypeScript");
  if (meta.hasTests)         flags.push("tests");
  if (meta.hasDocker)        flags.push("Docker");
  if (meta.hasCi)            flags.push("CI workflows");
  if (meta.hasOpenApiSpec)   flags.push("OpenAPI spec");
  if (meta.hasLinting)       flags.push("linting");
  if (meta.hasEnvFile)       flags.push("environment config");

  if (flags.length === 0) return "";
  return `Also includes: ${flags.join(", ")}.`;
}

function describeScale(meta: ProjectMetadata): string {
  const total = meta.totalFiles;
  if (total < 20)   return "Small project";
  if (total < 100)  return "Medium-sized project";
  if (total < 500)  return "Large project";
  return "Very large project";
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function generateSummary(analysis: Omit<ProjectAnalysis, "summary">): string {
  const { projectType, packageManager, frameworks, metadata, manifest } = analysis;

  const parts: string[] = [];

  // Opening: type + name
  const projectName = manifest?.name ? `"${manifest.name}"` : "This project";
  const typeDesc = describeType(projectType);
  parts.push(`${projectName} is ${typeDesc}.`);

  // Package manager + workspace
  const pmDesc = describePackageManager(packageManager);
  if (pmDesc) parts.push(pmDesc);

  // Frameworks
  const fwDesc = describeFrameworks(frameworks);
  if (fwDesc) parts.push(fwDesc);

  // Scale
  parts.push(`${describeScale(metadata)} (${metadata.totalFiles} files, ${metadata.totalDirectories} directories).`);

  // Metadata flags
  const metaDesc = describeMetadata(metadata);
  if (metaDesc) parts.push(metaDesc);

  // Description from manifest
  if (manifest?.description) {
    parts.push(`Description: ${manifest.description}.`);
  }

  return parts.join(" ");
}
