import fs from "fs";
import path from "path";
import type { PackageManifest } from "../types.js";

// ── Readers for common manifest formats ───────────────────────────────────────

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// ── package.json ──────────────────────────────────────────────────────────────

export function readPackageJson(rootPath: string): PackageManifest | null {
  const pkgPath = path.join(rootPath, "package.json");
  if (!fileExists(pkgPath)) return null;
  const raw = readJson(pkgPath);
  if (!raw || typeof raw !== "object") return null;
  return raw as PackageManifest;
}

// ── pubspec.yaml (Flutter / Dart) ─────────────────────────────────────────────

export interface PubspecInfo {
  name?: string;
  description?: string;
  version?: string;
  environment?: Record<string, string>;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
}

export function readPubspec(rootPath: string): PubspecInfo | null {
  const pubspecPath = path.join(rootPath, "pubspec.yaml");
  if (!fileExists(pubspecPath)) return null;

  // Minimal YAML parsing (key: value lines only — enough for our needs)
  try {
    const text = fs.readFileSync(pubspecPath, "utf-8");
    const result: PubspecInfo = {};
    const nameMatch = text.match(/^name:\s*(.+)$/m);
    const descMatch = text.match(/^description:\s*(.+)$/m);
    const versionMatch = text.match(/^version:\s*(.+)$/m);
    if (nameMatch) result.name = nameMatch[1].trim().replace(/['"]/g, "");
    if (descMatch) result.description = descMatch[1].trim().replace(/['"]/g, "");
    if (versionMatch) result.version = versionMatch[1].trim();
    // Mark that flutter dep exists if present
    if (text.includes("flutter:") || text.includes("flutter_")) {
      result.dependencies = { flutter: "sdk: flutter" };
    }
    return result;
  } catch {
    return null;
  }
}

// ── Cargo.toml (Rust) ─────────────────────────────────────────────────────────

export interface CargoInfo {
  name?: string;
  version?: string;
  edition?: string;
  description?: string;
}

export function readCargoToml(rootPath: string): CargoInfo | null {
  const cargoPath = path.join(rootPath, "Cargo.toml");
  if (!fileExists(cargoPath)) return null;
  try {
    const text = fs.readFileSync(cargoPath, "utf-8");
    const result: CargoInfo = {};
    const nameMatch = text.match(/^name\s*=\s*["'](.+?)["']/m);
    const versionMatch = text.match(/^version\s*=\s*["'](.+?)["']/m);
    const editionMatch = text.match(/^edition\s*=\s*["'](.+?)["']/m);
    if (nameMatch) result.name = nameMatch[1];
    if (versionMatch) result.version = versionMatch[1];
    if (editionMatch) result.edition = editionMatch[1];
    return result;
  } catch {
    return null;
  }
}

// ── go.mod (Go) ───────────────────────────────────────────────────────────────

export interface GoModInfo {
  module?: string;
  goVersion?: string;
}

export function readGoMod(rootPath: string): GoModInfo | null {
  const goModPath = path.join(rootPath, "go.mod");
  if (!fileExists(goModPath)) return null;
  try {
    const text = fs.readFileSync(goModPath, "utf-8");
    const moduleMatch = text.match(/^module\s+(\S+)/m);
    const goMatch = text.match(/^go\s+(\S+)/m);
    return {
      module: moduleMatch?.[1],
      goVersion: goMatch?.[1],
    };
  } catch {
    return null;
  }
}

// ── pyproject.toml (Python) ───────────────────────────────────────────────────

export interface PyprojectInfo {
  name?: string;
  version?: string;
  description?: string;
}

export function readPyproject(rootPath: string): PyprojectInfo | null {
  const pyprojectPath = path.join(rootPath, "pyproject.toml");
  if (!fileExists(pyprojectPath)) return null;
  try {
    const text = fs.readFileSync(pyprojectPath, "utf-8");
    const nameMatch = text.match(/name\s*=\s*["'](.+?)["']/);
    const versionMatch = text.match(/version\s*=\s*["'](.+?)["']/);
    const descMatch = text.match(/description\s*=\s*["'](.+?)["']/);
    return {
      name: nameMatch?.[1],
      version: versionMatch?.[1],
      description: descMatch?.[1],
    };
  } catch {
    return null;
  }
}

// ── Helper: all dep keys from a package manifest ──────────────────────────────

export function allDeps(manifest: PackageManifest): Set<string> {
  return new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
}
