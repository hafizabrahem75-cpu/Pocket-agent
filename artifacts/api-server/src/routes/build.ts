// ── Route: POST /api/build/:agentId ──────────────────────────────────────────
//
// Detects the build command for the agent's workspace and returns it.
// Commands are never executed — detection only.

import { Router, type IRouter, type Request, type Response } from "express";
import { getAgent } from "../store/agents.js";
import { detectBuild } from "../services/build.js";

const router: IRouter = Router();

// POST /api/build/:agentId
router.post("/build/:agentId", async (req: Request, res: Response) => {
  const agent = getAgent(String(req.params.agentId));
  if (!agent) {
    res.status(404).json({ error: "not_found", message: "Agent not found" });
    return;
  }

  try {
    const info = await detectBuild(agent.workspacePath);
    res.json(info);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Build detection failed";
    res.status(500).json({ error: "detection_error", message });
  }
});

export default router;
