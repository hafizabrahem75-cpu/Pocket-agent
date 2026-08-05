// ── Route: POST /api/run/:agentId ─────────────────────────────────────────────
//
// Detects the run/dev command for the agent's workspace and returns it.
// Commands are never executed — detection only.

import { Router, type IRouter, type Request, type Response } from "express";
import { getAgent } from "../store/agents.js";
import { detectRun } from "../services/run.js";

const router: IRouter = Router();

// POST /api/run/:agentId
router.post("/run/:agentId", async (req: Request, res: Response) => {
  const agent = getAgent(String(req.params.agentId));
  if (!agent) {
    res.status(404).json({ error: "not_found", message: "Agent not found" });
    return;
  }

  try {
    const info = await detectRun(agent.workspacePath);
    res.json(info);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Run detection failed";
    res.status(500).json({ error: "detection_error", message });
  }
});

export default router;
