// ── Route: POST /api/run/:agentId ─────────────────────────────────────────────
//
// Detects and starts the run/dev command for the agent's workspace.

import { Router, type IRouter, type Request, type Response } from "express";
import { getAgent } from "../store/agents.js";
import { detectRun, runDetectedProject } from "../services/run.js";

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
    const execution = await runDetectedProject(info, agent.workspacePath);
    res.json({ ...info, ...execution });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Run failed";
    res.status(500).json({ error: "run_error", message });
  }
});

export default router;
