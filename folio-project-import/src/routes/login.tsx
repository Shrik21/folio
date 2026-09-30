import { createFileRoute } from "@tanstack/react-router";

import { AuthCard } from "@/components/site/AuthCard";
import { PageShell } from "@/components/site/PageShell";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in | Folio" },
      { name: "description", content: "Log in to your Folio account." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <PageShell>
      <div className="section-y px-4 sm:px-6">
        <AuthCard mode="login" />
      </div>
    </PageShell>
  ),
});
