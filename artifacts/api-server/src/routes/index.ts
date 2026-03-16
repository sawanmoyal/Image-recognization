import { Router, type IRouter } from "express";
import healthRouter from "./health";
import activityRouter from "./activity";
import eventsRouter from "./events";

const router: IRouter = Router();

router.use(healthRouter);
router.use(activityRouter);
router.use(eventsRouter);

export default router;
