// ── Routes: /api/secrets ──────────────────────────────────────────────────────
//
// GET    /api/secrets/:agentId          — list secret names (no values)
// POST   /api/secrets/:agentId          — create or update a secret
// DELETE /api/secrets/:agentId/:name    — delete a secret by name

import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import {
  listSecretNames,
  createSecret,
  updateSecret,
  deleteSecret,
  isSecretsError,
} from "../services/secrets.js";
import { getAgent } from "../store/agents.js";

const router: IRouter = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const UpsertSecretSchema = z.object({
  name: z.string().min(1, "name is required"),
  value: z.string(),
  /** If true, update an existing secret instead of creating a new one. */
  overwrite: z.boolean().optional().default(false),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function agentNotFound(res: Response): void {
  res.status(404).json({ error: "not_found", message: "Agent not found" });
}

function sendSecretsError(res: Response, err: ReturnType<typeof isSecretsError> extends true ? never : { code: string; message: string }): void {
  const status =
    err.code === "not_found"      ? 404 :
    err.code === "already_exists" ? 409 :
    err.code === "validation_error" ? 400 :
    500;
  res.status(status).json({ error: err.code, message: err.message });
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/secrets/:agentId
// Returns the list of secret names for an agent. Values are never included.
router.get("/secrets/:agentId", (req: Request, res: Response) => {
  const agentId = String(req.params.agentId);
  if (!getAgent(agentId)) { agentNotFound(res); return; }

  const names = listSecretNames(agentId);
  res.json({ agentId, secrets: names });
});

// POST /api/secrets/:agentId
// Create a new secret (or update with overwrite: true).
router.post("/secrets/:agentId", (req: Request, res: Response) => {
  const agentId = String(req.params.agentId);
  if (!getAgent(agentId)) { agentNotFound(res); return; }

  const parsed = UpsertSecretSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { name, value, overwrite } = parsed.data;
  const result = overwrite
    ? updateSecret(agentId, { name, value })
    : createSecret(agentId, { name, value });

  if (isSecretsError(result)) {
    sendSecretsError(res, result);
    return;
  }

  res.status(overwrite ? 200 : 201).json(result);
});

// DELETE /api/secrets/:agentId/:name
// Delete a secret by name.
router.delete("/secrets/:agentId/:name", (req: Request, res: Response) => {
  const agentId = String(req.params.agentId);
  if (!getAgent(agentId)) { agentNotFound(res); return; }

  const name = String(req.params.name);
  const result = deleteSecret(agentId, name);

  if (isSecretsError(result)) {
    sendSecretsError(res, result);
    return;
  }

  res.json(result);
});

export default router;
