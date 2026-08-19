// ── Routes: GitHub repository status and pull ─────────────────────────────────

import { Router, type IRouter, type Request, type Response } from "express";
import {
  isTerminalError,
  runCommand,
  type TerminalError,
  type TerminalResult,
} from "../services/terminal.js";

const router: IRouter = Router();

function runGit(command: string): TerminalResult | TerminalError {
  return runCommand(command);
}

function normalizeGitHubUrl(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim().replace(/\.git$/, "");
  const match = trimmed.match(/github\.com[/:]([^/]+\/[^/]+)$/i);
  return match ? `https://github.com/${match[1]}` : null;
}

// GET /api/github
// Reads the current workspace's origin and working-tree status.
router.get("/github", (_req: Request, res: Response) => {
  const remote = runGit("git remote get-url origin");
  const status = runGit("git status --short --branch");

  if (isTerminalError(remote)) {
    res.status(500).json({ error: remote.code, message: remote.message });
    return;
  }
  if (isTerminalError(status)) {
    const error = status;
    res.status(500).json({ error: error.code, message: error.message });
    return;
  }

  const remoteUrl = remote.exitCode === 0 ? remote.stdout.trim() : null;
  const githubUrl = remoteUrl ? normalizeGitHubUrl(remoteUrl) : null;
  const statusLines = status.stdout.trim().split("\n").filter(Boolean);
  const branchLine = statusLines[0] ?? "";

  res.json({
    remoteUrl,
    githubUrl,
    status: githubUrl ? "connected" : remoteUrl ? "not_github" : "not_configured",
    branch: branchLine.replace(/^##\s*/, "").split("...")[0] || null,
    clean: statusLines.length <= 1,
    details: statusLines.slice(1),
  });
});

// POST /api/github/pull
// Pulls the current workspace's origin using the existing safe terminal service.
router.post("/github/pull", (_req: Request, res: Response) => {
  const result = runGit("git pull");

  if (isTerminalError(result)) {
    res.status(500).json({ error: result.code, message: result.message });
    return;
  }

  if (result.exitCode !== 0) {
    res.status(409).json({
      error: "pull_failed",
      message: result.stderr.trim() || "Git pull failed",
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
    return;
  }

  res.json({
    ok: true,
    message: result.stdout.trim() || "Git pull completed.",
    stdout: result.stdout,
    stderr: result.stderr,
  });
});

export default router;