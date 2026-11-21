import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  Grid3X3,
  Layers,
  Moon,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { SepShieldMark } from '../components/layout/SepLogo';
import { useTheme } from '../theme/ThemeContext';
import { formatBytes } from '../utils/rule-helpers';

type WorkflowStepId = 'author' | 'convert' | 'coverage' | 'approve' | 'deploy';

const WORKFLOW_STEPS: Array<{
  id: WorkflowStepId;
  label: string;
  title: string;
  summary: string;
  command: string;
  steps: Array<{ icon: 'branch' | 'check' | 'grid'; text: string }>;
  terminal: string;
  rightHeading: string;
  rightSub: string;
  options: Array<{ id: string; title: string; subtitle: string; badge: string }>;
}> = [
  {
    id: 'author',
    label: 'Author rules',
    title: 'Validate PowerShell detection rule',
    summary:
      'I will parse the SEP Detection v1 YAML, verify schema constraints, and index ATT&CK technique T1059.001 into ex-181748/detections.',
    command: '/validate-rule rules/kql-powershell.yaml',
    steps: [
      { icon: 'branch', text: 'Inspect rules/kql-powershell.yaml on branch main' },
      { icon: 'grid', text: 'Verified MITRE ATT&CK tactic Execution · T1059.001' },
      { icon: 'check', text: 'Parsed Microsoft Sentinel KQL syntax tree' },
    ],
    terminal: 'sep-indexer check rules/kql-powershell.yaml  # VALID (0 errors, 0 warnings)',
    rightHeading: 'Rule Validation Mode',
    rightSub: 'Select validation strictness for branch protection rules across this repository.',
    options: [
      { id: 'strict', title: 'Strict Schema', subtitle: 'Block PR merges on syntax or ATT&CK errors', badge: 'Active' },
      { id: 'advisory', title: 'Advisory', subtitle: 'Report diagnostics without blocking merge', badge: 'Optional' },
    ],
  },
  {
    id: 'convert',
    label: 'Convert dialects',
    title: 'Translate KQL query to Splunk SPL & XQL',
    summary:
      'Canonical field mapping translates FileName and ProcessCommandLine cleanly using org mapping set v2 without manual rewrites.',
    command: '/convert --from microsoft-sentinel:kql --to splunk:spl',
    steps: [
      { icon: 'grid', text: 'Loaded canonical mapping set: edr.process (v2)' },
      { icon: 'check', text: 'Mapped FileName -> process.name -> process_name' },
      { icon: 'check', text: 'Mapped ProcessCommandLine -> process.command_line -> process' },
    ],
    terminal: 'tag=process tag=report process_name="powershell.exe" process="*-EncodedCommand*"',
    rightHeading: 'Dialect Output Target',
    rightSub: 'Switch target SIEM dialect to inspect deterministic field translation.',
    options: [
      { id: 'spl', title: 'Splunk SPL', subtitle: 'Deterministic · target syntax valid', badge: 'Target' },
      { id: 'xql', title: 'Cortex XSIAM XQL', subtitle: 'Case-sensitive predicate mode ready', badge: 'Target' },
    ],
  },
  {
    id: 'coverage',
    label: 'Check coverage',
    title: 'Analyze MITRE ATT&CK coverage gaps',
    summary:
      'Updated 14-tactic coverage heat map across indexed Sigma and SEP Detection v1 repositories for tenant ex-181748.',
    command: '/coverage --catalog 19.2 --repo detections',
    steps: [
      { icon: 'grid', text: 'Indexed Credential Access: T1003, T1003.001, T1110' },
      { icon: 'grid', text: 'Indexed Execution: T1059.001 Command & Scripting' },
      { icon: 'check', text: 'Highlighted 3 covered techniques across 10 enterprise tactics' },
    ],
    terminal: 'Coverage summary: Credential Access (3/3) · Execution (1/2) · Catalog v19.2',
    rightHeading: 'Coverage Scope',
    rightSub: 'Inspect repository-level or workspace-wide ATT&CK technique density.',
    options: [
      { id: 'tenant', title: 'All Repositories', subtitle: 'Aggregated heat map across SOC workspace', badge: 'Active' },
      { id: 'repo', title: 'Single Repository', subtitle: 'Scoped to ex-181748/detections only', badge: 'Filter' },
    ],
  },
  {
    id: 'approve',
    label: 'Approve rollout',
    title: 'Enforce separation-of-duties approval',
    summary:
      'Requester self-approval is blocked by organization policy (403 APPROVAL_NOT_ALLOWED). Peer approver sign-off unlocks SIEM queuing.',
    command: '/deploy request --env PRODUCTION --rule "Many failed logons"',
    steps: [
      { icon: 'branch', text: 'Frozen rule snapshot at commit 78bce0e' },
      { icon: 'check', text: 'Verified peer reviewer holds organization.deployment_approver' },
      { icon: 'check', text: 'Recorded approval comment and transitioned status to QUEUED' },
    ],
    terminal: 'POST /deployments/approve -> 200 OK (QUEUED · 1/1 approvals satisfied)',
    rightHeading: 'Approval Policy',
    rightSub: 'Configure peer review requirements for Production vs. Staging SIEM targets.',
    options: [
      { id: 'prod', title: 'Production Gate', subtitle: '1 peer approval required · no self-approval', badge: 'Enforced' },
      { id: 'staging', title: 'Staging Sandbox', subtitle: 'Fast-track validation before prod rollout', badge: '0 req' },
    ],
  },
  {
    id: 'deploy',
    label: 'See it deployed',
    title: 'Stream SIEM connector execution logs',
    summary:
      'Private-network connector pushed the saved search directly to Splunk Enterprise Security and verified live rule activation.',
    command: '/deploy status --id 2d20cb54 --follow',
    steps: [
      { icon: 'check', text: 'deployment.approved · Approved by exmember-138c23c5' },
      { icon: 'check', text: 'deployment.started · Pushing detection rule to SIEM target' },
      { icon: 'check', text: 'deployment.succeeded · Saved search SEP-a1984471 active' },
    ],
    terminal: 'STATUS: SUCCEEDED · Target: Splunk ES Prod · One-click rollback armed',
    rightHeading: 'Connector Target',
    rightSub: 'Real-time health and execution status for deployed SIEM rules.',
    options: [
      { id: 'splunk-es', title: 'Splunk ES Prod', subtitle: 'Healthy · saved search SEP-a1984471 active', badge: 'Online' },
      { id: 'sentinel', title: 'Microsoft Sentinel', subtitle: 'Analytics rule sync verified via connector', badge: 'Ready' },
    ],
  },
];

const DIALECT_PRESETS = [
  {
    id: 'kql',
    label: 'Microsoft Sentinel KQL',
    query: `DeviceProcessEvents\n| where FileName =~ "powershell.exe"\n  and ProcessCommandLine has "-EncodedCommand"`,
    summary: 'Source Query · Table: DeviceProcessEvents',
  },
  {
    id: 'spl',
    label: 'Splunk SPL (Strict)',
    query: `tag=process tag=report\n| search process_name="powershell.exe" process="*-EncodedCommand*"\n| table _time host user process_name process`,
    summary: 'Mapped via canonical edr.process · 2 fields translated · Target syntax valid',
  },
  {
    id: 'xql',
    label: 'Cortex XSIAM XQL',
    query: `dataset = xdr_data\n| filter event_type = ENUM.PROCESS\n  and action_process_image_name ~= "powershell.exe"\n  and action_process_command_line contains "-EncodedCommand"`,
    summary: 'Mapped via canonical edr.process · Case-insensitive match · Target syntax valid',
  },
] as const;

const PROOF_QUOTES = [
  {
    quote:
      'SEP gives our detection engineers Git-native velocity without sacrificing peer approval or SIEM syntax rigor across our Splunk and Sentinel tenants.',
    author: 'Elena Vance',
    role: 'Head of Detection Engineering, Northstar Security',
    initials: 'EV',
  },
  {
    quote:
      'Having MITRE ATT&CK v19.2 heat maps and deterministic KQL-to-SPL conversion in one control plane eliminated three disconnected spreadsheet workflows.',
    author: 'Marcus Chen',
    role: 'Principal Threat Hunter, Meridian Financial',
    initials: 'MC',
  },
  {
    quote:
      'Separation-of-duties deployment gates and one-time connector credentials satisfied our SOC2 and ISO 27001 auditors on day one.',
    author: 'Priya Nair',
    role: 'VP of Security Operations, Veridian Cloud',
    initials: 'PN',
  },
];

export function LandingPage() {
  const { signIn, isAuthenticated, isOidcConfigured, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [heroEmail, setHeroEmail] = useState('');
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [selectedRightOption, setSelectedRightOption] = useState(0);
  const [activeDialectTab, setActiveDialectTab] = useState<'kql' | 'spl' | 'xql'>('spl');
  const [suggestionCommitted, setSuggestionCommitted] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [digestEmail, setDigestEmail] = useState('');
  const [digestStatus, setDigestStatus] = useState<'idle' | 'error' | 'subscribed'>('idle');

  const { data: plansData } = useQuery({
    queryKey: ['public-plans'],
    queryFn: async () => {
      const base = (import.meta.env?.VITE_API_BASE ?? '/api/v1').replace(/\/$/, '');
      const res = await fetch(`${base}/plans`);
      if (!res.ok) return { items: [] };
      return res.json() as Promise<{
        items: Array<{
          key: string;
          name: string;
          description: string;
          trialDays: number;
          priceMonthlyCents: number;
          currency: string;
          entitlements: Record<string, number>;
        }>;
      }>;
    },
  });

  const handleSignIn = async (identity: 'owner' | 'member' = 'owner') => {
    if (isAuthenticated) {
      navigate('/dashboard');
      return;
    }
    await signIn(identity);
    if (!isOidcConfigured) {
      navigate('/dashboard');
    }
  };

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSignIn('owner');
  };

  const handleDigestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!digestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(digestEmail.trim())) {
      setDigestStatus('error');
      return;
    }
    setDigestStatus('subscribed');
    setDigestEmail('');
  };

  const plans = plansData?.items ?? [];
  const activeStep = WORKFLOW_STEPS[activeStepIdx];
  const activeQuote = PROOF_QUOTES[quoteIdx];
  const activeDialect = DIALECT_PRESETS.find((d) => d.id === activeDialectTab) ?? DIALECT_PRESETS[1];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-surface)] text-[var(--fg-default)]">
      {/* Top Bar (3-zone layout matching reference header) */}
      <header className="sticky top-0 z-40 h-16 border-b border-[var(--border-muted)] bg-[var(--bg-surface)]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-6">
          <div className="flex items-center gap-7 min-w-0">
            <a
              href="#top"
              className="flex items-center gap-2 text-[var(--fg-default)] whitespace-nowrap shrink-0"
            >
              <SepShieldMark className="w-7 h-7" />
              <span className="font-display font-bold text-sm sm:text-base tracking-tight">
                Security Engineering
              </span>
            </a>

            <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--fg-muted)]">
              <a href="#workflow" className="hover:text-[var(--fg-default)] transition-colors whitespace-nowrap shrink-0">
                Platform
              </a>
              <a href="#dialects" className="hover:text-[var(--fg-default)] transition-colors whitespace-nowrap shrink-0">
                Dialects
              </a>
              <a href="#capabilities" className="hover:text-[var(--fg-default)] transition-colors whitespace-nowrap shrink-0">
                Capabilities
              </a>
              <a href="#plans" className="hover:text-[var(--fg-default)] transition-colors whitespace-nowrap shrink-0">
                Plans
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              className="p-2 rounded-md border border-[var(--border-default)] text-[var(--fg-muted)] hover:text-[var(--fg-default)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleSignIn('owner')}
              className="hidden sm:inline-flex text-sm font-medium text-[var(--fg-default)] hover:text-[var(--brand-primary)] transition-colors cursor-pointer whitespace-nowrap shrink-0 px-2 py-1.5"
            >
              {isAuthenticated ? 'Dashboard' : 'Sign in'}
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleSignIn('owner')}
              className="px-4 py-2 text-sm font-semibold rounded-md bg-[var(--fg-default)] text-[var(--bg-surface)] hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
            >
              {isAuthenticated ? 'Open Workspace' : 'Get started'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section framed by crisp vertical architectural borders (Screenshot 2) */}
      <section id="top" className="w-full border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto border-x border-[var(--border-muted)] px-4 sm:px-8 pt-14 sm:pt-20 pb-12 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <a
              href="#workflow"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] text-xs font-medium text-[var(--fg-default)] hover:border-[var(--fg-muted)] transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" aria-hidden="true" />
              <span>SEP Detection v1 &amp; ATT&amp;CK v19.2 Release</span>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--fg-muted)]" />
            </a>

            <h1
              className="font-display font-bold tracking-tight text-[var(--fg-default)] leading-[1.06] mx-auto"
              style={{ fontSize: 'clamp(2.5rem, 4.8vw, 4.25rem)', textWrap: 'balance' }}
            >
              Detection still starts with you
            </h1>

            <p className="text-base sm:text-lg text-[var(--fg-muted)] max-w-2xl mx-auto leading-relaxed">
              Author Sigma and SEP Detection v1 rules in Git, translate queries across KQL, SPL, and Cortex XQL, and deploy with separation-of-duties peer approvals.
            </p>

            {/* Paired inline email/launch bar + adjacent secondary CTA (Screenshot 2 pattern) */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <form
                onSubmit={handleHeroSubmit}
                className="w-full sm:w-auto flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-xs focus-within:border-[var(--brand-primary)]"
              >
                <label htmlFor="hero-work-email" className="sr-only">
                  Work email
                </label>
                <input
                  id="hero-work-email"
                  type="email"
                  value={heroEmail}
                  onChange={(e) => setHeroEmail(e.target.value)}
                  placeholder="Enter your work email"
                  className="flex-1 sm:w-52 px-3 py-2 text-sm bg-transparent text-[var(--fg-default)] placeholder:text-[var(--fg-muted)] focus:outline-none min-w-0"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded-md bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--fg-on-emphasis)] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isAuthenticated ? 'Open Workspace' : isOidcConfigured ? 'Sign in with SSO' : 'Sign in to SEP'}
                </button>
              </form>

              {!isOidcConfigured && !isAuthenticated && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleSignIn('member')}
                  className="w-full sm:w-auto px-5 py-3 text-sm font-semibold rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-canvas)] text-[var(--fg-default)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign in as Approver
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Multi-segment color bar divider (exact top-edge accent from Screenshot 2) */}
        <div
          className="h-[3px] w-full"
          style={{
            background:
              'linear-gradient(90deg, #2F6FD6 0%, #1E8E4E 25%, #0F8C7E 50%, #D98A1C 75%, #2CC5B3 100%)',
          }}
        />
      </section>

      {/* Graph-Paper Grid Embedded Workspace Showcase + Interactive 5-Step Switcher (Screenshots 2 & 3) */}
      <section id="workflow" className="w-full sep-grid-bg border-b border-[var(--border-default)] py-12 sm:py-16 relative">
        {/* Corner pixel-grid accent marks */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            {/* Left Workspace Sidebar */}
            <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-[var(--border-muted)] bg-[var(--bg-canvas)] p-4 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[var(--fg-muted)] px-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--fg-default)]">
                    <FolderGit2 className="w-4 h-4 text-[var(--brand-primary)]" />
                    <span>SEP Control Plane</span>
                  </div>
                  <span className="text-[11px] font-mono">v1.0</span>
                </div>

                <ul className="space-y-1 text-xs">
                  {[
                    { label: 'Overview', icon: Layers, active: activeStepIdx === 0 },
                    { label: 'Pull requests', icon: GitPullRequest, active: false },
                    { label: 'ATT&CK Matrix', icon: Grid3X3, active: activeStepIdx === 2 },
                    { label: 'Conversions', icon: RefreshCw, active: activeStepIdx === 1 },
                    { label: 'Deployments', icon: ShieldCheck, active: activeStepIdx >= 3 },
                  ].map((nav) => {
                    const Icon = nav.icon;
                    return (
                      <li key={nav.label}>
                        <button
                          type="button"
                          onClick={() => {
                            if (nav.label === 'ATT&CK Matrix') setActiveStepIdx(2);
                            else if (nav.label === 'Conversions') setActiveStepIdx(1);
                            else if (nav.label === 'Deployments') setActiveStepIdx(4);
                            else setActiveStepIdx(0);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left cursor-pointer transition-colors ${
                            nav.active
                              ? 'bg-[var(--bg-surface)] text-[var(--fg-default)] font-semibold border border-[var(--border-default)]'
                              : 'text-[var(--fg-muted)] hover:text-[var(--fg-default)] hover:bg-[var(--bg-surface)]/60'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{nav.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="pt-3 border-t border-[var(--border-muted)] space-y-1.5">
                  <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                    Repositories
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="px-2.5 py-1.5 rounded bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)] font-medium truncate">
                      ex-181748/detections
                    </div>
                    <div className="px-2.5 py-1.5 text-[var(--fg-muted)] truncate">
                      soc-core/sigma-packs
                    </div>
                    <div className="px-2.5 py-1.5 text-[var(--fg-muted)] truncate">
                      cloud/sentinel-analytics
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-muted)] flex items-center justify-between px-1 text-xs">
                <span className="font-medium text-[var(--fg-default)] truncate">exowner · Tenant Owner</span>
                <span className="font-mono text-[11px] text-[var(--fg-muted)]">main</span>
              </div>
            </aside>

            {/* Center Activity / Rule Engineering Stream */}
            <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-[var(--border-muted)] p-5 sm:p-6 flex flex-col justify-between gap-5 bg-[var(--bg-surface)]">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-muted)]">
                  <span className="text-sm font-semibold text-[var(--fg-default)] truncate">
                    {activeStep.title}
                  </span>
                  <span className="text-xs font-mono text-[var(--fg-muted)] shrink-0">ex-181748</span>
                </div>

                <div className="flex justify-end">
                  <div className="px-3.5 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] font-mono text-xs text-[var(--fg-default)]">
                    {activeStep.command}
                  </div>
                </div>

                <p className="text-sm text-[var(--fg-default)] leading-relaxed">
                  {activeStep.summary}
                </p>

                <ul className="space-y-2 text-xs text-[var(--fg-muted)]">
                  {activeStep.steps.map((s) => (
                    <li key={s.text} className="flex items-center gap-2">
                      {s.icon === 'branch' && <GitBranch className="w-3.5 h-3.5 text-[var(--info)] shrink-0" />}
                      {s.icon === 'grid' && <Grid3X3 className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" />}
                      {s.icon === 'check' && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />}
                      <span className="font-mono truncate">{s.text}</span>
                    </li>
                  ))}
                </ul>

                <div className="rounded-md border border-[var(--border-muted)] bg-[var(--bg-canvas)] px-3.5 py-2.5 font-mono text-xs text-[var(--fg-default)] overflow-x-auto">
                  {activeStep.terminal}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3.5 py-2.5">
                <span className="text-xs text-[var(--fg-muted)] truncate">
                  Launch Rule AI or validate a YAML rule inside your workspace…
                </span>
                <button
                  type="button"
                  onClick={() => handleSignIn('owner')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--brand-primary)] text-[var(--fg-on-emphasis)] text-xs font-semibold hover:bg-[var(--brand-primary-hover)] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Open</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Right Dark Inspection Preview Pane (matching dark Theme/Preview panel in Screenshot 3) */}
            <div className="lg:col-span-4 bg-[#0D131D] text-[#E6EDF5] p-5 sm:p-6 flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2 font-mono text-[#93A4B8] truncate">
                    <SepShieldMark className="w-4 h-4" />
                    <span>sep.security.local/settings</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#2CC5B3]">Live</span>
                </div>

                <div>
                  <h3 className="font-display text-base font-semibold text-white">
                    {activeStep.rightHeading}
                  </h3>
                  <p className="text-xs text-[#93A4B8] mt-1 leading-relaxed">
                    {activeStep.rightSub}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {activeStep.options.map((opt, idx) => {
                    const chosen = selectedRightOption === idx;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedRightOption(idx)}
                        className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                          chosen
                            ? 'border-[#2CC5B3] bg-[#13222B]'
                            : 'border-white/15 bg-[#111823] hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="w-2.5 h-2.5 rounded-full border border-[#2CC5B3] flex items-center justify-center">
                            {chosen && <span className="w-1.5 h-1.5 rounded-full bg-[#2CC5B3]" />}
                          </span>
                          <span className="text-[10px] font-mono text-[#2CC5B3]">{opt.badge}</span>
                        </div>
                        <div className="text-xs font-semibold text-white">{opt.title}</div>
                        <div className="text-[11px] text-[#93A4B8] mt-1 leading-snug">{opt.subtitle}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-[#080C12] p-3 text-xs font-mono text-[#93A4B8]">
                <div className="text-white mb-1">Active Rule Snapshot</div>
                <div>commit 78bce0e · KQL &amp; SPL verified</div>
              </div>
            </div>
          </div>

          {/* 5-Step Pill Workflow Switcher (Screenshot 3 bottom pills) */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            {WORKFLOW_STEPS.map((step, idx) => {
              const isActive = activeStepIdx === idx;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    setActiveStepIdx(idx);
                    setSelectedRightOption(0);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[var(--fg-default)] text-[var(--bg-surface)] border-[var(--fg-default)] font-semibold shadow-sm'
                      : 'bg-[var(--bg-surface)] text-[var(--fg-default)] border-[var(--border-default)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  {step.label}
                </button>
              );
            })}
            <button
              type="button"
              aria-label="Reset workflow showcase"
              onClick={() => {
                setActiveStepIdx(0);
                setSelectedRightOption(0);
              }}
              className="p-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-muted)] hover:text-[var(--fg-default)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Section 3: Dialect Intelligence Showcase (Screenshot 4 — "Let SEP handle the dialects") */}
      <section id="dialects" className="w-full border-b border-[var(--border-default)] bg-[var(--bg-surface)] py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center space-y-4 mb-12">
            <h2
              className="font-display font-bold tracking-tight text-[var(--fg-default)]"
              style={{ fontSize: 'clamp(1.85rem, 3.5vw, 3rem)', textWrap: 'balance' }}
            >
              Let SEP handle the dialects
            </h2>
            <p className="text-base text-[var(--fg-muted)] leading-relaxed">
              Translate detections across Microsoft Sentinel KQL, Splunk SPL, and Cortex XQL using canonical field mapping sets and deterministic syntax checks.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleSignIn('owner')}
                className="px-5 py-2.5 rounded-md bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--fg-on-emphasis)] text-sm font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                Get started for free
              </button>
              <a
                href="#plans"
                className="px-5 py-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-canvas)] text-[var(--fg-default)] text-sm font-semibold whitespace-nowrap shrink-0"
              >
                Compare plans
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-default)] sep-grid-bg p-5 sm:p-10">
            <div className="max-w-4xl mx-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg overflow-hidden grid grid-cols-1 md:grid-cols-12">
              <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-[var(--border-muted)] bg-[var(--bg-canvas)] p-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] px-1">
                  Target Dialects
                </div>
                <div className="space-y-1.5">
                  {DIALECT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setActiveDialectTab(preset.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                        activeDialectTab === preset.id
                          ? 'bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)] font-semibold'
                          : 'text-[var(--fg-default)] hover:bg-[var(--bg-surface)]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="pt-3 border-t border-[var(--border-muted)] text-xs text-[var(--fg-muted)] space-y-1 font-mono px-1">
                  <div>Mapping: canonical v2</div>
                  <div>Source: DeviceProcessEvents</div>
                </div>
              </div>

              <div className="md:col-span-8 p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-muted)]">
                  <span className="font-semibold text-sm text-[var(--fg-default)]">
                    {activeDialect.label}
                  </span>
                  <span className="text-xs font-mono text-[var(--success)] inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Syntax Valid
                  </span>
                </div>

                <div className="text-xs text-[var(--fg-muted)]">{activeDialect.summary}</div>

                <pre className="rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] p-4 text-xs font-mono text-[var(--fg-default)] overflow-x-auto leading-relaxed">
                  {activeDialect.query}
                </pre>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
                  <div className="p-2.5 rounded border border-[var(--border-muted)] bg-[var(--bg-canvas)]">
                    <div className="text-[var(--fg-muted)] text-[11px]">Canonical</div>
                    <div className="text-[var(--fg-default)] font-semibold mt-0.5 truncate">process.name</div>
                  </div>
                  <div className="p-2.5 rounded border border-[var(--border-muted)] bg-[var(--bg-canvas)]">
                    <div className="text-[var(--fg-muted)] text-[11px]">Canonical</div>
                    <div className="text-[var(--fg-default)] font-semibold mt-0.5 truncate">process.command_line</div>
                  </div>
                  <div className="p-2.5 rounded border border-[var(--border-muted)] bg-[var(--bg-canvas)]">
                    <div className="text-[var(--fg-muted)] text-[11px]">Mode</div>
                    <div className="text-[var(--brand-primary)] font-semibold mt-0.5">Deterministic</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: "More ways to govern detections" Architectural Split Bento Grid (Screenshot 5) */}
      <section id="capabilities" className="w-full border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-10 text-center">
          <h2
            className="font-display font-bold tracking-tight text-[var(--fg-default)]"
            style={{ fontSize: 'clamp(1.85rem, 3.2vw, 2.75rem)' }}
          >
            More ways to govern detections
          </h2>
        </div>

        {/* 2-Column Bordered Bento Row */}
        <div className="max-w-7xl mx-auto border-t border-[var(--border-default)] grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-default)]">
          {/* Left Bento Card: Deployment Gates (Actions equivalent) */}
          <div className="p-8 sm:p-12 flex flex-col justify-between gap-6">
            <div className="rounded-lg border border-[var(--border-default)] sep-grid-bg p-5 sm:p-6">
              <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border-muted)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[var(--success)] text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-[var(--fg-default)]">All deployment gates passed</div>
                      <div className="text-[11px] text-[var(--fg-muted)]">4 verified stages</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-[var(--fg-muted)]">Production</span>
                </div>
                <div className="divide-y divide-[var(--border-muted)] text-xs">
                  {[
                    { step: 'Schema Check', detail: 'Validated in 420ms' },
                    { step: 'ATT&CK Tagging', detail: 'Mapped T1003.001 in 120ms' },
                    { step: 'Peer Approval', detail: 'Signed by exmember-138c23c5' },
                    { step: 'SIEM Rollout', detail: 'Pushed via private connector in 1.4s' },
                  ].map((row) => (
                    <div key={row.step} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 font-medium text-[var(--fg-default)]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                        <span>{row.step}</span>
                      </span>
                      <span className="text-[var(--fg-muted)] font-mono text-[11px] truncate">{row.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="font-display text-lg font-bold text-[var(--fg-default)]">Deployment Gates</h3>
                <p className="text-sm text-[var(--fg-muted)] mt-1">
                  Automated rule validation, peer approvals, and one-click rollback across SIEM targets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSignIn('owner')}
                className="px-4 py-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--fg-default)] cursor-pointer"
              >
                Explore Deployments
              </button>
            </div>
          </div>

          {/* Right Bento Card: Pull Request Rule Diffs (Code Quality equivalent) */}
          <div className="p-8 sm:p-12 flex flex-col justify-between gap-6">
            <div className="rounded-lg border border-[var(--border-default)] sep-grid-bg p-5 sm:p-6">
              <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[var(--border-muted)] bg-[var(--bg-canvas)] text-xs flex items-center justify-between">
                  <span className="font-mono font-semibold text-[var(--fg-default)]">sep-validator · review</span>
                  <span className="text-[11px] text-[var(--fg-muted)]">rules/lsass_dump.yaml</span>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-[var(--fg-default)]">
                      Broaden LSASS GrantedAccess mask check
                    </div>
                    <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                      Include 0x1410 handle mask to catch modern credential dumpers without extra noise.
                    </p>
                  </div>
                  <div className="rounded border border-[var(--border-muted)] font-mono text-[11px] overflow-hidden">
                    <div className="px-3 py-1 bg-[var(--danger-subtle)] text-[var(--danger)]">
                      - | where GrantedAccess == &quot;0x1010&quot;
                    </div>
                    <div className="px-3 py-1 bg-[var(--success-subtle)] text-[var(--success)]">
                      + | where GrantedAccess in (&quot;0x1010&quot;, &quot;0x1410&quot;)
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSuggestionCommitted(true)}
                      className="px-3 py-1.5 rounded bg-[var(--brand-primary)] text-[var(--fg-on-emphasis)] text-xs font-semibold hover:bg-[var(--brand-primary-hover)] cursor-pointer"
                    >
                      {suggestionCommitted ? 'Suggestion committed ✓' : 'Commit suggestion'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="font-display text-lg font-bold text-[var(--fg-default)]">Pull Request Reviews</h3>
                <p className="text-sm text-[var(--fg-muted)] mt-1">
                  Rule schema checks, inline YAML diffs, branch protections, and audit-logged approvals.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSignIn('owner')}
                className="px-4 py-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--fg-default)] cursor-pointer"
              >
                Explore Pull Requests
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Architectural Split Proof & Metrics (Screenshot 6) */}
      <section className="w-full border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-default)]">
          {/* Quote Carousel Column */}
          <div className="lg:col-span-7 p-8 sm:p-14 flex flex-col justify-between gap-8">
            <div className="space-y-6">
              <div className="w-10 h-10 rounded-lg bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)] font-display font-bold text-2xl flex items-center justify-center">
                &ldquo;
              </div>
              <blockquote
                className="font-display font-semibold tracking-tight text-[var(--fg-default)] leading-snug"
                style={{ fontSize: 'clamp(1.35rem, 2.2vw, 1.9rem)' }}
              >
                {activeQuote.quote}
              </blockquote>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] font-display font-bold text-xs text-[var(--fg-default)] flex items-center justify-center">
                  {activeQuote.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--fg-default)]">{activeQuote.author}</div>
                  <div className="text-xs text-[var(--fg-muted)]">{activeQuote.role}</div>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] px-2 py-1">
                <button
                  type="button"
                  aria-label="Previous customer quote"
                  onClick={() => setQuoteIdx((i) => (i - 1 + PROOF_QUOTES.length) % PROOF_QUOTES.length)}
                  className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg-default)] cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1.5 px-1">
                  {PROOF_QUOTES.map((q, idx) => (
                    <button
                      key={q.author}
                      type="button"
                      aria-label={`View quote ${idx + 1}`}
                      onClick={() => setQuoteIdx(idx)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        idx === quoteIdx
                          ? 'w-5 bg-[var(--fg-default)]'
                          : 'w-1.5 bg-[var(--border-default)] hover:bg-[var(--fg-muted)]'
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Next customer quote"
                  onClick={() => setQuoteIdx((i) => (i + 1) % PROOF_QUOTES.length)}
                  className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg-default)] cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Split 2-Row Metrics */}
          <div className="lg:col-span-5 grid grid-rows-2 divide-y divide-[var(--border-default)]">
            <div className="p-8 sm:p-12 flex flex-col justify-center">
              <div className="font-display text-4xl sm:text-5xl font-bold text-[var(--brand-primary)] tabular-nums">
                v19.2
              </div>
              <div className="mt-2 font-mono text-xs text-[var(--fg-muted)]">
                MITRE ATT&amp;CK tactics and techniques mapped automatically
              </div>
            </div>
            <div className="p-8 sm:p-12 flex flex-col justify-center">
              <div className="font-display text-4xl sm:text-5xl font-bold text-[var(--brand-primary)] tabular-nums">
                100%
              </div>
              <div className="mt-2 font-mono text-xs text-[var(--fg-muted)]">
                Separation-of-duties enforcement on production SIEM rollouts
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6: Plans & Entitlements (Connected to GET /api/v1/plans) */}
      <section id="plans" className="w-full border-b border-[var(--border-default)] bg-[var(--bg-canvas)] py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--fg-default)]">
              Plans built for individual hunters and enterprise SOCs
            </h2>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">
              Start in a personal workspace or provision a team tenant with SAML SSO, SCIM provisioning, and private SIEM connectors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 border border-[var(--border-default)] rounded-lg bg-[var(--bg-surface)] divide-y md:divide-y-0 md:divide-x divide-[var(--border-default)] overflow-hidden">
            {plans.map((plan) => {
              const isTeam = plan.key === 'team';
              const price = plan.priceMonthlyCents === 0 ? '$0' : `$${Math.round(plan.priceMonthlyCents / 100)}`;
              return (
                <div key={plan.key} className="p-6 sm:p-8 flex flex-col justify-between gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-lg font-bold text-[var(--fg-default)]">{plan.name}</h3>
                      {plan.trialDays > 0 && (
                        <span className="text-xs font-mono text-[var(--brand-primary)]">
                          {plan.trialDays}-day trial
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-3xl font-bold text-[var(--fg-default)] tabular-nums">
                        {price}
                      </span>
                      <span className="text-xs text-[var(--fg-muted)]">/ month</span>
                    </div>

                    <p className="text-sm text-[var(--fg-muted)]">{plan.description}</p>

                    <ul className="space-y-2 pt-3 border-t border-[var(--border-muted)] text-xs text-[var(--fg-default)]">
                      {Object.entries(plan.entitlements).slice(0, 6).map(([k, v]) => {
                        const formatted =
                          k === 'storage_bytes'
                            ? formatBytes(v)
                            : v < 0
                              ? 'Unlimited'
                              : v === 1 && (k.includes('sso') || k.includes('scim') || k.includes('audit') || k.includes('policy'))
                                ? 'Included'
                                : String(v);
                        return (
                          <li key={k} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-[var(--fg-muted)]">
                              <Check className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" />
                              <span>{k.replace(/[._]/g, ' ')}</span>
                            </span>
                            <span className="font-mono font-medium tabular-nums">{formatted}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSignIn('owner')}
                    className={`w-full py-2.5 px-4 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      isTeam
                        ? 'bg-[var(--brand-primary)] text-[var(--fg-on-emphasis)] hover:bg-[var(--brand-primary-hover)]'
                        : 'border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--fg-default)] hover:bg-[var(--bg-canvas)]'
                    }`}
                  >
                    {isAuthenticated ? 'Manage in workspace' : 'Sign in to get started'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 7: Footer with Engineering Digest + 4 Navigation Columns (Screenshot 1) */}
      <footer className="bg-[var(--bg-canvas)] py-14 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          {/* Top Brand + Digest row */}
          <div className="space-y-4 max-w-md">
            <a href="#top" className="inline-flex items-center gap-2 text-[var(--fg-default)]">
              <SepShieldMark className="w-7 h-7" />
              <span className="font-display font-bold text-base tracking-tight">
                Security Engineering
              </span>
            </a>

            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-[var(--fg-default)] uppercase">
                <span className="w-1.5 h-3.5 bg-[var(--brand-primary)] inline-block" aria-hidden="true" />
                <span>The Detection Digest</span>
              </div>
              <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
                Get rule schemas, ATT&amp;CK mappings, and dialect updates. Twice a month in your inbox.
              </p>

              <form onSubmit={handleDigestSubmit} className="flex flex-wrap items-center gap-2 pt-1">
                <label htmlFor="footer-digest-email" className="sr-only">
                  Email address for detection digest
                </label>
                <input
                  id="footer-digest-email"
                  type="email"
                  value={digestEmail}
                  onChange={(e) => {
                    setDigestEmail(e.target.value);
                    if (digestStatus !== 'idle') setDigestStatus('idle');
                  }}
                  placeholder="you@security-team.io"
                  className="px-3 py-2 text-xs rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)] w-56"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--fg-on-emphasis)] text-xs font-semibold cursor-pointer"
                >
                  Subscribe
                </button>
              </form>
              {digestStatus === 'error' && (
                <p className="text-xs text-[var(--danger)]">Enter a valid email address.</p>
              )}
              {digestStatus === 'subscribed' && (
                <p className="text-xs text-[var(--success)]">Subscribed to The Detection Digest.</p>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--border-muted)] pt-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
            <div className="space-y-3">
              <div className="font-mono font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Platform</div>
              <ul className="space-y-2.5 text-[var(--fg-default)]">
                <li><a href="#workflow" className="hover:text-[var(--brand-primary)]">Rule Repositories</a></li>
                <li><a href="#workflow" className="hover:text-[var(--brand-primary)]">Pull Requests</a></li>
                <li><a href="#dialects" className="hover:text-[var(--brand-primary)]">Dialect Converter</a></li>
                <li><a href="#capabilities" className="hover:text-[var(--brand-primary)]">Deployment Gates</a></li>
                <li><a href="#plans" className="hover:text-[var(--brand-primary)]">Plans &amp; Entitlements</a></li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="font-mono font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Engineering</div>
              <ul className="space-y-2.5 text-[var(--fg-default)]">
                <li><a href="#dialects" className="hover:text-[var(--brand-primary)]">Microsoft Sentinel KQL</a></li>
                <li><a href="#dialects" className="hover:text-[var(--brand-primary)]">Splunk SPL</a></li>
                <li><a href="#dialects" className="hover:text-[var(--brand-primary)]">Cortex XSIAM XQL</a></li>
                <li><a href="#workflow" className="hover:text-[var(--brand-primary)]">Canonical Field Mappings</a></li>
                <li><a href="#workflow" className="hover:text-[var(--brand-primary)]">MITRE ATT&amp;CK v19.2</a></li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="font-mono font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Governance</div>
              <ul className="space-y-2.5 text-[var(--fg-default)]">
                <li><a href="#capabilities" className="hover:text-[var(--brand-primary)]">Branch Protections</a></li>
                <li><a href="#capabilities" className="hover:text-[var(--brand-primary)]">Peer Approvals</a></li>
                <li><a href="#plans" className="hover:text-[var(--brand-primary)]">SAML SSO &amp; SCIM</a></li>
                <li><a href="#plans" className="hover:text-[var(--brand-primary)]">Audit Logging</a></li>
                <li><a href="#plans" className="hover:text-[var(--brand-primary)]">Private Connectors</a></li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="font-mono font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Access</div>
              <ul className="space-y-2.5 text-[var(--fg-default)]">
                <li>
                  <button
                    type="button"
                    onClick={() => handleSignIn('owner')}
                    className="hover:text-[var(--brand-primary)] cursor-pointer text-left"
                  >
                    Sign in to Workspace
                  </button>
                </li>
                {!isOidcConfigured && !isAuthenticated && (
                  <li>
                    <button
                      type="button"
                      onClick={() => handleSignIn('member')}
                      className="hover:text-[var(--brand-primary)] cursor-pointer text-left"
                    >
                      Sign in as Approver
                    </button>
                  </li>
                )}
                <li><a href="#top" className="hover:text-[var(--brand-primary)]">Back to top</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
