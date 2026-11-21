import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { SepShieldMark } from '../components/layout/SepLogo';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';

export function OidcCallbackPage() {
  const { handleOidcCallback, isAuthenticated, authError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    handleOidcCallback().then(() => {
      navigate('/dashboard', { replace: true });
    });
  }, [handleOidcCallback, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] p-4">
      <div className="w-full max-w-md rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-center space-y-4">
        <div className="flex justify-center">
          <SepShieldMark className="w-9 h-9" />
        </div>
        <h1 className="font-display text-lg font-semibold text-[var(--fg-default)]">
          Completing sign-in…
        </h1>
        {authError ? (
          <div className="space-y-3 text-left">
            <ErrorBanner error={new Error(authError)} />
            <Link to="/" className="text-xs text-[var(--brand-primary)] underline">
              Return to landing page
            </Link>
          </div>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">
            Exchanging authorization code and loading workspace memberships.
          </p>
        )}
      </div>
    </div>
  );
}

export function SignedOutPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] p-4">
      <div className="w-full max-w-md rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-center space-y-4">
        <div className="flex justify-center">
          <SepShieldMark className="w-9 h-9" />
        </div>
        <h1 className="font-display text-xl font-bold text-[var(--fg-default)]">
          You have been signed out
        </h1>
        <p className="text-sm text-[var(--fg-muted)]">
          Your in-memory session tokens have been cleared. Sign in again to access your detection workspaces.
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="primary"
            onClick={async () => {
              await signIn('owner');
              navigate('/dashboard');
            }}
          >
            Sign in again
          </Button>
          <Link
            to="/"
            className="px-4 py-2 text-sm rounded-md border border-[var(--border-default)] text-[var(--fg-default)] hover:bg-[var(--bg-subtle)]"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
