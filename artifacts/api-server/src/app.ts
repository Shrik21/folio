import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authConfig } from "./lib/auth";
import { randomToken } from "./lib/auth-core";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
app.use(cors({ origin: authConfig.appOrigin ?? false, credentials: true }));
app.use(cookieParser(authConfig.sessionSecret ?? randomToken()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  // Log the real cause server-side; the client still gets a generic message.
  (req.log ?? logger).error({ err: error }, "Unhandled request error");
  res.status(503).json({ message: "The service is temporarily unavailable. Please try again." });
};
app.use(errorHandler);

export default app;
