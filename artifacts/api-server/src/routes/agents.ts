import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import {
  getAllAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
} from "../store/agents.js";

const router: IRouter = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const AgentStatusEnum = z.enum(["active", "inactive", "paused"]);

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  status: AgentStatusEnum.optional().default("active"),
});

const UpdateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: AgentStatusEnum.optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function agentNotFound(res: Response): void {
  res.status(404).json({ error: "not_found", message: "Agent not found" });
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/agents
router.get("/agents", (_req: Request, res: Response) => {
  res.json(getAllAgents());
});

// POST /api/agents
router.post("/agents", (req: Request, res: Response) => {
  const parsed = CreateAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  const agent = createAgent(parsed.data);
  res.status(201).json(agent);
});

// GET /api/agents/:id
router.get("/agents/:id", (req: Request, res: Response) => {
  const agent = getAgent(req.params.id);
  if (!agent) { agentNotFound(res); return; }
  res.json(agent);
});

// PATCH /api/agents/:id
router.patch("/agents/:id", (req: Request, res: Response) => {
  const parsed = UpdateAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  const agent = updateAgent(req.params.id, parsed.data);
  if (!agent) { agentNotFound(res); return; }
  res.json(agent);
});

// DELETE /api/agents/:id
router.delete("/agents/:id", (req: Request, res: Response) => {
  const deleted = deleteAgent(req.params.id);
  if (!deleted) { agentNotFound(res); return; }
  res.status(204).send();
});

export default router;
