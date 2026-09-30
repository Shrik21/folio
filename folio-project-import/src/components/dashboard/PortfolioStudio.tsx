import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Check,
  FileText,
  LoaderCircle,
  LogOut,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PortfolioRenderer } from "@/components/portfolio/PortfolioRenderer";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Json, PortfolioRow } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import {
  emptyPortfolioContent,
  newId,
  normalizePortfolioContent,
  slugify,
  type PortfolioContent,
} from "@/lib/portfolio";
import { cn } from "@/lib/utils";

type Tab =
  "import" | "profile" | "experience" | "projects" | "education" | "appearance" | "preview";
type SaveState = "idle" | "saving" | "saved" | "error";

const tabs: Array<{ id: Tab; label: string; optional?: boolean }> = [
  { id: "import", label: "1. Add résumé" },
  { id: "profile", label: "2. Review" },
  { id: "appearance", label: "3. Style" },
  { id: "preview", label: "4. Preview" },
  { id: "experience", label: "Experience", optional: true },
  { id: "projects", label: "Projects", optional: true },
  { id: "education", label: "Education", optional: true },
];

const primaryTabs = tabs.filter((item) => !item.optional);
const optionalTabs = tabs.filter((item) => item.optional);

const templateOptions: Array<{ id: PortfolioRow["template_key"]; name: string; note: string }> = [
  { id: "ledger", name: "Ledger", note: "Editorial timeline for a clear professional story." },
  { id: "atlas", name: "Atlas", note: "Persistent profile rail for deep experience." },
  { id: "gallery", name: "Gallery", note: "A visual project grid for case studies." },
  { id: "brief", name: "Brief", note: "Outcome-led work for freelancers and consultants." },
];

const accents: Array<{ id: PortfolioRow["accent"]; label: string; className: string }> = [
  { id: "ochre", label: "Ochre", className: "bg-signal" },
  { id: "teal", label: "Teal", className: "bg-published" },
  { id: "blue", label: "Blue", className: "bg-chart-5" },
  { id: "plum", label: "Plum", className: "bg-chart-2" },
];

export function PortfolioStudio({
  userId,
  email,
  mode = "supabase",
  onSignOut,
}: {
  userId: string;
  email: string;
  mode?: "supabase" | "local";
  onSignOut: () => Promise<void>;
}) {
  const [portfolio, setPortfolio] = useState<PortfolioRow | null>(null);
  const [content, setContent] = useState<PortfolioContent>(emptyPortfolioContent);
  const [tab, setTab] = useState<Tab>("import");
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [structuring, setStructuring] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [reviewFields, setReviewFields] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (mode === "local") {
        const storageKey = `folio-local-portfolio:${userId}`;
        const stored = window.localStorage.getItem(storageKey);
        let next: PortfolioRow | null = null;
        if (stored) {
          try {
            next = JSON.parse(stored) as PortfolioRow;
          } catch {
            window.localStorage.removeItem(storageKey);
          }
        }
        if (!next) {
          const now = new Date().toISOString();
          next = {
            id: crypto.randomUUID(),
            user_id: userId,
            name: "My portfolio",
            slug: `portfolio-${userId.slice(0, 8)}`,
            profession: "professional",
            purpose: "job-search",
            template_key: "ledger",
            accent: "ochre",
            status: "draft",
            content: emptyPortfolioContent as unknown as Json,
            ai_meta: {},
            view_count: 0,
            published_at: null,
            created_at: now,
            updated_at: now,
          };
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        }
        if (!active) return;
        setPortfolio(next);
        setContent(normalizePortfolioContent(next.content));
        setLoading(false);
        return;
      }

      const existing = await supabase
        .from("portfolios")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (existing.error) {
        setSetupError(existing.error.message);
        setLoading(false);
        return;
      }

      let next = existing.data;
      if (!next) {
        const created = await supabase
          .from("portfolios")
          .insert({
            user_id: userId,
            slug: `portfolio-${userId.slice(0, 8)}`,
            content: emptyPortfolioContent as unknown as Json,
          })
          .select("*")
          .single();
        if (!active) return;
        if (created.error) {
          setSetupError(created.error.message);
          setLoading(false);
          return;
        }
        next = created.data;
      }

      setPortfolio(next);
      setContent(normalizePortfolioContent(next.content));
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [mode, userId]);

  async function persist(
    nextContent = content,
    patch: Partial<
      Pick<
        PortfolioRow,
        | "name"
        | "slug"
        | "profession"
        | "purpose"
        | "template_key"
        | "accent"
        | "status"
        | "published_at"
        | "ai_meta"
      >
    > = {},
  ) {
    if (!portfolio) return false;
    setSaveState("saving");
    if (mode === "local") {
      const updated: PortfolioRow = {
        ...portfolio,
        ...patch,
        content: nextContent as unknown as Json,
        updated_at: new Date().toISOString(),
      };
      window.localStorage.setItem(`folio-local-portfolio:${userId}`, JSON.stringify(updated));
      if (updated.status === "published") {
        window.localStorage.setItem(`folio-local-public:${updated.slug}`, JSON.stringify(updated));
      } else {
        window.localStorage.removeItem(`folio-local-public:${updated.slug}`);
      }
      setPortfolio(updated);
      setContent(nextContent);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2500);
      return true;
    }

    const result = await supabase
      .from("portfolios")
      .update({
        name: portfolio.name,
        slug: portfolio.slug,
        profession: portfolio.profession,
        purpose: portfolio.purpose,
        template_key: portfolio.template_key,
        accent: portfolio.accent,
        ...patch,
        content: nextContent as unknown as Json,
      })
      .eq("id", portfolio.id)
      .select("*")
      .single();
    if (result.error) {
      setSaveState("error");
      toast.error(result.error.message);
      return false;
    }
    setPortfolio(result.data);
    setContent(normalizePortfolioContent(result.data.content));
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), 2500);
    return true;
  }

  async function structureResume() {
    if (!resumeFile && resumeText.trim().length < 40) {
      toast.error("Choose a résumé or paste at least a few lines of text.");
      return;
    }
    setStructuring(true);
    setAiMessage(null);
    try {
      let token = "";
      if (mode === "supabase") {
        const session = await supabase.auth.getSession();
        token = session.data.session?.access_token ?? "";
        if (!token) throw new Error("Your session expired. Log in again.");
      }

      if (resumeFile && mode === "supabase") {
        const safeName = resumeFile.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
        const path = `${userId}/${Date.now()}-${safeName}`;
        const upload = await supabase.storage.from("resumes").upload(path, resumeFile, {
          upsert: false,
          contentType: resumeFile.type,
        });
        if (upload.error) throw upload.error;
      }

      const form = new FormData();
      if (resumeFile) form.set("file", resumeFile);
      if (resumeText.trim()) form.set("text", resumeText.trim());
      const response = await fetch("/api/ai-structure", {
        method: "POST",
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        body: form,
      });
      const result = (await response.json()) as {
        content?: unknown;
        reviewFields?: string[];
        message?: string;
        provider?: string;
        error?: string;
      };
      if (!response.ok || !result.content)
        throw new Error(result.error ?? "Résumé processing failed.");
      const structured = normalizePortfolioContent(result.content);
      setContent(structured);
      setReviewFields(result.reviewFields ?? []);
      setAiMessage(result.message ?? "Résumé structured. Review the fields before publishing.");
      await persist(structured, {
        name: structured.fullName
          ? `${structured.fullName}'s portfolio`
          : (portfolio?.name ?? "Untitled portfolio"),
        ai_meta: {
          provider: result.provider ?? "unknown",
          reviewFields: result.reviewFields ?? [],
          structuredAt: new Date().toISOString(),
        } as Json,
      });
      setTab("profile");
      toast.success("Résumé imported. Review every section before publishing.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Résumé processing failed.");
    } finally {
      setStructuring(false);
    }
  }

  async function publish() {
    if (!portfolio) return;
    if (!content.fullName || !content.headline) {
      setTab("profile");
      toast.error("Add your name and headline before publishing.");
      return;
    }
    const nextSlug =
      slugify(portfolio.slug || content.fullName) || `portfolio-${userId.slice(0, 8)}`;
    const ok = await persist(content, {
      slug: nextSlug,
      name: portfolio.name || `${content.fullName}'s portfolio`,
      status: "published",
      published_at: new Date().toISOString(),
    });
    if (ok) toast.success("Portfolio published.");
  }

  async function unpublish() {
    const ok = await persist(content, { status: "unpublished" });
    if (ok) toast.success("Portfolio unpublished.");
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Opening your studio…
        </p>
      </div>
    );
  }

  if (setupError || !portfolio) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-xl border border-border bg-paper p-8 shadow-page">
          <p className="eyebrow">Setup required</p>
          <h1 className="mt-3 font-display text-4xl">Connect the Folio database</h1>
          <p className="mt-4 text-muted-foreground">
            Apply <code>supabase/migrations/202609210001_folio_core.sql</code>, configure the
            Supabase environment variables, then refresh this page.
          </p>
          <p className="mt-4 rounded-md bg-secondary p-3 font-mono text-xs">{setupError}</p>
        </div>
      </div>
    );
  }

  const previewPortfolio: PortfolioRow = { ...portfolio, content: content as unknown as Json };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-display text-2xl">
            <span className="h-6 w-1.5 rounded-full bg-signal" aria-hidden="true" /> Folio
          </Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">Portfolio studio</span>
          {mode === "local" ? <Badge variant="secondary">Local mode</Badge> : null}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <span className="hidden text-sm text-muted-foreground lg:inline">{email}</span>
            <SaveStatus state={saveState} />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={() => void onSignOut()}
              aria-label="Log out"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-secondary/35 px-4 py-4 lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r lg:px-5 lg:py-7">
          <div className="mb-5 flex items-center justify-between gap-3 lg:block">
            <div>
              <p className="text-sm font-semibold">{portfolio.name}</p>
              <Badge
                variant={portfolio.status === "published" ? "default" : "secondary"}
                className="mt-2"
              >
                {portfolio.status}
              </Badge>
            </div>
            {portfolio.status === "published" ? (
              <Button asChild variant="outline" size="sm" className="lg:mt-4 lg:w-full">
                <a
                  href={mode === "local" ? `/local/${portfolio.slug}` : `/p/${portfolio.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View live <ArrowUpRight aria-hidden="true" />
                </a>
              </Button>
            ) : null}
          </div>
          <nav aria-label="Portfolio editor" className="flex gap-1 overflow-x-auto lg:grid">
            <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:mb-1 lg:block">
              Simple path
            </span>
            {primaryTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={cn(
                  "min-h-11 shrink-0 rounded-md px-3 text-left text-sm font-medium transition-colors",
                  tab === item.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {item.label}
              </button>
            ))}
            <span className="ml-2 self-center whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:ml-0 lg:mt-5">
              Optional details
            </span>
            {optionalTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={cn(
                  "min-h-11 shrink-0 rounded-md px-3 text-left text-sm font-medium transition-colors",
                  tab === item.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-5xl">
            {tab === "import" ? (
              <ImportPanel
                resumeText={resumeText}
                setResumeText={setResumeText}
                resumeFile={resumeFile}
                setResumeFile={setResumeFile}
                structuring={structuring}
                onStructure={() => void structureResume()}
                fileInput={fileInput}
                aiMessage={aiMessage}
              />
            ) : null}
            {tab === "profile" ? (
              <ProfilePanel content={content} setContent={setContent} reviewFields={reviewFields} />
            ) : null}
            {tab === "experience" ? (
              <ExperiencePanel content={content} setContent={setContent} />
            ) : null}
            {tab === "projects" ? (
              <ProjectsPanel content={content} setContent={setContent} />
            ) : null}
            {tab === "education" ? (
              <EducationPanel content={content} setContent={setContent} />
            ) : null}
            {tab === "appearance" ? (
              <AppearancePanel portfolio={portfolio} setPortfolio={setPortfolio} />
            ) : null}
            {tab === "preview" ? (
              <div>
                <PanelHeading
                  title="Preview"
                  description="This is the same renderer used by your public page."
                />
                <div className="mt-6 overflow-hidden border border-border shadow-page">
                  <PortfolioRenderer portfolio={previewPortfolio} preview />
                </div>
              </div>
            ) : null}

            <div className="sticky bottom-4 mt-8 flex flex-wrap items-center justify-end gap-2 border border-border bg-paper/95 p-3 shadow-lift backdrop-blur">
              {portfolio.status === "published" ? (
                <Button variant="outline" onClick={() => void unpublish()}>
                  Unpublish
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => void persist()}
                disabled={saveState === "saving"}
              >
                <Save aria-hidden="true" /> Save changes
              </Button>
              <Button onClick={() => void publish()} disabled={saveState === "saving"}>
                {portfolio.status === "published" ? "Update live portfolio" : "Publish portfolio"}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function PanelHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-border pb-5">
      <h1 className="font-display text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
    </div>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span
      role="status"
      aria-atomic="true"
      className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"
    >
      {state === "saving" ? (
        <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
      ) : null}
      {state === "saved" ? <Check className="size-3 text-published" aria-hidden="true" /> : null}
      {state === "error"
        ? "Save failed"
        : state === "saving"
          ? "Saving…"
          : state === "saved"
            ? "Saved"
            : ""}
    </span>
  );
}

function ImportPanel(props: {
  resumeText: string;
  setResumeText: (value: string) => void;
  resumeFile: File | null;
  setResumeFile: (file: File | null) => void;
  structuring: boolean;
  onStructure: () => void;
  fileInput: React.RefObject<HTMLInputElement | null>;
  aiMessage: string | null;
}) {
  return (
    <div>
      <PanelHeading
        title="Start with what you already have"
        description="Upload a PDF or DOCX, or paste résumé text. Folio extracts facts and flags uncertainty instead of inventing details."
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="border border-border bg-paper p-6 shadow-page">
          <FileText className="size-7 text-signal" aria-hidden="true" />
          <h2 className="mt-4 font-sans text-lg font-bold">Upload your résumé</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            PDF, DOCX, or TXT. Maximum 8 MB and 30 PDF pages.
          </p>
          <input
            ref={props.fileInput}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="sr-only"
            onChange={(event) => props.setResumeFile(event.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            className="mt-5 min-h-11"
            onClick={() => props.fileInput.current?.click()}
          >
            Choose résumé
          </Button>
          {props.resumeFile ? (
            <p className="mt-3 break-all text-sm font-medium">{props.resumeFile.name}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="resume-text">Or paste résumé text</Label>
          <Textarea
            id="resume-text"
            value={props.resumeText}
            onChange={(event) => props.setResumeText(event.target.value)}
            placeholder="Paste the text from your résumé…"
            className="mt-2 min-h-48 bg-paper"
          />
        </div>
      </div>
      {props.aiMessage ? (
        <p role="status" className="mt-5 border-l-4 border-published bg-secondary p-4 text-sm">
          {props.aiMessage}
        </p>
      ) : null}
      <Button
        size="lg"
        className="mt-6 min-h-11"
        onClick={props.onStructure}
        disabled={props.structuring}
      >
        {props.structuring ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles aria-hidden="true" />
        )}
        {props.structuring ? "Creating portfolio…" : "Create my portfolio"}
      </Button>
    </div>
  );
}

function ProfilePanel({
  content,
  setContent,
  reviewFields,
}: {
  content: PortfolioContent;
  setContent: React.Dispatch<React.SetStateAction<PortfolioContent>>;
  reviewFields: string[];
}) {
  function field<K extends keyof PortfolioContent>(key: K, value: PortfolioContent[K]) {
    setContent((current) => ({ ...current, [key]: value }));
  }
  return (
    <div>
      <PanelHeading
        title="Profile"
        description="Set the first impression. Keep claims specific and easy to verify."
      />
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="Full name" id="full-name" review={reviewFields.includes("fullName")}>
          <Input
            id="full-name"
            value={content.fullName}
            onChange={(e) => field("fullName", e.target.value)}
          />
        </Field>
        <Field
          label="Professional headline"
          id="headline"
          review={reviewFields.includes("headline")}
        >
          <Input
            id="headline"
            value={content.headline}
            onChange={(e) => field("headline", e.target.value)}
            placeholder="Product designer building accessible systems"
          />
        </Field>
        <Field label="Location" id="location">
          <Input
            id="location"
            value={content.location}
            onChange={(e) => field("location", e.target.value)}
          />
        </Field>
        <Field label="Public email" id="public-email">
          <Input
            id="public-email"
            type="email"
            value={content.email}
            onChange={(e) => field("email", e.target.value)}
          />
        </Field>
        <Field label="Website" id="website">
          <Input
            id="website"
            value={content.website}
            onChange={(e) => field("website", e.target.value)}
          />
        </Field>
        <Field label="LinkedIn" id="linkedin">
          <Input
            id="linkedin"
            value={content.linkedin}
            onChange={(e) => field("linkedin", e.target.value)}
          />
        </Field>
        <Field label="GitHub" id="github">
          <Input
            id="github"
            value={content.github}
            onChange={(e) => field("github", e.target.value)}
          />
        </Field>
        <Field label="Phone" id="phone">
          <Input
            id="phone"
            value={content.phone}
            onChange={(e) => field("phone", e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Summary" id="summary" review={reviewFields.includes("summary")}>
            <Textarea
              id="summary"
              className="min-h-32"
              value={content.summary}
              onChange={(e) => field("summary", e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Skills" id="skills" helper="Separate skills with commas.">
            <Input
              id="skills"
              value={content.skills.join(", ")}
              onChange={(e) =>
                field(
                  "skills",
                  e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                )
              }
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  helper,
  review,
  children,
}: {
  label: string;
  id: string;
  helper?: string;
  review?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {review ? <Badge variant="secondary">Needs review</Badge> : null}
      </div>
      {children}
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function ExperiencePanel({
  content,
  setContent,
}: {
  content: PortfolioContent;
  setContent: React.Dispatch<React.SetStateAction<PortfolioContent>>;
}) {
  const update = (index: number, patch: Partial<PortfolioContent["experience"][number]>) =>
    setContent((current) => ({
      ...current,
      experience: current.experience.map((item, i) =>
        i === index ? { ...item, ...patch, needsReview: false } : item,
      ),
    }));
  return (
    <div>
      <PanelHeading
        title="Experience"
        description="Show the role, context, and evidence of what changed because of your work."
      />
      <div className="mt-7 space-y-5">
        {content.experience.map((item, index) => (
          <section key={item.id} className="border border-border bg-paper p-5 shadow-page">
            <div className="flex items-center justify-between">
              <h2 className="font-sans font-bold">Experience {index + 1}</h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove experience ${index + 1}`}
                onClick={() =>
                  setContent((current) => ({
                    ...current,
                    experience: current.experience.filter((_, i) => i !== index),
                  }))
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Role" id={`role-${index}`}>
                <Input
                  id={`role-${index}`}
                  value={item.role}
                  onChange={(e) => update(index, { role: e.target.value })}
                />
              </Field>
              <Field label="Company" id={`company-${index}`}>
                <Input
                  id={`company-${index}`}
                  value={item.company}
                  onChange={(e) => update(index, { company: e.target.value })}
                />
              </Field>
              <Field label="Start" id={`start-${index}`}>
                <Input
                  id={`start-${index}`}
                  value={item.startDate}
                  onChange={(e) => update(index, { startDate: e.target.value })}
                  placeholder="Jan 2024"
                />
              </Field>
              <Field label="End" id={`end-${index}`}>
                <Input
                  id={`end-${index}`}
                  value={item.endDate}
                  onChange={(e) => update(index, { endDate: e.target.value })}
                  placeholder="Present"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description" id={`experience-description-${index}`}>
                  <Textarea
                    id={`experience-description-${index}`}
                    value={item.description}
                    onChange={(e) => update(index, { description: e.target.value })}
                    className="min-h-28"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Highlights"
                  id={`highlights-${index}`}
                  helper="One achievement per line."
                >
                  <Textarea
                    id={`highlights-${index}`}
                    value={item.highlights.join("\n")}
                    onChange={(e) =>
                      update(index, {
                        highlights: e.target.value
                          .split("\n")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          </section>
        ))}
      </div>
      <Button
        variant="outline"
        className="mt-5"
        onClick={() =>
          setContent((current) => ({
            ...current,
            experience: [
              ...current.experience,
              {
                id: newId("experience"),
                company: "",
                role: "",
                startDate: "",
                endDate: "",
                description: "",
                highlights: [],
                needsReview: false,
              },
            ],
          }))
        }
      >
        <Plus aria-hidden="true" /> Add experience
      </Button>
    </div>
  );
}

function ProjectsPanel({
  content,
  setContent,
}: {
  content: PortfolioContent;
  setContent: React.Dispatch<React.SetStateAction<PortfolioContent>>;
}) {
  const update = (index: number, patch: Partial<PortfolioContent["projects"][number]>) =>
    setContent((current) => ({
      ...current,
      projects: current.projects.map((item, i) =>
        i === index ? { ...item, ...patch, needsReview: false } : item,
      ),
    }));
  return (
    <div>
      <PanelHeading
        title="Projects"
        description="Use projects as evidence: the problem, your contribution, and the outcome."
      />
      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        {content.projects.map((item, index) => (
          <section key={item.id} className="border border-border bg-paper p-5 shadow-page">
            <div className="flex items-center justify-between">
              <h2 className="font-sans font-bold">Project {index + 1}</h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove project ${index + 1}`}
                onClick={() =>
                  setContent((current) => ({
                    ...current,
                    projects: current.projects.filter((_, i) => i !== index),
                  }))
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-4 grid gap-4">
              <Field label="Project name" id={`project-name-${index}`}>
                <Input
                  id={`project-name-${index}`}
                  value={item.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </Field>
              <Field label="Description" id={`project-description-${index}`}>
                <Textarea
                  id={`project-description-${index}`}
                  value={item.description}
                  onChange={(e) => update(index, { description: e.target.value })}
                />
              </Field>
              <Field label="Outcome" id={`project-outcome-${index}`}>
                <Textarea
                  id={`project-outcome-${index}`}
                  value={item.outcome}
                  onChange={(e) => update(index, { outcome: e.target.value })}
                />
              </Field>
              <Field label="Project URL" id={`project-url-${index}`}>
                <Input
                  id={`project-url-${index}`}
                  value={item.url}
                  onChange={(e) => update(index, { url: e.target.value })}
                />
              </Field>
              <Field
                label="Technologies"
                id={`project-tech-${index}`}
                helper="Separate with commas."
              >
                <Input
                  id={`project-tech-${index}`}
                  value={item.technologies.join(", ")}
                  onChange={(e) =>
                    update(index, {
                      technologies: e.target.value
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
            </div>
          </section>
        ))}
      </div>
      <Button
        variant="outline"
        className="mt-5"
        onClick={() =>
          setContent((current) => ({
            ...current,
            projects: [
              ...current.projects,
              {
                id: newId("project"),
                name: "",
                description: "",
                outcome: "",
                url: "",
                technologies: [],
                needsReview: false,
              },
            ],
          }))
        }
      >
        <Plus aria-hidden="true" /> Add project
      </Button>
    </div>
  );
}

function EducationPanel({
  content,
  setContent,
}: {
  content: PortfolioContent;
  setContent: React.Dispatch<React.SetStateAction<PortfolioContent>>;
}) {
  const update = (index: number, patch: Partial<PortfolioContent["education"][number]>) =>
    setContent((current) => ({
      ...current,
      education: current.education.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch, needsReview: false } : item,
      ),
    }));
  return (
    <div>
      <PanelHeading
        title="Education"
        description="Add qualifications that strengthen the story your portfolio tells."
      />
      <div className="mt-7 space-y-5">
        {content.education.map((item, index) => (
          <section key={item.id} className="border border-border bg-paper p-5 shadow-page">
            <div className="flex items-center justify-between">
              <h2 className="font-sans font-bold">Education {index + 1}</h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove education ${index + 1}`}
                onClick={() =>
                  setContent((current) => ({
                    ...current,
                    education: current.education.filter((_, itemIndex) => itemIndex !== index),
                  }))
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Qualification" id={`qualification-${index}`}>
                <Input
                  id={`qualification-${index}`}
                  value={item.qualification}
                  onChange={(event) => update(index, { qualification: event.target.value })}
                />
              </Field>
              <Field label="Institution" id={`institution-${index}`}>
                <Input
                  id={`institution-${index}`}
                  value={item.institution}
                  onChange={(event) => update(index, { institution: event.target.value })}
                />
              </Field>
              <Field label="Start" id={`education-start-${index}`}>
                <Input
                  id={`education-start-${index}`}
                  value={item.startDate}
                  onChange={(event) => update(index, { startDate: event.target.value })}
                />
              </Field>
              <Field label="End" id={`education-end-${index}`}>
                <Input
                  id={`education-end-${index}`}
                  value={item.endDate}
                  onChange={(event) => update(index, { endDate: event.target.value })}
                />
              </Field>
            </div>
          </section>
        ))}
      </div>
      <Button
        variant="outline"
        className="mt-5"
        onClick={() =>
          setContent((current) => ({
            ...current,
            education: [
              ...current.education,
              {
                id: newId("education"),
                institution: "",
                qualification: "",
                startDate: "",
                endDate: "",
                needsReview: false,
              },
            ],
          }))
        }
      >
        <Plus aria-hidden="true" /> Add education
      </Button>
    </div>
  );
}

function AppearancePanel({
  portfolio,
  setPortfolio,
}: {
  portfolio: PortfolioRow;
  setPortfolio: React.Dispatch<React.SetStateAction<PortfolioRow | null>>;
}) {
  function update(patch: Partial<PortfolioRow>) {
    setPortfolio((current) => (current ? { ...current, ...patch } : current));
  }
  return (
    <div>
      <PanelHeading
        title="Appearance and URL"
        description="Choose a layout that matches how your work is evaluated, then set the public address."
      />
      <fieldset className="mt-7">
        <legend className="font-sans font-bold">Template</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {templateOptions.map((option) => (
            <label
              key={option.id}
              className={cn(
                "cursor-pointer border bg-paper p-5 transition-colors",
                portfolio.template_key === option.id
                  ? "border-signal ring-2 ring-signal/20"
                  : "border-border hover:border-foreground/40",
              )}
            >
              <input
                type="radio"
                name="template"
                value={option.id}
                checked={portfolio.template_key === option.id}
                onChange={() => update({ template_key: option.id })}
                className="sr-only"
              />
              <span className="font-sans font-bold">{option.name}</span>
              <span className="mt-2 block text-sm text-muted-foreground">{option.note}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-7">
        <legend className="font-sans font-bold">Accent</legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {accents.map((accent) => (
            <label
              key={accent.id}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3",
                portfolio.accent === accent.id ? "border-foreground" : "border-border",
              )}
            >
              <input
                type="radio"
                name="accent"
                value={accent.id}
                checked={portfolio.accent === accent.id}
                onChange={() => update({ accent: accent.id })}
                className="sr-only"
              />
              <span className={cn("size-4 rounded-full", accent.className)} aria-hidden="true" />
              {accent.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <Field label="Portfolio name" id="portfolio-name">
          <Input
            id="portfolio-name"
            value={portfolio.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </Field>
        <Field label="Public slug" id="portfolio-slug" helper={`/p/${portfolio.slug}`}>
          <Input
            id="portfolio-slug"
            value={portfolio.slug}
            onChange={(e) => update({ slug: slugify(e.target.value) })}
          />
        </Field>
        <Field label="Profession" id="profession">
          <Input
            id="profession"
            value={portfolio.profession}
            onChange={(e) => update({ profession: e.target.value })}
          />
        </Field>
        <Field label="Purpose" id="purpose">
          <select
            id="purpose"
            value={portfolio.purpose}
            onChange={(e) => update({ purpose: e.target.value })}
            className="flex min-h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          >
            <option value="job-search">Find a role</option>
            <option value="freelance">Win freelance work</option>
            <option value="reputation">Build professional credibility</option>
          </select>
        </Field>
      </div>
    </div>
  );
}
