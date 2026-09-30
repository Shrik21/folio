import { createFileRoute } from "@tanstack/react-router";

import { AuthCard } from "@/components/site/AuthCard";
import { PageShell } from "@/components/site/PageShell";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your Folio account" },
      { name: "description", content: "Create a free Folio account and publish a portfolio." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <PageShell>
      <div className="section-y px-4 sm:px-6">
        <AuthCard mode="signup" />
      </div>
    </PageShell>
  ),
});
