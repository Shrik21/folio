import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { loginHardcodedAdmin } from "@/lib/admin-auth";
import { getAuthConfiguration, loginLocalUser, signupLocalUser } from "@/lib/local-auth";

export function AuthCard({
  mode,
  redirectTo = "/dashboard",
  title,
}: {
  mode: "login" | "signup";
  redirectTo?: "/dashboard" | "/admin";
  title?: string;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [supabaseConfigured, setSupabaseConfigured] = useState<boolean | null>(null);

  const isSignup = mode === "signup";

  useEffect(() => {
    let active = true;
    void getAuthConfiguration().then((configuration) => {
      if (active) setSupabaseConfigured(configuration.supabaseConfigured);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const configuration = await getAuthConfiguration();
      setSupabaseConfigured(configuration.supabaseConfigured);

      if (isSignup) {
        if (!configuration.supabaseConfigured) {
          await signupLocalUser({ data: { email, password } });
          toast.success("Local account created. Your portfolio is ready.");
          await navigate({ to: "/dashboard" });
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          toast.success("Check your email to confirm your account, then log in.");
          setBusy(false);
          return;
        }
        toast.success("Account created. Let's turn your résumé into a portfolio.");
      } else {
        // The requested hardcoded administrator account is accepted from the
        // normal login page as well as the dedicated admin login page.
        const adminSession = await loginHardcodedAdmin({ data: { email, password } });
        if (adminSession.authenticated) {
          toast.success("Administrator login successful.");
          await navigate({ to: "/admin" });
          return;
        }

        if (!configuration.supabaseConfigured) {
          const localResult = await loginLocalUser({ data: { email, password } });
          if (!localResult.session) {
            throw new Error(
              "No matching local account was found. Create one first, or use the same email and password you used on this browser.",
            );
          }
          toast.success("Welcome back.");
          await navigate({ to: "/dashboard" });
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
      await navigate({ to: redirectTo });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    const configuration = await getAuthConfiguration();
    if (!configuration.supabaseConfigured) {
      setError("Google sign-in becomes available after Supabase is connected.");
      return;
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in could not start. Please try again or use your email address.");
      return;
    }
    if (result.redirected) return;
    await navigate({ to: redirectTo });
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-paper p-6 shadow-page sm:p-8">
      <h1 className="display-lg text-4xl">
        {title ?? (isSignup ? "Create your Folio account" : "Log in to Folio")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isSignup
          ? "Free to start. One published portfolio, no card needed."
          : "Welcome back — pick up where your portfolio left off."}
      </p>

      {supabaseConfigured === false ? (
        <div className="mt-5 rounded-lg border border-signal/35 bg-signal/10 p-3 text-sm">
          <strong>Local mode</strong>
          <span className="mt-1 block text-muted-foreground">
            Start now without cloud setup. Your account and portfolio stay on this browser.
          </span>
        </div>
      ) : null}

      {supabaseConfigured ? (
        <>
          <Button variant="outline" className="mt-6 min-h-11 w-full" onClick={handleGoogle}>
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or use your email
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : (
        <div className="h-5" />
      )}

      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby={error ? "auth-error" : undefined}
            className="min-h-11"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-11"
          />
          {isSignup ? (
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          ) : null}
        </div>

        {error ? (
          <p id="auth-error" role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={busy} className="min-h-11">
          {busy
            ? isSignup
              ? "Creating account…"
              : "Logging in…"
            : isSignup
              ? supabaseConfigured === false
                ? "Create local account"
                : "Create account"
              : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
              Log in
            </Link>
          </>
        ) : (
          <>
            New to Folio?{" "}
            <Link to="/signup" className="font-medium text-foreground underline underline-offset-4">
              Create an account
            </Link>
          </>
        )}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        By continuing you agree to our{" "}
        <Link to="/terms" className="underline underline-offset-4">
          terms
        </Link>{" "}
        and{" "}
        <Link to="/privacy" className="underline underline-offset-4">
          privacy notice
        </Link>
        .
      </p>
    </div>
  );
}
