import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Breadcrumbs, PageIntro, PageShell } from "@/components/site/PageShell";
import { Button } from "@/components/ui/button";

export type ProfessionContent = {
  slug: string;
  profession: string;
  title: string;
  lede: string;
  answer: string;
  sections: { heading: string; body: string; bullets?: string[] }[];
  template: string;
};

export function ProfessionPage({ content }: { content: ProfessionContent }) {
  return (
    <PageShell>
      <Breadcrumbs trail={[{ to: content.slug, label: content.profession }]} />
      <PageIntro eyebrow={content.profession} title={content.title} lede={content.lede} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="max-w-3xl rounded-lg border-l-4 border-signal bg-paper p-5 text-lg">
          {content.answer}
        </p>

        <div className="section-y grid gap-10 lg:grid-cols-3">
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl">{section.heading}</h2>
              <p className="mt-3 text-muted-foreground">{section.body}</p>
              {section.bullets ? (
                <ul className="mt-4 space-y-2">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-published" aria-hidden="true" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <div className="mb-20 rounded-xl border border-border bg-paper p-6 shadow-page sm:p-10">
          <h2 className="text-2xl">Recommended template: {content.template}</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            You can switch templates at any time — your content stays exactly as you approved it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/signup">Upload my résumé</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/templates">Compare templates</Link>
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
