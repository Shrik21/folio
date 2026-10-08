import { Router, type IRouter } from "express";
import healthRouter from "./health";
import portfoliosRouter from "./portfolios";
import adminRouter from "./admin";
import adminTemplatesRouter from "./admin-templates";
import { createAuthRouter } from "../lib/auth-router";
import { authConfig, authStore } from "../lib/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", createAuthRouter(authConfig, authStore));
router.use(portfoliosRouter);
router.use(adminRouter);
router.use(adminTemplatesRouter);

export default router;
