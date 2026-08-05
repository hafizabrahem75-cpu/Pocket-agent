// ── Route: POST /api/terminal/:agentId ───────────────────────────────────────
//
// Executes a whitelisted terminal command in the agent's workspace directory.

import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { getAgent } from "../store/agents.js";
import { runCommand, isTerminalError } from "../services/terminal.js";

const router: IRouter = Router();

// ── Schema ────────────────────────────────────────────────────────────────────

const TerminalInputSchema = z.object({
  command: z.string().min(1, "command is required"),
});

// ── Route ─────────────────────────────────────────────────────────────────────

// POST /api/terminal/:agentId
router.post("/terminal/:agentId", (req: Request, res: Response) => {
  const agent = getAgent(String(req.params.agentId));
  if (!agent) {
    res.status(404).json({ error: "not_found", message: "Agent not found" });
    return;
  }

  const parsed = TerminalInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const result = runCommand(parsed.data.command, agent.workspacePath);

  if (isTerminalError(result)) {
    const status = result.code === "rejected" ? 400 : 500;
    res.status(status).json({ error: result.code, message: result.message });
    return;
  }

  res.json(result);
});

export default router;
