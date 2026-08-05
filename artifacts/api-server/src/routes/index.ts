import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import agentsRouter from "./agents.js";
import chatRouter from "./chat.js";
import analyzerRouter from "./analyzer.js";
import previewRouter from "./preview.js";
import secretsRouter from "./secrets.js";
import terminalRouter from "./terminal.js";
import buildRouter from "./build.js";
import runRouter from "./run.js";
import deployRouter from "./deploy.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(chatRouter);
router.use(analyzerRouter);
router.use(previewRouter);
router.use(secretsRouter);
router.use(terminalRouter);
router.use(buildRouter);
router.use(runRouter);
router.use(deployRouter);

export default router;
