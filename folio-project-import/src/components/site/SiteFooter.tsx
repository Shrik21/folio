import { Link } from "@tanstack/react-router";

const groups = [
  {
    title: "Product",
    links: [
      { to: "/features", label: "Features" },
      { to: "/templates", label: "Templates" },
      { to: "/examples", label: "Examples" },
      { to: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Use cases",
    links: [
      { to: "/resume-to-portfolio", label: "Résumé to portfolio" },
      { to: "/portfolio-for-developers", label: "For developers" },
      { to: "/portfolio-for-designers", label: "For designers" },
      { to: "/portfolio-for-freelancers", label: "For freelancers" },
    ],
  },
  {
    title: "Learn",
    links: [
      { to: "/guides", label: "Guides" },
      { to: "/privacy", label: "Privacy" },
      { to: "/terms", label: "Terms" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="max-w-xs">
            <p className="flex items-center gap-2 font-display text-2xl">
              <span className="inline-block h-6 w-1.5 rounded-full bg-signal" aria-hidden="true" />
              Folio
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Folio turns a résumé into a published portfolio website. You review every line before
              anything goes live.
            </p>
          </div>
          {groups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="font-sans text-sm font-bold tracking-wide">{group.title}</h2>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Folio. Résumé files are private to your account.
        </p>
      </div>
    </footer>
  );
}
