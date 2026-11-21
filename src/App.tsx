/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { SepShieldMark } from './components/layout/SepLogo';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { AiStudioPage } from './pages/AiStudioPage';
import { OidcCallbackPage, SignedOutPage } from './pages/AuthPages';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';
import { PlatformConsolePage } from './pages/PlatformConsolePage';
import { RepositoryPage } from './pages/RepositoryPage';
import { RuleDetailPage } from './pages/RuleDetailPage';
import { UserSettingsPage } from './pages/UserSettingsPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { ThemeProvider } from './theme/ThemeContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: (failureCount, error: any) => {
        if (error?.status && error.status >= 400 && error.status < 500) return false;
        return failureCount < 1;
      },
    },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-canvas)] text-[var(--fg-muted)] gap-3">
      <SepShieldMark className="w-10 h-10 animate-pulse" />
      <span className="text-xs font-mono">Loading Security Engineering Platform…</span>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <AppShell>{children}</AppShell>;
}

function HomeRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public & Auth routes */}
              <Route path="/" element={<HomeRoute />} />
              <Route path="/welcome" element={<LandingPage />} />
              <Route path="/auth/callback" element={<OidcCallbackPage />} />
              <Route path="/signed-out" element={<SignedOutPage />} />

              {/* Authenticated top-level routes */}
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <DashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={<Navigate to="/settings/profile" replace />}
              />
              <Route
                path="/settings/:section"
                element={
                  <RequireAuth>
                    <UserSettingsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/_platform"
                element={
                  <RequireAuth>
                    <PlatformConsolePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/ai-assistant"
                element={
                  <RequireAuth>
                    <AiAssistantPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/ai-studio"
                element={
                  <RequireAuth>
                    <AiStudioPage />
                  </RequireAuth>
                }
              />

              {/* Workspace / Organization routes (explicit subpaths before /:owner/:repo) */}
              <Route
                path="/:owner"
                element={
                  <RequireAuth>
                    <WorkspacePage forcedTab="repositories" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/rules"
                element={
                  <RequireAuth>
                    <WorkspacePage forcedTab="rules" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/coverage"
                element={
                  <RequireAuth>
                    <WorkspacePage forcedTab="coverage" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/conversions"
                element={
                  <RequireAuth>
                    <WorkspacePage forcedTab="conversions" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/deployments"
                element={
                  <RequireAuth>
                    <WorkspacePage forcedTab="deployments" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/deployments/:deploymentId"
                element={
                  <RequireAuth>
                    <WorkspacePage forcedTab="deployment-detail" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/integrations"
                element={
                  <RequireAuth>
                    <WorkspacePage forcedTab="integrations" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/connectors"
                element={
                  <RequireAuth>
                    <WorkspacePage forcedTab="connectors" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/people"
                element={
                  <RequireAuth>
                    <WorkspacePage forcedTab="people" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/settings"
                element={
                  <RequireAuth>
                    <WorkspacePage forcedTab="settings" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/settings/:section"
                element={
                  <RequireAuth>
                    <WorkspacePage forcedTab="settings" />
                  </RequireAuth>
                }
              />

              {/* Repository & Rule routes */}
              <Route
                path="/:owner/:repo"
                element={
                  <RequireAuth>
                    <RepositoryPage forcedTab="code" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/:repo/rules"
                element={
                  <RequireAuth>
                    <RepositoryPage forcedTab="rules" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/:repo/rules/:ruleId"
                element={
                  <RequireAuth>
                    <RuleDetailPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/:repo/pulls"
                element={
                  <RequireAuth>
                    <RepositoryPage forcedTab="pulls" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/:repo/pulls/:number"
                element={
                  <RequireAuth>
                    <RepositoryPage forcedTab="pulls" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/:repo/issues"
                element={
                  <RequireAuth>
                    <RepositoryPage forcedTab="issues" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/:repo/issues/:number"
                element={
                  <RequireAuth>
                    <RepositoryPage forcedTab="issues" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/:repo/releases"
                element={
                  <RequireAuth>
                    <RepositoryPage forcedTab="releases" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/:repo/wiki"
                element={
                  <RequireAuth>
                    <RepositoryPage forcedTab="wiki" />
                  </RequireAuth>
                }
              />
              <Route
                path="/:owner/:repo/settings"
                element={
                  <RequireAuth>
                    <RepositoryPage forcedTab="settings" />
                  </RequireAuth>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
