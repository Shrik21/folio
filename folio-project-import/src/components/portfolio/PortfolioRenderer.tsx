import { ExternalLink, Github, Linkedin, Mail, MapPin } from "lucide-react";

import type { PortfolioRow } from "@/integrations/supabase/types";
import { normalizePortfolioContent, safeExternalUrl } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

const accentClasses: Record<PortfolioRow["accent"], string> = {
  ochre: "bg-signal text-signal-foreground",
  teal: "bg-published text-published-foreground",
  blue: "bg-chart-5 text-white",
  plum: "bg-chart-2 text-white",
};

function ExternalAnchor({ href, children }: { href: string; children: React.ReactNode }) {
  const safe = safeExternalUrl(href);
  if (!safe) return null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center gap-2 underline decoration-border underline-offset-4 hover:decoration-current"
    >
      {children}
    </a>
  );
}

export function PortfolioRenderer({
  portfolio,
  preview = false,
}: {
  portfolio: PortfolioRow;
  preview?: boolean;
}) {
  const content = normalizePortfolioContent(portfolio.content);
  const isAtlas = portfolio.template_key === "atlas";
  const isGallery = portfolio.template_key === "gallery";
  const isBrief = portfolio.template_key === "brief";

  return (
    <article
      className={cn(
        "portfolio-document min-h-screen bg-paper text-paper-foreground",
        isAtlas && "lg:grid lg:grid-cols-[19rem_minmax(0,1fr)]",
      )}
    >
      <header
        className={cn(
          "border-b border-border px-5 py-12 sm:px-10 lg:px-16 lg:py-20",
          isAtlas && "border-b lg:min-h-screen lg:border-b-0 lg:border-r lg:px-8 lg:py-12",
          isGallery && "bg-secondary/45",
        )}
      >
        <div className={cn("mx-auto max-w-5xl", isAtlas && "sticky top-8")}>
          <div className={cn("mb-8 h-2 w-16 rounded-full", accentClasses[portfolio.accent])} />
          <p className="text-sm font-semibold text-muted-foreground">{portfolio.profession}</p>
          <h1 className="mt-3 font-display text-5xl leading-none sm:text-6xl lg:text-7xl">
            {content.fullName || "Your name"}
          </h1>
          <p className="mt-5 max-w-2xl text-xl leading-8">{content.headline}</p>
          {content.location ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4" aria-hidden="true" /> {content.location}
            </p>
          ) : null}

          <nav aria-label="Contact links" className="mt-8 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {content.email ? (
              <a
                href={`mailto:${content.email}`}
                className="inline-flex min-h-11 items-center gap-2 underline decoration-border underline-offset-4 hover:decoration-current"
              >
                <Mail className="size-4" aria-hidden="true" /> Email
              </a>
            ) : null}
            <ExternalAnchor href={content.website}>
              <ExternalLink className="size-4" aria-hidden="true" /> Website
            </ExternalAnchor>
            <ExternalAnchor href={content.linkedin}>
              <Linkedin className="size-4" aria-hidden="true" /> LinkedIn
            </ExternalAnchor>
            <ExternalAnchor href={content.github}>
              <Github className="size-4" aria-hidden="true" /> GitHub
            </ExternalAnchor>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-10 lg:px-16 lg:py-20">
        {content.summary ? (
          <section
            aria-labelledby="about-heading"
            className="grid gap-4 border-b border-border pb-12 md:grid-cols-[11rem_1fr]"
          >
            <h2 id="about-heading" className="font-sans text-sm font-bold">
              About
            </h2>
            <p className="max-w-3xl text-lg leading-8">{content.summary}</p>
          </section>
        ) : null}

        {isBrief && content.projects.length ? (
          <Projects content={content} gallery={false} heading="Selected work" />
        ) : null}

        {content.experience.length ? (
          <section aria-labelledby="experience-heading" className="border-b border-border py-12">
            <h2 id="experience-heading" className="font-display text-3xl">
              Experience
            </h2>
            <div className="mt-8 space-y-10">
              {content.experience.map((entry) => (
                <div key={entry.id} className="grid gap-3 md:grid-cols-[11rem_1fr]">
                  <p className="text-sm text-muted-foreground">
                    {[entry.startDate, entry.endDate].filter(Boolean).join(" — ")}
                  </p>
                  <div>
                    <h3 className="font-sans text-lg font-bold">
                      {[entry.role, entry.company].filter(Boolean).join(" · ")}
                    </h3>
                    {entry.description ? (
                      <p className="mt-2 whitespace-pre-line leading-7">{entry.description}</p>
                    ) : null}
                    {entry.highlights.length ? (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6">
                        {entry.highlights.map((highlight) => (
                          <li key={highlight}>{highlight}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!isBrief && content.projects.length ? (
          <Projects content={content} gallery={isGallery} heading="Projects" />
        ) : null}

        {content.skills.length ? (
          <section aria-labelledby="skills-heading" className="border-b border-border py-12">
            <h2 id="skills-heading" className="font-display text-3xl">
              Skills
            </h2>
            <ul className="mt-6 flex flex-wrap gap-2">
              {content.skills.map((skill) => (
                <li
                  key={skill}
                  className="rounded-full border border-border bg-secondary/55 px-3 py-1.5 text-sm"
                >
                  {skill}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {content.education.length ? (
          <section aria-labelledby="education-heading" className="py-12">
            <h2 id="education-heading" className="font-display text-3xl">
              Education
            </h2>
            <div className="mt-6 space-y-5">
              {content.education.map((entry) => (
                <div key={entry.id} className="grid gap-1 md:grid-cols-[11rem_1fr]">
                  <p className="text-sm text-muted-foreground">
                    {[entry.startDate, entry.endDate].filter(Boolean).join(" — ")}
                  </p>
                  <p>
                    <strong>{entry.qualification}</strong>
                    {entry.institution ? ` · ${entry.institution}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!preview ? (
          <footer className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
            Built with{" "}
            <a href="/" className="font-semibold text-foreground underline underline-offset-4">
              Folio
            </a>
          </footer>
        ) : null}
      </div>
    </article>
  );
}

function Projects({
  content,
  gallery,
  heading,
}: {
  content: ReturnType<typeof normalizePortfolioContent>;
  gallery: boolean;
  heading: string;
}) {
  return (
    <section aria-labelledby="projects-heading" className="border-b border-border py-12">
      <h2 id="projects-heading" className="font-display text-3xl">
        {heading}
      </h2>
      <div className={cn("mt-8 grid gap-8", gallery && "md:grid-cols-2")}>
        {content.projects.map((project) => (
          <article
            key={project.id}
            className={cn(gallery && "border border-border bg-background p-6 shadow-page")}
          >
            <h3 className="font-sans text-xl font-bold">{project.name}</h3>
            {project.description ? (
              <p className="mt-3 leading-7 text-muted-foreground">{project.description}</p>
            ) : null}
            {project.outcome ? (
              <p className="mt-3 leading-7">
                <strong>Outcome:</strong> {project.outcome}
              </p>
            ) : null}
            {project.technologies.length ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {project.technologies.join(" · ")}
              </p>
            ) : null}
            {project.url ? (
              <div className="mt-4">
                <ExternalAnchor href={project.url}>
                  View project <ExternalLink className="size-4" aria-hidden="true" />
                </ExternalAnchor>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
