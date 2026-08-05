// ── Safe Terminal Service ─────────────────────────────────────────────────────
//
// Executes a strict whitelist of read-only shell commands in the context of an
// agent's workspacePath. No shell is spawned — spawnSync is called directly so
// chaining, pipes, and redirection are structurally impossible.

import { spawnSync } from "child_process";
import path from "path";
import { WORKSPACE_ROOT } from "../lib/workspaceRoot.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TerminalResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TerminalError {
  code: "rejected" | "timeout" | "spawn_error";
  message: string;
}

export function isTerminalError(v: unknown): v is TerminalError {
  return typeof v === "object" && v !== null && "code" in v && "message" in v;
}

// ── Forbidden metacharacters ──────────────────────────────────────────────────
// These indicate shell chaining, pipes, redirection, or injection attempts.
// Checked before any parsing so they can never sneak through.

const FORBIDDEN_RE = /[|&;><`$\n\r\\]/;

// ── Whitelist ─────────────────────────────────────────────────────────────────

type AllowRule =
  | { kind: "any" }                 // binary + any args
  | { kind: "no-args" }             // binary only, no args allowed
  | { kind: "exact"; sets: string[][] }; // args must match one of the given sets

interface WhitelistEntry {
  bin: string;
  allow: AllowRule;
}

const WHITELIST: WhitelistEntry[] = [
  { bin: "pwd",  allow: { kind: "no-args" } },
  { bin: "ls",   allow: { kind: "any" } },
  { bin: "cat",  allow: { kind: "any" } },
  { bin: "echo", allow: { kind: "any" } },
  { bin: "node", allow: { kind: "exact", sets: [["-v"]] } },
  { bin: "pnpm", allow: { kind: "exact", sets: [["-v"]] } },
  { bin: "git",  allow: { kind: "exact", sets: [["status"]] } },
];

const WHITELIST_BY_BIN = new Map(WHITELIST.map((e) => [e.bin, e]));

// ── Parser ────────────────────────────────────────────────────────────────────

interface ParsedCommand {
  bin: string;
  args: string[];
}

function parse(raw: string): ParsedCommand | TerminalError {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { code: "rejected", message: "Command must not be empty" };
  }

  if (FORBIDDEN_RE.test(trimmed)) {
    return {
      code: "rejected",
      message:
        "Command contains forbidden characters. " +
        "Pipes, redirection, shell chaining, and variable expansion are not allowed.",
    };
  }

  // Simple whitespace split — no shell quoting needed for the allowed commands
  const tokens = trimmed.split(/\s+/);
  return { bin: tokens[0], args: tokens.slice(1) };
}

function validate(parsed: ParsedCommand): TerminalError | null {
  const entry = WHITELIST_BY_BIN.get(parsed.bin);

  if (!entry) {
    const allowed = WHITELIST.map((e) => e.bin).join(", ");
    return {
      code: "rejected",
      message: `"${parsed.bin}" is not an allowed command. Allowed: ${allowed}`,
    };
  }

  const { allow } = entry;

  if (allow.kind === "no-args" && parsed.args.length > 0) {
    return {
      code: "rejected",
      message: `"${parsed.bin}" does not accept arguments`,
    };
  }

  if (allow.kind === "exact") {
    const argsStr = parsed.args.join(" ");
    const valid = allow.sets.some((set) => set.join(" ") === argsStr);
    if (!valid) {
      const permitted = allow.sets.map((s) => `"${parsed.bin} ${s.join(" ")}"`).join(", ");
      return {
        code: "rejected",
        message: `Invalid arguments for "${parsed.bin}". Permitted forms: ${permitted}`,
      };
    }
  }

  return null; // valid
}

// ── Executor ──────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 10_000;

function resolveCwd(workspacePath?: string): string {
  if (!workspacePath) return WORKSPACE_ROOT;
  // Resolve relative to workspace root; ignore absolute paths for safety
  const resolved = path.isAbsolute(workspacePath)
    ? workspacePath
    : path.resolve(WORKSPACE_ROOT, workspacePath);
  // Must stay inside WORKSPACE_ROOT
  if (!resolved.startsWith(WORKSPACE_ROOT + path.sep) && resolved !== WORKSPACE_ROOT) {
    return WORKSPACE_ROOT;
  }
  return resolved;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run a whitelisted command in the agent's workspace directory.
 * Returns TerminalResult on success, TerminalError if the command is rejected.
 */
export function runCommand(
  rawCommand: string,
  workspacePath?: string
): TerminalResult | TerminalError {
  const parsed = parse(rawCommand);
  if (isTerminalError(parsed)) return parsed;

  const validationError = validate(parsed);
  if (validationError) return validationError;

  const cwd = resolveCwd(workspacePath);

  const result = spawnSync(parsed.bin, parsed.args, {
    cwd,
    encoding: "utf-8",
    timeout: TIMEOUT_MS,
    // No shell — prevents any metacharacter interpretation
    shell: false,
    env: { ...process.env },
  });

  if (result.error) {
    const isTimeout = result.error.message.includes("ETIMEDOUT") ||
      (result.signal === "SIGTERM" && result.status === null);
    if (isTimeout) {
      return { code: "timeout", message: `Command timed out after ${TIMEOUT_MS / 1000}s` };
    }
    return { code: "spawn_error", message: result.error.message };
  }

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}
