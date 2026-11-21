import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createSepClient, type SepClient } from '../api/client';
import type { MeDto, RoleDto } from '../api/types';

export type SandboxIdentity = 'owner' | 'member';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  isOidcConfigured: boolean;
  sandboxIdentity: SandboxIdentity;
  me: MeDto | null;
  rolesCatalog: RoleDto[];
  api: SepClient;
  signIn: (identity?: SandboxIdentity) => Promise<void>;
  switchSandboxIdentity: (identity: SandboxIdentity) => Promise<void>;
  handleOidcCallback: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  authError: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const OIDC_AUTHORITY = import.meta.env?.VITE_OIDC_AUTHORITY || '';
const OIDC_CLIENT_ID = import.meta.env?.VITE_OIDC_CLIENT_ID || 'sep-web';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isOidcConfigured = Boolean(OIDC_AUTHORITY);
  const tokenRef = useRef<string | null>(null);
  const memoryStoreRef = useRef(new InMemoryWebStorage());

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sandboxIdentity, setSandboxIdentity] = useState<SandboxIdentity>('owner');
  const [me, setMe] = useState<MeDto | null>(null);
  const [rolesCatalog, setRolesCatalog] = useState<RoleDto[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);

  const userManager = useMemo(() => {
    if (!isOidcConfigured || typeof window === 'undefined') return null;
    return new UserManager({
      authority: OIDC_AUTHORITY,
      client_id: OIDC_CLIENT_ID,
      redirect_uri: `${window.location.origin}/auth/callback`,
      post_logout_redirect_uri: `${window.location.origin}/signed-out`,
      response_type: 'code',
      scope: 'openid profile email',
      automaticSilentRenew: true,
      userStore: new WebStorageStateStore({ store: memoryStoreRef.current }),
    });
  }, [isOidcConfigured]);

  const handleUnauthorized = useCallback(() => {
    tokenRef.current = null;
    setIsAuthenticated(false);
    setMe(null);
  }, []);

  const api = useMemo(
    () =>
      createSepClient({
        getToken: () => tokenRef.current,
        onUnauthorized: handleUnauthorized,
      }),
    [handleUnauthorized],
  );

  const loadSessionProfile = useCallback(async () => {
    try {
      const [meData, rolesData] = await Promise.all([api.getMe(), api.listRoles()]);
      setMe(meData);
      setRolesCatalog(rolesData);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to load profile');
      tokenRef.current = null;
      setIsAuthenticated(false);
      setMe(null);
    }
  }, [api]);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        if (userManager) {
          userManager.events.addUserLoaded((user: User) => {
            tokenRef.current = user.access_token;
          });
          userManager.events.addUserUnloaded(() => {
            tokenRef.current = null;
            setIsAuthenticated(false);
            setMe(null);
          });
          const existing = await userManager.getUser();
          if (existing && !existing.expired) {
            tokenRef.current = existing.access_token;
            await loadSessionProfile();
          }
        } else {
          // Support ?autostart=1 or active sandbox session across page navigations (stores only role label, never tokens)
          const params = new URLSearchParams(window.location.search);
          const autostart = params.get('autostart') === '1';
          const savedSandbox = window.sessionStorage.getItem('sep_sandbox_identity') as SandboxIdentity | null;
          if (autostart || savedSandbox === 'owner' || savedSandbox === 'member') {
            const resolvedRole: SandboxIdentity = savedSandbox === 'member' && !autostart ? 'member' : 'owner';
            setSandboxIdentity(resolvedRole);
            window.sessionStorage.setItem('sep_sandbox_identity', resolvedRole);
            tokenRef.current = resolvedRole === 'member' ? 'sep-demo-member' : 'sep-demo-owner';
            await loadSessionProfile();
          }
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [userManager, loadSessionProfile]);

  const signIn = useCallback(
    async (identity: SandboxIdentity = 'owner') => {
      setAuthError(null);
      if (userManager) {
        await userManager.signinRedirect();
        return;
      }
      setIsLoading(true);
      try {
        setSandboxIdentity(identity);
        window.sessionStorage.setItem('sep_sandbox_identity', identity);
        tokenRef.current = identity === 'member' ? 'sep-demo-member' : 'sep-demo-owner';
        await loadSessionProfile();
      } finally {
        setIsLoading(false);
      }
    },
    [userManager, loadSessionProfile],
  );

  const switchSandboxIdentity = useCallback(
    async (identity: SandboxIdentity) => {
      if (isOidcConfigured) return;
      setIsLoading(true);
      try {
        setSandboxIdentity(identity);
        window.sessionStorage.setItem('sep_sandbox_identity', identity);
        tokenRef.current = identity === 'member' ? 'sep-demo-member' : 'sep-demo-owner';
        await loadSessionProfile();
      } finally {
        setIsLoading(false);
      }
    },
    [isOidcConfigured, loadSessionProfile],
  );

  const handleOidcCallback = useCallback(async () => {
    if (!userManager) return;
    setIsLoading(true);
    try {
      const user = await userManager.signinRedirectCallback();
      tokenRef.current = user.access_token;
      await loadSessionProfile();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'OIDC callback failed');
    } finally {
      setIsLoading(false);
    }
  }, [userManager, loadSessionProfile]);

  const signOut = useCallback(async () => {
    tokenRef.current = null;
    window.sessionStorage.removeItem('sep_sandbox_identity');
    setIsAuthenticated(false);
    setMe(null);
    setRolesCatalog([]);
    if (userManager) {
      await userManager.signoutRedirect();
    }
  }, [userManager]);

  const refreshMe = useCallback(async () => {
    if (!tokenRef.current) return;
    await loadSessionProfile();
  }, [loadSessionProfile]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        isOidcConfigured,
        sandboxIdentity,
        me,
        rolesCatalog,
        api,
        signIn,
        switchSandboxIdentity,
        handleOidcCallback,
        signOut,
        refreshMe,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
