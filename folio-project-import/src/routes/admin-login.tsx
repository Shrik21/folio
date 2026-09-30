import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { PageShell } from "@/components/site/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getHardcodedAdminSession, loginHardcodedAdmin } from "@/lib/admin-auth";

export const Route = createFileRoute("/admin-login")({
  loader: async () => {
    const session = await getHardcodedAdminSession();
    if (session.authenticated) throw redirect({ to: "/admin" });
  },
  head: () => ({
    meta: [
      { title: "Administrator login | Folio" },
      { name: "description", content: "Folio administrator access." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await loginHardcodedAdmin({ data: { email, password } });
      if (!result.authenticated) {
        setError("Incorrect administrator email or password.");
        return;
      }
      await navigate({ to: "/admin" });
    } catch {
      setError("Administrator login failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <div className="section-y px-4 sm:px-6">
        <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-paper p-6 shadow-page sm:p-8">
          <div className="mb-5 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <h1 className="display-lg text-4xl">Administrator login</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the Folio administrator credentials to continue.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-7 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="admin-email">Email address</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby={error ? "admin-auth-error" : undefined}
                className="min-h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-11"
              />
            </div>
            {error ? (
              <p
                id="admin-auth-error"
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy} className="min-h-11">
              {busy ? "Checking credentials…" : "Log in as administrator"}
            </Button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
