/** Only accept a signature-verified, unexpired admin cookie that the existing
 * login service still recognizes. Network failures always deny access. */
export async function verifyDelegatedAdmin(
  session: unknown,
  cookie: string | undefined,
  origin: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  if (!session || typeof session !== "object" || !("role" in session) || session.role !== "admin"
    || !("expiresAt" in session) || typeof session.expiresAt !== "number"
    || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now() || !cookie || !origin) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return false;
    const response = await fetcher(`${url.origin}/api/admin/session`, {
      headers: { Cookie: cookie, Accept: "application/json" },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const result: unknown = await response.json();
    return Boolean(result && typeof result === "object" && "authenticated" in result && result.authenticated === true);
  } catch { return false; }
}
