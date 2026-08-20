// ── Route: POST /api/apk/readiness/:agentId ────────────────────────────────────
//
// Detects whether an agent workspace is ready for a future APK export.
// No build, dependency installation, or Android project generation occurs.

import { Router, type IRouter, type Request, type Response } from "express";
import { getAgent } from "../store/agents.js";
import { checkApkReadiness } from "../services/apkReadiness.js";

const router: IRouter = Router();

router.post("/apk/readiness/:agentId", async (req: Request, res: Response) => {
  const agent = getAgent(String(req.params.agentId));
  if (!agent) {
    res.status(404).json({ error: "not_found", message: "Agent not found" });
    return;
  }

  try {
    res.json(await checkApkReadiness(agent));
  } catch (err) {
    const message = err instanceof Error ? err.message : "APK readiness check failed";
    res.status(500).json({ error: "readiness_error", message });
  }
});

export default router;