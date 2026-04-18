import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import chatRouter from "./chat";
import modelsRouter from "./models";
import hubRouter from "./hub";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/chat", chatRouter);
router.use("/models", modelsRouter);
router.use("/hub", hubRouter);

export default router;
