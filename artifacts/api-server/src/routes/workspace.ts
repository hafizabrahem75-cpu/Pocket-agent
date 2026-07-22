import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import {
  readFile,
  writeFile,
  deleteFile,
  createDir,
  deleteDir,
  moveItem,
  listDir,
} from "../workspace/service.js";
import { WorkspaceError } from "../workspace/types.js";
import { WORKSPACE_ROOT } from "../workspace/safety.js";

const router: IRouter = Router();

// ── Error serialiser ──────────────────────────────────────────────────────────

function handleError(res: Response, err: unknown): void {
  if (err instanceof WorkspaceError) {
    const status =
      err.code === "not_found"        ? 404 :
      err.code === "already_exists"   ? 409 :
      err.code === "path_traversal"   ? 403 :
      err.code === "outside_workspace"? 403 :
      err.code === "protected_path"   ? 403 :
      err.code === "binary_file"      ? 415 :
      err.code === "file_too_large"   ? 413 :
      err.code === "dir_not_empty"    ? 409 :
                                        400;
    res.status(status).json({ error: err.code, message: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  res.status(500).json({ error: "io_error", message });
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const PathQuery = z.object({
  path: z.string().min(1, "path is required"),
});

const WriteBody = z.object({
  path: z.string().min(1),
  content: z.string(),
  overwrite: z.boolean().optional(),
});

const CreateBody = z.object({
  path: z.string().min(1),
  content: z.string().default(""),
  overwrite: z.boolean().optional().default(false),
});

const DirBody = z.object({
  path: z.string().min(1),
});

const MoveBody = z.object({
  from: z.string().min(1),
  to:   z.string().min(1),
});

const DeleteDirBody = z.object({
  recursive: z.boolean().optional().default(false),
});

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/workspace
// Workspace root info and quick status.
router.get("/workspace", (_req: Request, res: Response) => {
  res.json({ workspaceRoot: WORKSPACE_ROOT, status: "ok" });
});

// ── Files ─────────────────────────────────────────────────────────────────────

// GET /api/workspace/file?path=relative/path
// Read a text file's content.
router.get("/workspace/file", (req: Request, res: Response) => {
  const parsed = PathQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    res.json(readFile(parsed.data.path));
  } catch (err) { handleError(res, err); }
});

// POST /api/workspace/file
// Create a new file. Returns 409 if the file already exists (unless overwrite: true).
router.post("/workspace/file", (req: Request, res: Response) => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const result = writeFile(parsed.data.path, parsed.data.content, {
      overwrite: parsed.data.overwrite,
      createParents: true,
    });
    res.status(result.created ? 201 : 200).json(result);
  } catch (err) { handleError(res, err); }
});

// PUT /api/workspace/file
// Update an existing file (or create it — always overwrites).
router.put("/workspace/file", (req: Request, res: Response) => {
  const parsed = WriteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const result = writeFile(parsed.data.path, parsed.data.content, {
      overwrite: true,
      createParents: true,
    });
    res.json(result);
  } catch (err) { handleError(res, err); }
});

// DELETE /api/workspace/file?path=relative/path
// Delete a single file.
router.delete("/workspace/file", (req: Request, res: Response) => {
  const parsed = PathQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    res.json(deleteFile(parsed.data.path));
  } catch (err) { handleError(res, err); }
});

// ── Directories ───────────────────────────────────────────────────────────────

// GET /api/workspace/dir?path=relative/path
// List the entries of a directory (non-recursive).
router.get("/workspace/dir", (req: Request, res: Response) => {
  const parsed = PathQuery.safeParse(req.query);
  const dirPath = parsed.success ? parsed.data.path : ".";
  try {
    res.json(listDir(dirPath));
  } catch (err) { handleError(res, err); }
});

// POST /api/workspace/dir
// Create a directory (and any missing parents).
router.post("/workspace/dir", (req: Request, res: Response) => {
  const parsed = DirBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const result = createDir(parsed.data.path);
    res.status(result.alreadyExisted ? 200 : 201).json(result);
  } catch (err) { handleError(res, err); }
});

// DELETE /api/workspace/dir?path=relative/path
// Delete a directory. Requires { recursive: true } in the body to remove non-empty dirs.
router.delete("/workspace/dir", (req: Request, res: Response) => {
  const pathParsed = PathQuery.safeParse(req.query);
  if (!pathParsed.success) {
    res.status(400).json({ error: "validation_error", message: pathParsed.error.message });
    return;
  }
  const bodyParsed = DeleteDirBody.safeParse(req.body ?? {});
  const recursive = bodyParsed.success ? bodyParsed.data.recursive : false;
  try {
    res.json(deleteDir(pathParsed.data.path, { recursive }));
  } catch (err) { handleError(res, err); }
});

// ── Move / rename ─────────────────────────────────────────────────────────────

// POST /api/workspace/move
// Move or rename a file or directory.
// If `to` is an existing directory, the item is moved inside it (unix mv semantics).
router.post("/workspace/move", (req: Request, res: Response) => {
  const parsed = MoveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    res.json(moveItem(parsed.data.from, parsed.data.to));
  } catch (err) { handleError(res, err); }
});

export default router;
