import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const loginHardcodedAdmin = createServerFn({ method: "POST" })
  .validator(credentialsSchema)
  .handler(async ({ data }) => {
    const { createHardcodedAdminSession } = await import("@/lib/admin-auth.server");
    return { authenticated: await createHardcodedAdminSession(data.email, data.password) };
  });

export const getHardcodedAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const { hasHardcodedAdminSession } = await import("@/lib/admin-auth.server");
  return { authenticated: await hasHardcodedAdminSession() };
});

export const logoutHardcodedAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { clearHardcodedAdminSession } = await import("@/lib/admin-auth.server");
  clearHardcodedAdminSession();
  return { authenticated: false };
});

export const loadAdminDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminDashboardData } = await import("@/lib/admin-auth.server");
  return getAdminDashboardData();
});

export const unpublishAdminPortfolio = createServerFn({ method: "POST" })
  .validator(z.object({ portfolioId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { unpublishPortfolioAsAdmin } = await import("@/lib/admin-auth.server");
    return unpublishPortfolioAsAdmin(data.portfolioId);
  });
