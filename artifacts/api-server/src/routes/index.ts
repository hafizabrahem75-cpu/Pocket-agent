import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import agentsRouter from "./agents.js";
import chatRouter from "./chat.js";
import analyzerRouter from "./analyzer.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(chatRouter);
router.use(analyzerRouter);

export default router;
