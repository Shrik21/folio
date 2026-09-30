import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ArrowRight, CheckCircle2, FileText, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

const resumeLines = [
  "JORDAN ELLIS",
  "Senior Frontend Engineer — Bristol, UK",
  "EXPERIENCE",
  "Northlane · Senior Frontend Engineer · 2022–present",
  "— Led rebuild of the checkout flow (React, TypeScript)",
  "— Cut median page load from 3.4s to 1.6s",
  "Kite Digital · Frontend Engineer · 2019–2022",
  "— Built the design system used by 4 product teams",
  "EDUCATION",
  "BSc Computer Science, University of Bath, 2019",
  "SKILLS",
  "TypeScript · React · Accessibility · Performance",
];

const fields = [
  { label: "Name", value: "Jordan Ellis", status: "confirmed" as const },
  { label: "Headline", value: "Senior Frontend Engineer", status: "confirmed" as const },
  {
    label: "Role · Northlane",
    value: "Senior Frontend Engineer, 2022 – present",
    status: "confirmed" as const,
  },
  {
    label: "Highlight",
    value: "Cut median page load from 3.4s to 1.6s",
    status: "review" as const,
  },
  {
    label: "Education",
    value: "BSc Computer Science, University of Bath, 2019",
    status: "confirmed" as const,
  },
  {
    label: "Skills",
    value: "TypeScript, React, Accessibility, Performance",
    status: "confirmed" as const,
  },
];

export function ResumeTransform() {
  const [transformed, setTransformed] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <div className="rounded-xl border border-border bg-paper p-4 shadow-page sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Résumé → portfolio</p>
        <Button
          onClick={() => setTransformed((value) => !value)}
          variant={transformed ? "outline" : "default"}
          aria-pressed={transformed}
        >
          {transformed ? "Show the original résumé" : "Transform this résumé"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="paper-ruled min-w-0 rounded-lg border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
            jordan-ellis-cv.pdf
          </p>
          <ul className="mt-3 min-w-0 space-y-1 font-mono text-[0.72rem] leading-7 text-muted-foreground">
            {resumeLines.map((line) => (
              <li key={line} className="truncate">
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 rounded-lg border border-border bg-background p-4">
          <p aria-live="polite" className="text-sm font-semibold">
            {transformed ? "Structured portfolio content" : "Nothing extracted yet"}
          </p>
          <ul className="mt-3 space-y-2">
            {fields.map((field, index) => (
              <motion.li
                key={field.label}
                initial={false}
                animate={
                  transformed ? { opacity: 1, y: 0 } : { opacity: 0.25, y: reduceMotion ? 0 : 6 }
                }
                transition={
                  reduceMotion ? { duration: 0 } : { duration: 0.32, delay: index * 0.06 }
                }
                className="rounded-md border border-border bg-paper px-3 py-2"
              >
                <span className="block text-xs font-semibold tracking-wide text-muted-foreground">
                  {field.label}
                </span>
                <span className="mt-0.5 flex items-start gap-2 text-sm">
                  {field.status === "review" ? (
                    <TriangleAlert
                      className="mt-0.5 size-4 shrink-0 text-signal"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-published"
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    {field.value}
                    {field.status === "review" ? (
                      <span className="ml-2 rounded-sm bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-foreground">
                        Needs your review
                      </span>
                    ) : null}
                  </span>
                </span>
              </motion.li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Every field comes from the uploaded text. Folio adds no employers, dates or numbers of
            its own.
          </p>
        </div>
      </div>
    </div>
  );
}
