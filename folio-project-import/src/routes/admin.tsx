import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { ExternalLink, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/site/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PortfolioRow, ProfileRow } from "@/integrations/supabase/types";
import {
  getHardcodedAdminSession,
  loadAdminDashboard,
  logoutHardcodedAdmin,
  unpublishAdminPortfolio,
} from "@/lib/admin-auth";

export const Route = createFileRoute("/admin")({
  loader: async () => {
    const session = await getHardcodedAdminSession();
    if (!session.authenticated) throw redirect({ to: "/admin-login" });
  },
  head: () => ({
    meta: [
      { title: "Admin | Folio" },
      { name: "description", content: "Folio administration workspace." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadAdminDashboard();
      setConfigured(data.configured);
      setProfiles(data.profiles);
      setPortfolios(data.portfolios);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Admin data failed to load.";
      if (message.includes("UNAUTHORIZED")) {
        await navigate({ to: "/admin-login" });
        return;
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function unpublish(portfolio: PortfolioRow) {
    try {
      await unpublishAdminPortfolio({ data: { portfolioId: portfolio.id } });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The portfolio could not be unpublished.",
      );
      return;
    }
    toast.success(`${portfolio.name} was unpublished.`);
    await load();
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" aria-label="Loading admin workspace" />
      </div>
    );
  }

  const published = portfolios.filter((item) => item.status === "published").length;
  const totalViews = portfolios.reduce((sum, item) => sum + Number(item.view_count), 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-paper">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-display text-2xl">
            <span className="h-6 w-1.5 rounded-full bg-signal" aria-hidden="true" /> Folio
          </Link>
          <Badge className="gap-1">
            <ShieldCheck className="size-3" aria-hidden="true" /> Admin
          </Badge>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Log out"
              onClick={async () => {
                await logoutHardcodedAdmin();
                await navigate({ to: "/" });
              }}
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <p className="eyebrow">Operations</p>
        <h1 className="mt-3 font-display text-5xl">Folio overview</h1>
        {!configured ? (
          <div className="mt-6 border border-signal/35 bg-signal/10 p-4 text-sm">
            Admin login is active. Connect Supabase to display and manage live accounts and
            portfolios here.
          </div>
        ) : null}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Metric label="Accounts" value={profiles.length} />
          <Metric label="Published portfolios" value={published} />
          <Metric label="Recorded portfolio views" value={totalViews} />
        </div>

        <section className="mt-12">
          <h2 className="font-display text-3xl">Recent portfolios</h2>
          <div className="mt-5 overflow-x-auto border border-border bg-paper shadow-page">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/60">
                <tr>
                  <th className="p-3">Portfolio</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Template</th>
                  <th className="p-3">Views</th>
                  <th className="p-3">Updated</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {portfolios.map((portfolio) => (
                  <tr key={portfolio.id} className="border-b border-border last:border-0">
                    <td className="p-3">
                      <strong>{portfolio.name}</strong>
                      <span className="block text-xs text-muted-foreground">
                        /p/{portfolio.slug}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge variant={portfolio.status === "published" ? "default" : "secondary"}>
                        {portfolio.status}
                      </Badge>
                    </td>
                    <td className="p-3 capitalize">{portfolio.template_key}</td>
                    <td className="p-3">{portfolio.view_count}</td>
                    <td className="p-3">{new Date(portfolio.updated_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        {portfolio.status === "published" ? (
                          <Button asChild variant="ghost" size="sm">
                            <a href={`/p/${portfolio.slug}`} target="_blank" rel="noreferrer">
                              View <ExternalLink aria-hidden="true" />
                            </a>
                          </Button>
                        ) : null}
                        {portfolio.status === "published" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void unpublish(portfolio)}
                          >
                            Unpublish
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-3xl">Recent accounts</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {profiles.map((profile) => (
              <article key={profile.id} className="border border-border bg-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{profile.full_name || "Unnamed account"}</p>
                    <p className="mt-1 break-all text-sm text-muted-foreground">{profile.email}</p>
                  </div>
                  <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
                    {profile.role}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Joined {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border bg-paper p-5 shadow-page">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-4xl">{value.toLocaleString()}</p>
    </div>
  );
}
