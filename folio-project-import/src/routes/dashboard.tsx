import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PortfolioStudio } from "@/components/dashboard/PortfolioStudio";
import { supabase } from "@/integrations/supabase/client";
import { getAuthConfiguration, logoutLocalUser } from "@/lib/local-auth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Folio" },
      { name: "description", content: "Manage your Folio portfolios." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<"supabase" | "local">("supabase");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkSession() {
      const configuration = await getAuthConfiguration();
      if (!active) return;

      if (!configuration.supabaseConfigured) {
        if (!configuration.localSession) {
          void navigate({ to: "/login" });
          return;
        }
        setMode("local");
        setEmail(configuration.localSession.email);
        setUserId(configuration.localSession.userId);
        setChecked(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        void navigate({ to: "/login" });
        return;
      }
      setEmail(data.session.user.email ?? null);
      setUserId(data.session.user.id);
      setChecked(true);
    }
    void checkSession();
    return () => {
      active = false;
    };
  }, [navigate]);

  if (!checked) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        Loading your workspace…
      </div>
    );
  }

  if (!userId) return null;

  return (
    <PortfolioStudio
      userId={userId}
      email={email ?? ""}
      mode={mode}
      onSignOut={async () => {
        if (mode === "local") await logoutLocalUser();
        else await supabase.auth.signOut();
        await navigate({ to: "/" });
      }}
    />
  );
}
