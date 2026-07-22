import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { analyzeProject } from "../analyzer/index.js";

const router: IRouter = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const AnalyzeBodySchema = z.object({
  /** Path to analyze. Defaults to the server's working directory. */
  path: z.string().optional(),
  /** Max directory depth (1–10, default 5). */
  maxDepth: z.number().int().min(1).max(10).optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/analyze
// Analyzes a directory and returns the full ProjectAnalysis.
router.post("/analyze", async (req: Request, res: Response) => {
  const parsed = AnalyzeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  try {
    const analysis = await analyzeProject({
      rootPath: parsed.data.path,
      maxDepth: parsed.data.maxDepth,
    });
    res.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    res.status(500).json({ error: "analysis_error", message });
  }
});

// GET /api/analyze/summary
// Lightweight endpoint: returns only the summary string + key metadata.
// Useful for AI context injection without sending the full tree.
router.get("/analyze/summary", async (_req: Request, res: Response) => {
  try {
    const analysis = await analyzeProject();
    res.json({
      summary: analysis.summary,
      projectType: analysis.projectType,
      packageManager: analysis.packageManager,
      frameworks: analysis.frameworks.map((f) => ({
        name: f.name,
        category: f.category,
        version: f.version,
        confidence: f.confidence,
      })),
      metadata: analysis.metadata,
      analyzedAt: analysis.analyzedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    res.status(500).json({ error: "analysis_error", message });
  }
});

// GET /api/analyze/files
// Returns only the important files list — useful for quick project orientation.
router.get("/analyze/files", async (_req: Request, res: Response) => {
  try {
    const analysis = await analyzeProject({ maxDepth: 4 });
    res.json({
      rootPath: analysis.rootPath,
      importantFiles: analysis.importantFiles,
      analyzedAt: analysis.analyzedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    res.status(500).json({ error: "analysis_error", message });
  }
});

export default router;
