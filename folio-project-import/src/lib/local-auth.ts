import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const getAuthConfiguration = createServerFn({ method: "GET" }).handler(async () => {
  const { getLocalUserSession, isSupabaseConfigured } = await import("@/lib/local-auth.server");
  return {
    supabaseConfigured: isSupabaseConfigured(),
    localSession: await getLocalUserSession(),
  };
});

export const signupLocalUser = createServerFn({ method: "POST" })
  .validator(credentialsSchema)
  .handler(async ({ data }) => {
    const { createLocalAccount } = await import("@/lib/local-auth.server");
    return { session: await createLocalAccount(data.email, data.password) };
  });

export const loginLocalUser = createServerFn({ method: "POST" })
  .validator(credentialsSchema)
  .handler(async ({ data }) => {
    const { loginLocalAccount } = await import("@/lib/local-auth.server");
    return { session: await loginLocalAccount(data.email, data.password) };
  });

export const logoutLocalUser = createServerFn({ method: "POST" }).handler(async () => {
  const { clearLocalUserSession } = await import("@/lib/local-auth.server");
  clearLocalUserSession();
  return true;
});
