import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Bell,
  BotMessageSquare,
  Building2,
  Check,
  ChevronDown,
  FolderGit2,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  Terminal,
  User,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { formatRelativeTime } from '../../utils/rule-helpers';
import { SepShieldMark } from './SepLogo';

export function GlobalHeader({
  onOpenNewRepo,
  onOpenNewWorkspace,
}: {
  onOpenNewRepo: (tenantId?: string) => void;
  onOpenNewWorkspace: () => void;
}) {
  const { me, api, signOut, isOidcConfigured, sandboxIdentity, switchSandboxIdentity } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const params = useParams<{ owner?: string }>();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [wsOpen, setWsOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const { data: tenantsPage } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants({ limit: 50 }),
    enabled: Boolean(me),
  });

  const tenants = tenantsPage?.items ?? [];
  const activeTenant =
    tenants.find((t) => t.slug === params.owner) ??
    tenants.find((t) => t.kind !== 'INDIVIDUAL') ??
    tenants[0];

  const { data: notificationsPage } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.listNotifications({ limit: 10, all: false }),
    enabled: Boolean(me),
    refetchInterval: 30000,
  });

  const unreadItems = notificationsPage?.items ?? [];

  const isPotentialOperator = Boolean(
    me?.memberships.some((m) => m.roles.includes('tenant.owner')),
  );

  const { data: platformProbe } = useQuery({
    queryKey: ['platform-probe', me?.id],
    queryFn: async () => {
      try {
        await api.listPlatformPlans();
        return true;
      } catch {
        return false;
      }
    },
    enabled: Boolean(me) && isPotentialOperator,
    retry: false,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  const markOneRead = useMutation({
    mutationFn: (id: number) => api.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setWsOpen(false);
        setPlusOpen(false);
        setNotifOpen(false);
        setUserOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setWsOpen(false);
        setPlusOpen(false);
        setNotifOpen(false);
        setUserOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const targetOwner = activeTenant?.slug ?? me?.username;
    if (!targetOwner) return;
    const q = searchQuery.trim();
    navigate(q ? `/${targetOwner}/rules?q=${encodeURIComponent(q)}` : `/${targetOwner}/rules`);
    setMobileOpen(false);
  };

  const initials = me?.username?.startsWith('exowner')
    ? 'EO'
    : me?.username?.startsWith('exmember')
      ? 'EM'
      : (me?.displayName || me?.username || 'SE')
          .split(/\s+/)
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 h-14 border-b border-[var(--border-default)] bg-[var(--bg-header)] px-4 flex items-center justify-between gap-3"
    >
      {/* Left: Drawer button + Brand + Workspace switcher */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          className="p-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)] hover:bg-[var(--bg-subtle)] cursor-pointer shrink-0 md:hidden"
        >
          {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>

        <Link
          to="/dashboard"
          className="flex items-center gap-2 text-[var(--fg-default)] hover:opacity-90 whitespace-nowrap shrink-0"
        >
          <SepShieldMark className="w-7 h-7" />
          <span className="font-display font-semibold text-sm tracking-tight hidden sm:inline">
            Security Engineering
          </span>
        </Link>

        {activeTenant && (
          <div className="relative flex items-center gap-1.5">
            <span className="text-[var(--fg-muted)] hidden sm:inline">/</span>
            <button
              type="button"
              onClick={() => {
                setWsOpen((v) => !v);
                setPlusOpen(false);
                setNotifOpen(false);
                setUserOpen(false);
              }}
              aria-expanded={wsOpen}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-transparent hover:border-[var(--border-default)] hover:bg-[var(--bg-subtle)] text-xs font-semibold text-[var(--fg-default)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="max-w-[150px] truncate">{activeTenant.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--fg-muted)]" />
            </button>

            {wsOpen && (
              <div className="absolute left-0 mt-1.5 w-64 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg py-1 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                  Workspaces
                </div>
                {tenants.map((t) => (
                  <Link
                    key={t.id}
                    to={`/${t.slug}`}
                    onClick={() => setWsOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-sm text-[var(--fg-default)] hover:bg-[var(--bg-subtle)]"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-xs font-mono text-[var(--fg-muted)] truncate">
                        {t.slug} · {t.kind.toLowerCase()}
                      </div>
                    </div>
                    {t.id === activeTenant.id && (
                      <Check className="w-4 h-4 text-[var(--brand-primary)] shrink-0" />
                    )}
                  </Link>
                ))}
                <div className="border-t border-[var(--border-muted)] mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setWsOpen(false);
                      onOpenNewWorkspace();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--brand-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New team workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center/Right Search + Utilities & Profile */}
      <div className="flex items-center gap-2 shrink-0 flex-1 justify-end">
        <form onSubmit={handleGlobalSearch} className="hidden md:flex w-64 lg:w-80 items-center">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-[var(--fg-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type / to search rules"
              aria-label="Search detection rules"
              className="w-full pl-8 pr-8 py-1 text-xs rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] text-[var(--fg-default)] placeholder:text-[var(--fg-muted)]"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.2 rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--fg-muted)]">
              /
            </kbd>
          </div>
        </form>

        {/* Dedicated Gemini Assistant & Visual Studio links */}
        <Link
          to="/ai-assistant"
          title="Security AI Assistant"
          className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] text-xs font-medium text-[var(--fg-default)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0"
        >
          <BotMessageSquare className="w-3.5 h-3.5 text-[var(--info)]" />
          <span>Rule AI</span>
        </Link>

        <Link
          to="/ai-studio"
          title="Architecture Visual Studio"
          className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] text-xs font-medium text-[var(--fg-default)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0"
        >
          <ImageIcon className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
          <span>Studio</span>
        </Link>

        {/* + Create menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setPlusOpen((v) => !v);
              setWsOpen(false);
              setNotifOpen(false);
              setUserOpen(false);
            }}
            aria-label="Create new resource"
            aria-expanded={plusOpen}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-xs font-medium text-[var(--fg-default)] cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <ChevronDown className="w-3 h-3 text-[var(--fg-muted)]" />
          </button>

          {plusOpen && (
            <div className="absolute right-0 mt-1.5 w-52 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  setPlusOpen(false);
                  onOpenNewRepo(activeTenant?.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--fg-default)] hover:bg-[var(--bg-subtle)] cursor-pointer text-left"
              >
                <FolderGit2 className="w-4 h-4 text-[var(--fg-muted)]" />
                <span>New repository</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlusOpen(false);
                  onOpenNewWorkspace();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--fg-default)] hover:bg-[var(--bg-subtle)] cursor-pointer text-left"
              >
                <Building2 className="w-4 h-4 text-[var(--fg-muted)]" />
                <span>New workspace</span>
              </button>
              {activeTenant && (
                <Link
                  to={`/${activeTenant.slug}/conversions`}
                  onClick={() => setPlusOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--fg-default)] hover:bg-[var(--bg-subtle)]"
                >
                  <ArrowLeftRight className="w-4 h-4 text-[var(--fg-muted)]" />
                  <span>Convert query</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Notifications bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen((v) => !v);
              setPlusOpen(false);
              setWsOpen(false);
              setUserOpen(false);
            }}
            aria-label={`Notifications (${unreadItems.length} unread)`}
            aria-expanded={notifOpen}
            className="relative p-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--fg-default)] cursor-pointer shrink-0"
          >
            <Bell className="w-4 h-4" />
            {unreadItems.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--brand-primary)] text-[var(--fg-on-emphasis)] text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadItems.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-1.5 w-80 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg overflow-hidden z-50">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)]">
                <span className="text-xs font-semibold text-[var(--fg-default)]">
                  Notifications ({unreadItems.length})
                </span>
                <div className="flex items-center gap-2">
                  {unreadItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllRead.mutate()}
                      className="text-xs text-[var(--brand-primary)] hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                  <Link
                    to="/settings/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg-default)]"
                  >
                    View all
                  </Link>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-muted)]">
                {unreadItems.length === 0 ? (
                  <div className="p-4 text-xs text-[var(--fg-muted)] text-center">
                    No unread notifications.
                  </div>
                ) : (
                  unreadItems.map((n) => (
                    <div key={n.id} className="p-3 hover:bg-[var(--bg-subtle)] flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[var(--fg-default)]">{n.title}</div>
                        <p className="text-xs text-[var(--fg-muted)] mt-0.5 line-clamp-2">{n.body}</p>
                        <div className="text-[11px] text-[var(--fg-muted)] mt-1">
                          {formatRelativeTime(n.createdAt)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => markOneRead.mutate(n.id)}
                        className="text-[11px] px-1.5 py-0.5 rounded border border-[var(--border-default)] text-[var(--fg-muted)] hover:text-[var(--fg-default)] cursor-pointer shrink-0"
                      >
                        Read
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          className="p-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] text-[var(--fg-default)] cursor-pointer shrink-0"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* User Avatar menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setUserOpen((v) => !v);
              setWsOpen(false);
              setPlusOpen(false);
              setNotifOpen(false);
            }}
            aria-label="User account menu"
            aria-expanded={userOpen}
            className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] cursor-pointer shrink-0"
          >
            <span className="w-6 h-6 rounded-full bg-[var(--info-subtle)] text-[var(--info)] text-xs font-bold flex items-center justify-center">
              {initials}
            </span>
            <ChevronDown className="w-3 h-3 text-[var(--fg-muted)]" />
          </button>

          {userOpen && (
            <div className="absolute right-0 mt-1.5 w-64 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg py-1 z-50">
              <div className="px-3 py-2 border-b border-[var(--border-muted)]">
                <div className="text-sm font-semibold text-[var(--fg-default)] truncate">
                  {me?.displayName || me?.username}
                </div>
                <div className="text-xs font-mono text-[var(--fg-muted)] truncate">
                  @{me?.username}
                </div>
              </div>

              {!isOidcConfigured && (
                <div className="px-3 py-2 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] mb-1.5">
                    Sandbox Identity
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        switchSandboxIdentity('owner');
                        setUserOpen(false);
                      }}
                      className={`px-2 py-1 text-xs rounded border cursor-pointer ${
                        sandboxIdentity === 'owner'
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)] font-semibold'
                          : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]'
                      }`}
                    >
                      Owner
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        switchSandboxIdentity('member');
                        setUserOpen(false);
                      }}
                      className={`px-2 py-1 text-xs rounded border cursor-pointer ${
                        sandboxIdentity === 'member'
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)] font-semibold'
                          : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]'
                      }`}
                    >
                      Approver
                    </button>
                  </div>
                </div>
              )}

              <Link
                to="/settings/profile"
                onClick={() => setUserOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--fg-default)] hover:bg-[var(--bg-subtle)]"
              >
                <User className="w-4 h-4 text-[var(--fg-muted)]" />
                <span>Profile &amp; settings</span>
              </Link>
              <Link
                to="/settings/tokens"
                onClick={() => setUserOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--fg-default)] hover:bg-[var(--bg-subtle)]"
              >
                <KeyRound className="w-4 h-4 text-[var(--fg-muted)]" />
                <span>Git tokens &amp; SSH keys</span>
              </Link>
              <Link
                to="/settings/sessions"
                onClick={() => setUserOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--fg-default)] hover:bg-[var(--bg-subtle)]"
              >
                <ShieldAlert className="w-4 h-4 text-[var(--fg-muted)]" />
                <span>Sessions</span>
              </Link>
              <Link
                to="/ai-assistant"
                onClick={() => setUserOpen(false)}
                className="flex lg:hidden items-center gap-2 px-3 py-2 text-sm text-[var(--fg-default)] hover:bg-[var(--bg-subtle)]"
              >
                <BotMessageSquare className="w-4 h-4 text-[var(--brand-primary)]" />
                <span>Rule AI Assistant</span>
              </Link>
              <Link
                to="/ai-studio"
                onClick={() => setUserOpen(false)}
                className="flex lg:hidden items-center gap-2 px-3 py-2 text-sm text-[var(--fg-default)] hover:bg-[var(--bg-subtle)]"
              >
                <ImageIcon className="w-4 h-4 text-[var(--accent)]" />
                <span>Visual Studio (1K-4K)</span>
              </Link>

              {platformProbe && (
                <Link
                  to="/_platform"
                  onClick={() => setUserOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--fg-default)] hover:bg-[var(--bg-subtle)] border-t border-[var(--border-muted)]"
                >
                  <Terminal className="w-4 h-4 text-[var(--brand-primary)]" />
                  <span>Operator console</span>
                </Link>
              )}

              {activeTenant && (
                <Link
                  to={`/${activeTenant.slug}/settings`}
                  onClick={() => setUserOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--fg-default)] hover:bg-[var(--bg-subtle)]"
                >
                  <Settings className="w-4 h-4 text-[var(--fg-muted)]" />
                  <span>Workspace settings</span>
                </Link>
              )}

              <div className="border-t border-[var(--border-muted)] mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUserOpen(false);
                    signOut().then(() => navigate('/signed-out'));
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--danger)] hover:bg-[var(--bg-subtle)] cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile slide-down drawer */}
      {mobileOpen && (
        <div className="md:hidden absolute top-14 left-0 right-0 border-b border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-lg space-y-3 z-50">
          <form onSubmit={handleGlobalSearch}>
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--fg-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search detection rules..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] text-[var(--fg-default)]"
              />
            </div>
          </form>
          <nav className="flex flex-col gap-1 text-sm">
            <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="px-2 py-1.5 rounded hover:bg-[var(--bg-subtle)]">
              Dashboard
            </Link>
            {activeTenant && (
              <>
                <Link to={`/${activeTenant.slug}`} onClick={() => setMobileOpen(false)} className="px-2 py-1.5 rounded hover:bg-[var(--bg-subtle)]">
                  {activeTenant.name} Repositories
                </Link>
                <Link to={`/${activeTenant.slug}/coverage`} onClick={() => setMobileOpen(false)} className="px-2 py-1.5 rounded hover:bg-[var(--bg-subtle)]">
                  ATT&amp;CK Coverage
                </Link>
                <Link to={`/${activeTenant.slug}/conversions`} onClick={() => setMobileOpen(false)} className="px-2 py-1.5 rounded hover:bg-[var(--bg-subtle)]">
                  Query Conversions
                </Link>
                <Link to={`/${activeTenant.slug}/deployments`} onClick={() => setMobileOpen(false)} className="px-2 py-1.5 rounded hover:bg-[var(--bg-subtle)]">
                  Deployments
                </Link>
              </>
            )}
            <Link to="/ai-assistant" onClick={() => setMobileOpen(false)} className="px-2 py-1.5 rounded hover:bg-[var(--bg-subtle)]">
              Rule AI Assistant
            </Link>
            <Link to="/ai-studio" onClick={() => setMobileOpen(false)} className="px-2 py-1.5 rounded hover:bg-[var(--bg-subtle)]">
              Visual Studio (1K–4K)
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
