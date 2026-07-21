import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { runChat, getProviderInfo } from "../services/chat.js";

const router: IRouter = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const ChatInputSchema = z.object({
  message: z.string().min(1).max(4000),
});

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/chat — send a message, get an AI-generated reply
router.post("/chat", async (req: Request, res: Response) => {
  const parsed = ChatInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "validation_error",
      message: parsed.error.message,
    });
    return;
  }

  const result = await runChat({ message: parsed.data.message });
  res.json(result);
});

// GET /api/chat/provider — inspect the current AI provider
router.get("/chat/provider", (_req: Request, res: Response) => {
  res.json(getProviderInfo());
});

export default router;
