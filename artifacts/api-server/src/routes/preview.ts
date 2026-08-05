// ── Route: GET /api/preview/:agentId ─────────────────────────────────────────
//
// Returns the resolved preview URL and status for a given agent.

import { Router, type IRouter, type Request, type Response } from "express";
import { getAgent } from "../store/agents.js";
import { resolvePreview } from "../services/preview.js";

const router: IRouter = Router();

// GET /api/preview/:agentId
router.get("/preview/:agentId", (req: Request, res: Response) => {
  const agent = getAgent(String(req.params.agentId));
  if (!agent) {
    res.status(404).json({ error: "not_found", message: "Agent not found" });
    return;
  }

  const preview = resolvePreview(agent);
  res.json(preview);
});

export default router;
