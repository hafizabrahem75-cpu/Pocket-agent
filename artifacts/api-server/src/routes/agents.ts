import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

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

// ── In-memory store ───────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: "active" | "inactive" | "paused";
  createdAt: string;
  updatedAt: string;
}

const agents = new Map<string, Agent>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function agentNotFound(res: Response): void {
  res.status(404).json({ error: "not_found", message: "Agent not found" });
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/agents
router.get("/agents", (_req: Request, res: Response) => {
  res.json([...agents.values()]);
});

// POST /api/agents
router.post("/agents", (req: Request, res: Response) => {
  const parsed = CreateAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "validation_error",
      message: parsed.error.message,
    });
    return;
  }

  const ts = now();
  const agent: Agent = {
    id: randomUUID(),
    name: parsed.data.name,
    description: parsed.data.description,
    status: parsed.data.status,
    createdAt: ts,
    updatedAt: ts,
  };

  agents.set(agent.id, agent);
  res.status(201).json(agent);
});

// GET /api/agents/:id
router.get("/agents/:id", (req: Request, res: Response) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    agentNotFound(res);
    return;
  }
  res.json(agent);
});

// PATCH /api/agents/:id
router.patch("/agents/:id", (req: Request, res: Response) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    agentNotFound(res);
    return;
  }

  const parsed = UpdateAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "validation_error",
      message: parsed.error.message,
    });
    return;
  }

  const updated: Agent = {
    ...agent,
    ...parsed.data,
    updatedAt: now(),
  };

  agents.set(updated.id, updated);
  res.json(updated);
});

// DELETE /api/agents/:id
router.delete("/agents/:id", (req: Request, res: Response) => {
  if (!agents.has(req.params.id)) {
    agentNotFound(res);
    return;
  }
  agents.delete(req.params.id);
  res.status(204).send();
});

export default router;
