import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import {
  AdminLoginBody,
  AdminLoginResponse,
  AdminLogoutResponse,
  GetAdminSessionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "Admin";
const ADMIN_COOKIE = "folio_admin_session";

function isValidPassword(candidate: string) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) return false;
  const candidateBuffer = Buffer.from(candidate);
  const configuredBuffer = Buffer.from(configured);
  return candidateBuffer.length === configuredBuffer.length &&
    timingSafeEqual(candidateBuffer, configuredBuffer);
}

export function requireAdmin(req: Parameters<typeof router.use>[0] extends never ? never : any, res: any, next: any) {
  if (req.signedCookies?.[ADMIN_COOKIE] === "authenticated") return next();
  return res.status(401).json({ message: "Admin authentication required" });
}

router.get("/admin/session", (req, res) => {
  const response = GetAdminSessionResponse.parse({
    authenticated: req.signedCookies?.[ADMIN_COOKIE] === "authenticated",
  });
  return res.json(response);
});

router.post("/admin/login", (req, res) => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Username and password are required" });
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ message: "Admin credentials are not configured" });
  if (parsed.data.username !== ADMIN_USERNAME || !isValidPassword(parsed.data.password)) {
    return res.status(401).json({ message: "Invalid admin credentials" });
  }

  res.cookie(ADMIN_COOKIE, "authenticated", {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
  return res.json(AdminLoginResponse.parse({ authenticated: true }));
});

router.post("/admin/logout", (req, res) => {
  res.clearCookie(ADMIN_COOKIE);
  return res.json(AdminLogoutResponse.parse({ authenticated: false }));
});

export default router;