import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function Breadcrumbs({ trail }: { trail: { to: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <li>
          <Link to="/" className="underline-offset-4 hover:text-foreground hover:underline">
            Home
          </Link>
        </li>
        {trail.map((item, index) => (
          <li key={item.to} className="flex items-center gap-2">
            <span aria-hidden="true">/</span>
            {index === trail.length - 1 ? (
              <span className="text-foreground">{item.label}</span>
            ) : (
              <Link
                to={item.to}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageIntro({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-4 pt-10 sm:px-6">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display-lg mt-3 max-w-3xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{lede}</p>
    </div>
  );
}
