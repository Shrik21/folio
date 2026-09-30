import { useState, type FormEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, CheckCheck, Github, Globe2, Loader2, LockKeyhole, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { getGetAdminSessionQueryKey, useAdminLogin, useAdminLogout, useGetAdminSession } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { Brand, Button } from '@/components/folio-ui';
import { clearPrivateSessionData, safeReturnTo, signOut, startSignIn, useAuth, useAuthProviders, type AuthProviderId } from '@/lib/auth';
import './auth.css';

const signInErrors: Record<string, string> = {
  cancelled: 'Sign-in was cancelled. Choose an account below when you’re ready.',
  invalid_state: 'Your sign-in link expired or could not be verified. Start again below.',
  provider_unavailable: 'This sign-in option is not available yet. Try another option or come back later.',
  authentication_failed: 'We couldn’t complete sign-in. Please try again.',
};

function PortfolioPreview() {
  return <div className="auth-preview-scene" aria-label="Example portfolio design">
    <div className="auth-preview-url"><Globe2 size={13} /><span>Your own shareable portfolio</span><LockKeyhole size={12} /></div>
    <div className="auth-mini-portfolio">
      <div className="auth-mini-nav"><span className="auth-mini-monogram">MC<span /></span><span>Work <span>About</span><span>Contact</span></span></div>
      <div className="auth-mini-intro"><div><p>Product designer & curious human</p><h3>Thoughtful design.<br />Meaningful impact.</h3><p>I’m Maya. I turn complex ideas into<br />simple, useful experiences.</p><span className="auth-mini-contact">Let’s make something <ArrowRight size={13} /></span></div><div className="auth-mini-avatar" aria-hidden="true"><span>M</span><span className="auth-mini-orbit" /></div></div>
      <div className="auth-mini-work"><p>Selected work <span>2023 — 2026</span></p><div className="auth-mini-projects"><div className="auth-mini-project auth-mini-project-blue"><div className="auth-mini-dashboard"><span /><span /><span /></div><strong>Northstar</strong><span>A clearer way to collaborate</span></div><div className="auth-mini-project auth-mini-project-peach"><div className="auth-mini-notebook">Field<br />notes<span>Ideas, made real.</span></div><strong>Field Notes</strong><span>A home for good ideas</span></div></div></div>
    </div>
    <div className="auth-preview-published"><span><CheckCheck size={18} /></span><div><strong>Made to be shared</strong><p>One link. Your whole story.</p></div></div>
  </div>;
}

function AuthShell({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const reduceMotion = useReducedMotion();
  return <main className="auth-page">
    <section className="auth-form-panel">
      <div className="auth-topbar"><Brand /><Link href="/" className="auth-back-link"><ArrowLeft size={14} /> Back to home</Link></div>
      <motion.div className="auth-form-content" initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4, ease: 'easeOut' }}>{children}</motion.div>
      <div className="auth-bottom-note"><LockKeyhole size={13} /><span>{admin ? 'Private access for workspace administrators.' : 'Your resume stays private until you choose what to publish.'}</span></div>
    </section>
    <aside className="auth-showcase">
      <div className="auth-showcase-copy"><span className="auth-showcase-tag"><Sparkles size={14} /> Your next chapter starts here</span><h2>Your experience.<br />An extraordinary first impression.</h2><p>Turn what you’ve done into a portfolio that opens doors.</p></div>
      <motion.div initial={reduceMotion ? false : { opacity: 0, y: 22, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: .65, delay: .15, ease: 'easeOut' }}><PortfolioPreview /></motion.div>
      <div className="auth-showcase-footer"><span><Check size={14} /> No coding needed</span><span><Check size={14} /> Made for your profession</span></div>
    </aside>
  </main>;
}

function RetryNotice({ children, onRetry, busy = false }: { children: ReactNode; onRetry: () => void; busy?: boolean }) {
  return <div className="auth-notice auth-notice-error" role="alert"><p>{children}</p><button type="button" onClick={onRetry} disabled={busy}><RefreshCw size={14} className={busy ? 'animate-spin' : ''} />{busy ? 'Trying again…' : 'Try again'}</button></div>;
}

export function Auth({ signup = false }: { signup?: boolean }) {
  const auth = useAuth();
  const providers = useAuthProviders();
  const [starting, setStarting] = useState<AuthProviderId | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const params = new URLSearchParams(window.location.search);
  const returnTo = safeReturnTo(params.get('returnTo'), signup ? '/onboarding' : '/dashboard');
  const errorCode = params.get('error');
  const callbackError = errorCode ? signInErrors[errorCode] || signInErrors.authentication_failed : null;
  const begin = (provider: AuthProviderId) => {
    if (starting || !providers.data?.providers.some((option) => option.id === provider && option.available)) return;
    setStarting(provider);
    startSignIn(provider, returnTo);
  };

  return <AuthShell>
    {auth.authenticated ? <>
      <div className="auth-heading-icon"><Check size={23} /></div><h1>You’re signed in.</h1>
      <p className="auth-description">Welcome, {auth.user?.name || 'there'}. Your next chapter is ready when you are.</p>
      <div className="auth-signed-in-account"><span>{auth.user?.name.slice(0, 1).toUpperCase() || 'F'}</span><div><strong>{auth.user?.name}</strong><p>{auth.user?.email || `Signed in with ${auth.user?.provider === 'github' ? 'GitHub' : 'Google'}`}</p></div><ShieldCheck size={20} /></div>
      <Link href={returnTo} className="auth-primary-link">{returnTo.startsWith('/onboarding') ? 'Create my portfolio' : 'Open my workspace'}<ArrowRight size={17} /></Link>
      {logoutError && <p className="auth-inline-error" role="alert">{logoutError}</p>}
      <button type="button" className="auth-switch-account" disabled={logoutPending} onClick={async () => { setLogoutError(''); setLogoutPending(true); try { await signOut(); } catch { setLogoutError('Sign-out did not finish. Try again.'); setLogoutPending(false); } }}>{logoutPending ? 'Signing out…' : 'Use a different account'}</button>
    </> : <>
      <div className="auth-heading-icon"><Sparkles size={22} /></div>
      <h1>{signup ? 'Your work deserves a home.' : 'Welcome back.'}</h1>
      <p className="auth-description">{signup ? 'Create an account to turn your resume into a portfolio that feels like you.' : 'Sign in to your workspace. A great first impression is just a few edits away.'}</p>
      {callbackError && <div className="auth-notice" role="alert"><p>{callbackError}</p></div>}
      {auth.isError && <RetryNotice onRetry={() => { void auth.refetch(); }} busy={auth.isFetching}>We couldn’t check your session. Reconnect to continue securely.</RetryNotice>}
      {providers.isError && <RetryNotice onRetry={() => { void providers.refetch(); }} busy={providers.isFetching}>Sign-in options couldn’t be loaded. Check your connection and try again.</RetryNotice>}
      <div className="auth-provider-list" aria-busy={providers.isPending || auth.isPending}>
        {(['google', 'github'] as const).map((id) => {
          const provider = providers.data?.providers.find((option) => option.id === id);
          const unavailable = providers.isSuccess && !provider?.available;
          return <button key={id} type="button" className="auth-provider-button" data-testid={`button-signin-${id}`} disabled={!provider?.available || !!starting || auth.isPending || auth.isError || providers.isError} onClick={() => begin(id)} aria-describedby={unavailable ? 'auth-provider-availability' : undefined}>
            {starting === id ? <Loader2 size={21} className="animate-spin" /> : id === 'google' ? <FcGoogle size={22} aria-hidden="true" /> : <Github size={22} aria-hidden="true" />}
            <span>{starting === id ? `Opening ${id === 'google' ? 'Google' : 'GitHub'}…` : `Continue with ${id === 'google' ? 'Google' : 'GitHub'}`}</span>
            {unavailable && <span className="auth-provider-badge">Coming soon</span>}
          </button>;
        })}
      </div>
      {(providers.isPending || auth.isPending) && <p className="auth-service-note" role="status"><Loader2 size={13} className="animate-spin" /> Checking secure sign-in…</p>}
      {providers.isSuccess && providers.data.providers.filter((provider) => provider.available).length < 2 && <p id="auth-provider-availability" className="auth-service-note">{providers.data.providers.some((provider) => provider.available) ? 'More sign-in options will be available soon.' : 'Account sign-in is being set up. You can explore the templates while we get ready.'}</p>}
      <div className="auth-benefits"><span><Check size={14} /> No new password to remember</span><span><Check size={14} /> Start with a free portfolio</span></div>
      <p className="auth-switch">{signup ? 'Already have an account?' : 'New to Folio?'} <Link href={`${signup ? '/login' : '/signup'}?returnTo=${encodeURIComponent(returnTo)}`} data-testid="link-auth-switch">{signup ? 'Sign in' : 'Create an account'}</Link></p>
      <Link href="/templates" className="auth-explore-link">Explore designs first <ArrowRight size={15} /></Link>
    </>}
  </AuthShell>;
}

function SessionLoading({ admin = false }: { admin?: boolean }) {
  return <main className="auth-gate"><Brand /><div className="auth-gate-body" role="status"><Loader2 size={28} className="animate-spin" /><h1>Getting your workspace ready.</h1><p>{admin ? 'Checking administrator access…' : 'Checking your secure session…'}</p></div></main>;
}

function SessionError({ onRetry, busy }: { onRetry: () => void; busy: boolean }) {
  return <main className="auth-gate"><Brand /><div className="auth-gate-body"><div className="auth-heading-icon"><LockKeyhole size={23} /></div><h1>Let’s reconnect.</h1><p>Your session couldn’t be verified. Your workspace stays protected while you reconnect.</p><Button onClick={onRetry} disabled={busy}><RefreshCw size={16} className={busy ? 'animate-spin' : ''} />{busy ? 'Reconnecting…' : 'Try again'}</Button><Link href="/" className="auth-explore-link">Back to home</Link></div></main>;
}

function SignInRequired({ admin = false }: { admin?: boolean }) {
  const [location] = useLocation();
  const returnTo = safeReturnTo(location);
  return <main className="auth-gate"><Brand /><div className="auth-gate-body"><div className="auth-heading-icon"><LockKeyhole size={23} /></div><h1>{admin ? 'Administrator access.' : 'Your workspace is waiting.'}</h1><p>{admin ? 'Sign in with your administrator account to manage this workspace.' : 'Sign in to save your work, make it your own, and share your portfolio with the world.'}</p><Link href={admin ? '/admin' : `/login?returnTo=${encodeURIComponent(returnTo)}`} className="auth-primary-link">{admin ? 'Admin sign in' : 'Sign in to continue'}<ArrowRight size={17} /></Link>{!admin && <Link href={`/signup?returnTo=${encodeURIComponent(returnTo)}`} className="auth-explore-link">New here? Create an account</Link>}<Link href="/" className="auth-back-link"><ArrowLeft size={14} /> Back to home</Link></div></main>;
}

/** Customer workspace access requires an explicitly verified customer session. */
export function UserGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.isPending) return <SessionLoading />;
  if (auth.isError) return <SessionError onRetry={() => { void auth.refetch(); }} busy={auth.isFetching} />;
  if (auth.authenticated) return <>{children}</>;
  return <SignInRequired />;
}

/** Administrator-only routes never fall back to a customer OAuth session. */
export function AdminGate({ children }: { children: ReactNode }) {
  const admin = useGetAdminSession({ query: { queryKey: getGetAdminSessionQueryKey(), retry: 1 }, request: { credentials: 'include' } });
  if (admin.isPending) return <SessionLoading admin />;
  if (admin.isError) return <SessionError onRetry={() => { void admin.refetch(); }} busy={admin.isFetching} />;
  if (admin.data?.authenticated !== true) return <SignInRequired admin />;
  return <>{children}</>;
}

export function AdminPage() {
  const [username, setUsername] = useState('Admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const session = useGetAdminSession({ query: { queryKey: getGetAdminSessionQueryKey(), retry: 1 }, request: { credentials: 'include' } });
  const login = useAdminLogin({ request: { credentials: 'include' } });
  const logout = useAdminLogout({ request: { credentials: 'include' } });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    login.mutate({ data: { username, password } }, {
      onSuccess: async (result) => {
        setPassword('');
        if (result.authenticated !== true) { setError('Administrator access could not be verified. Please try again.'); return; }
        await session.refetch();
      },
      onError: () => setError('Sign-in failed. Check your credentials and try again.'),
    });
  };
  if (session.isPending) return <SessionLoading admin />;
  if (session.isError) return <SessionError onRetry={() => { void session.refetch(); }} busy={session.isFetching} />;
  if (session.data?.authenticated === true) return <AuthShell admin><div className="auth-heading-icon"><ShieldCheck size={24} /></div><h1>Welcome back, Admin.</h1><p className="auth-description">Your administrator session is active. Customer portfolios use their own Google or GitHub sign-in.</p><Link href="/" className="auth-primary-link">View Folio <ArrowRight size={16} /></Link><Link href="/login" className="auth-explore-link">Open customer sign-in</Link>{error && <p role="alert" className="auth-inline-error">{error}</p>}<button type="button" className="auth-switch-account" disabled={logout.isPending} onClick={() => { setError(''); logout.mutate(undefined, { onSuccess: async () => { await clearPrivateSessionData(); window.location.assign(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/admin`); }, onError: () => setError('Sign-out failed. Please try again.') }); }}>{logout.isPending ? 'Signing out…' : 'Sign out'}</button></AuthShell>;
  return <AuthShell admin><div className="auth-heading-icon"><ShieldCheck size={24} /></div><h1>Administrator sign in.</h1><p className="auth-description">Manage your Folio workspace with your administrator account.</p><form className="auth-admin-form" onSubmit={submit}><label>Username<input required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" data-testid="input-admin-username" /></label><label>Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" data-testid="input-admin-password" /></label>{error && <p className="auth-inline-error" role="alert">{error}</p>}<Button className="w-full" type="submit" disabled={login.isPending}>{login.isPending ? <><Loader2 size={17} className="animate-spin" /> Checking access…</> : <>Enter workspace <ArrowRight size={17} /></>}</Button></form><p className="auth-switch">Building your own portfolio? <Link href="/login">Customer sign in</Link></p></AuthShell>;
}
