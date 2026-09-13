import { Router, type IRouter } from "express";
import healthRouter from "./health";
import portfoliosRouter from "./portfolios";

const router: IRouter = Router();

router.use(healthRouter);
router.use(portfoliosRouter);

export default router;
