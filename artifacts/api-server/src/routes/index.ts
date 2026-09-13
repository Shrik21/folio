import { Router, type IRouter } from "express";
import healthRouter from "./health";
import portfoliosRouter from "./portfolios";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(portfoliosRouter);
router.use(adminRouter);

export default router;
