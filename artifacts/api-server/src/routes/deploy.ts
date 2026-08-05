// ── Route: POST /api/deploy/:agentId ─────────────────────────────────────────
//
// Returns deploy readiness information for an agent's workspace.
// No deployment is executed — detection only.

import { Router, type IRouter, type Request, type Response } from "express";
import { getAgent } from "../store/agents.js";
import { detectDeploy } from "../services/deploy.js";

const router: IRouter = Router();

// POST /api/deploy/:agentId
router.post("/deploy/:agentId", async (req: Request, res: Response) => {
  const agent = getAgent(String(req.params.agentId));
  if (!agent) {
    res.status(404).json({ error: "not_found", message: "Agent not found" });
    return;
  }

  try {
    const info = await detectDeploy(agent);
    res.json(info);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deploy detection failed";
    res.status(500).json({ error: "detection_error", message });
  }
});

export default router;
