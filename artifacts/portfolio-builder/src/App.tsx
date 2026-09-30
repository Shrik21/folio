import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Globe2,
  Layers3,
  LayoutDashboard,
  Link2,
  Loader2,
  Lock,
  Menu,
  Palette,
  Pencil,
  Plus,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";
import {
  getGetAdminSessionQueryKey,
  getGetCurrentPortfolioQueryKey,
  getGetPublicPortfolioQueryKey,
  getListTemplatesQueryKey,
  useAdminLogin,
  useAdminLogout,
  useCreatePortfolio,
  useGetAdminSession,
  useGetCurrentPortfolio,
  useGetPublicPortfolio,
  useListTemplates,
  useParseResume,
  usePublishPortfolio,
  useUnpublishPortfolio,
  useUpdatePortfolio,
} from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import {
  Link,
  Route,
  Router as WouterRouter,
  Switch,
  useLocation,
  useParams,
} from "wouter";

import { queryClient } from "@/lib/folio-data";
import { Landing, Templates, Pricing } from "@/pages/marketing";
import { Auth, AdminPage, AdminGate } from "@/pages/auth";
import {
  OnboardingLayout,
  UploadPage,
  DetailsPage,
  ProfessionPage,
  PreviewPage,
} from "@/pages/onboarding";
import {
  DashboardHome,
  DashboardPage,
  PublicPortfolio,
} from "@/pages/workspace";

function Router() {
  const [location] = useLocation();
  const dashboard = location.startsWith("/dashboard");
  return (
    <div key={location} className="page-enter">
      <ErrorBoundary resetKey={location}>
        {dashboard ? (
          <AdminGate>
            <Switch>
              <Route path="/dashboard" component={DashboardHome} />
              <Route
                path="/dashboard/portfolio"
                component={() => <DashboardPage section="portfolio" />}
              />
              <Route
                path="/dashboard/content"
                component={() => <DashboardPage section="content" />}
              />
              <Route
                path="/dashboard/templates"
                component={() => <DashboardPage section="templates" />}
              />
              <Route
                path="/dashboard/appearance"
                component={() => <DashboardPage section="appearance" />}
              />
              <Route
                path="/dashboard/domain"
                component={() => <DashboardPage section="domain" />}
              />
              <Route
                path="/dashboard/analytics"
                component={() => <DashboardPage section="analytics" />}
              />
              <Route
                path="/dashboard/billing"
                component={() => <DashboardPage section="billing" />}
              />
              <Route
                path="/dashboard/settings"
                component={() => <DashboardPage section="settings" />}
              />
              <Route component={NotFound} />
            </Switch>
          </AdminGate>
        ) : (
          <Switch>
            <Route path="/" component={Landing} />
            <Route path="/templates" component={() => <Templates />} />
            <Route path="/pricing" component={Pricing} />
            <Route path="/login" component={() => <Auth />} />
            <Route path="/signup" component={() => <Auth signup />} />
            <Route path="/admin" component={AdminPage} />
            <Route
              path="/onboarding"
              component={() => (
                <OnboardingLayout
                  current={0}
                  eyebrow="A short guided setup"
                  title="Five thoughtful minutes to a portfolio you can share."
                >
                  <div className="mt-12 grid gap-3 sm:grid-cols-2">
                    {[
                      [
                        "01",
                        "Upload your resume",
                        "We start with the experience you already have.",
                      ],
                      [
                        "02",
                        "Review the first draft",
                        "Keep what sounds like you.",
                      ],
                      [
                        "03",
                        "Choose your direction",
                        "Give the page a purpose.",
                      ],
                      [
                        "04",
                        "Pick a template",
                        "Find the right room for the work.",
                      ],
                      [
                        "05",
                        "Preview and publish",
                        "Send it out when it feels ready.",
                      ],
                    ].map(([n, t, d]) => (
                      <Link
                        href={
                          n === "01"
                            ? "/onboarding/upload"
                            : n === "02"
                              ? "/onboarding/details"
                              : n === "03"
                                ? "/onboarding/profession"
                                : n === "04"
                                  ? "/onboarding/templates"
                                  : "/onboarding/preview"
                        }
                        key={n}
                        data-testid={`link-onboarding-step-${n}`}
                        className="group flex items-center gap-5 border border-border bg-card p-5 hover:-translate-y-0.5 hover:border-foreground"
                      >
                        <span className="font-mono-ui text-xs text-accent">
                          {n}
                        </span>
                        <span className="flex-1">
                          <strong className="block">{t}</strong>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {d}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </Link>
                    ))}
                  </div>
                </OnboardingLayout>
              )}
            />
            <Route path="/onboarding/upload" component={UploadPage} />
            <Route path="/onboarding/details" component={DetailsPage} />
            <Route path="/onboarding/profession" component={ProfessionPage} />
            <Route
              path="/onboarding/templates"
              component={() => <Templates onboarding />}
            />
            <Route path="/onboarding/preview" component={PreviewPage} />
            <Route path="/p/:slug" component={PublicPortfolio} />
            <Route component={NotFound} />
          </Switch>
        )}
      </ErrorBoundary>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
