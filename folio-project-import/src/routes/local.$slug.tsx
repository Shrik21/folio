import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PortfolioRenderer } from "@/components/portfolio/PortfolioRenderer";
import { Button } from "@/components/ui/button";
import type { PortfolioRow } from "@/integrations/supabase/types";

export const Route = createFileRoute("/local/$slug")({
  head: () => ({
    meta: [
      { title: "Local portfolio preview | Folio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LocalPortfolioPage,
});

function LocalPortfolioPage() {
  const { slug } = Route.useParams();
  const [portfolio, setPortfolio] = useState<PortfolioRow | null | undefined>(undefined);

  useEffect(() => {
    const stored = window.localStorage.getItem(`folio-local-public:${slug}`);
    if (!stored) {
      setPortfolio(null);
      return;
    }
    try {
      setPortfolio(JSON.parse(stored) as PortfolioRow);
    } catch {
      setPortfolio(null);
    }
  }, [slug]);

  if (portfolio === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        Loading local preview…
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-md border border-border bg-paper p-8 text-center shadow-page">
          <h1 className="font-display text-4xl">Local preview not found</h1>
          <p className="mt-3 text-muted-foreground">
            Publish the portfolio from this browser before opening its local preview.
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard">Back to studio</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <PortfolioRenderer portfolio={portfolio} />;
}
