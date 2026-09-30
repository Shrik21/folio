import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/folio-data';

export type AuthProviderId = 'google' | 'github';
export interface AuthUser { id: string; name: string; email: string | null; avatarUrl: string | null; provider: AuthProviderId }
export interface AuthSession { authenticated: boolean; user: AuthUser | null }
export interface AuthProvider { id: AuthProviderId; name: string; available: boolean; startUrl: string }
interface AuthProviders { providers: AuthProvider[]; configured: boolean }

export const authSessionQueryKey = ['auth', 'session'] as const;
export const authProvidersQueryKey = ['auth', 'providers'] as const;

async function authRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, { ...init, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', ...init?.headers } });
  if (!response.ok) throw new Error('We could not connect to sign-in. Please try again.');
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Sign-in is temporarily unavailable. Please try again.');
  return response.json();
}

function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }

export function useAuth() {
  const query = useQuery({
    queryKey: authSessionQueryKey,
    queryFn: async ({ signal }): Promise<AuthSession> => {
      const data = await authRequest('/api/auth/session', { signal });
      if (!isObject(data) || typeof data.authenticated !== 'boolean') throw new Error('Your session could not be verified. Please try again.');
      if (!data.authenticated) return { authenticated: false, user: null };
      const user = data.user;
      if (!isObject(user) || typeof user.id !== 'string' || typeof user.name !== 'string' || !['google', 'github'].includes(String(user.provider))) throw new Error('Your session could not be verified. Please try again.');
      return { authenticated: true, user: { id: user.id, name: user.name, email: typeof user.email === 'string' ? user.email : null, avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : null, provider: user.provider as AuthProviderId } };
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
  const status = query.isError ? 'error' : query.isPending ? 'loading' : query.data.authenticated ? 'authenticated' : 'unauthenticated';
  return { ...query, status, user: status === 'authenticated' ? query.data?.user ?? null : null, authenticated: status === 'authenticated' };
}

export function useAuthProviders() {
  return useQuery({
    queryKey: authProvidersQueryKey,
    queryFn: async ({ signal }): Promise<AuthProviders> => {
      const data = await authRequest('/api/auth/providers', { signal });
      if (!isObject(data) || !Array.isArray(data.providers) || typeof data.configured !== 'boolean') throw new Error('Sign-in options could not be loaded. Please try again.');
      const providers = data.providers.filter((provider): provider is AuthProvider => isObject(provider) && (provider.id === 'google' || provider.id === 'github') && typeof provider.available === 'boolean' && typeof provider.name === 'string' && typeof provider.startUrl === 'string');
      return { providers, configured: data.configured };
    },
    staleTime: 60_000,
    retry: 1,
  });
}

const returnPaths = new Set(['/dashboard', '/dashboard/portfolio', '/dashboard/content', '/dashboard/templates', '/dashboard/appearance', '/dashboard/domain', '/dashboard/analytics', '/dashboard/billing', '/dashboard/settings', '/onboarding', '/onboarding/upload', '/onboarding/details', '/onboarding/profession', '/onboarding/templates', '/onboarding/preview']);

/** Only return to a known application route, never an external URL. */
export function safeReturnTo(value: string | null | undefined, fallback = '/dashboard') { return value && returnPaths.has(value) ? value : returnPaths.has(fallback) ? fallback : '/dashboard'; }

export function startSignIn(provider: AuthProviderId, returnTo: string) { window.location.assign(`/api/auth/${provider}/start?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`); }

export async function clearPrivateSessionData() {
  await queryClient.cancelQueries();
  queryClient.clear();
  try { window.sessionStorage.removeItem('folio-onboarding'); } catch { /* Storage can be disabled. */ }
}

/** Failed logout leaves the session intact so the user can retry. */
export async function signOut() {
  await authRequest('/api/auth/logout', { method: 'POST' });
  await clearPrivateSessionData();
  window.location.assign(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/login`);
}
