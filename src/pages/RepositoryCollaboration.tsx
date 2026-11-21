import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Check,
  CircleDot,
  FileCode2,
  GitMerge,
  GitPullRequest,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SepApiError } from '../api/client';
import type { RepositoryDto } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/ui/Badge';
import { Blankslate } from '../components/ui/Blankslate';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { MarkdownView } from '../components/ui/MarkdownView';
import { SkeletonRows } from '../components/ui/Skeleton';
import { formatRelativeTime } from '../utils/rule-helpers';

export function PullRequestsTab({ repo }: { repo: RepositoryDto }) {
  const { api } = useAuth();
  const params = useParams<{ number?: string }>();
  const prNumber = params.number ? Number(params.number) : null;

  if (prNumber) {
    return <PullRequestDetailView repo={repo} number={prNumber} />;
  }

  return <PullRequestListView repo={repo} />;
}

function PullRequestListView({ repo }: { repo: RepositoryDto }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [newOpen, setNewOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [head, setHead] = useState('');
  const [base, setBase] = useState(repo.defaultBranch);

  const { data: branchesPage } = useQuery({
    queryKey: ['repo-branches', repo.tenantId, repo.id],
    queryFn: () => api.listBranches(repo.tenantId, repo.id, { limit: 50 }),
  });

  const { data: prsPage, isLoading, error } = useQuery({
    queryKey: ['repo-prs', repo.tenantId, repo.id, stateFilter],
    queryFn: () => api.listPullRequests(repo.tenantId, repo.id, { limit: 30, state: stateFilter }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createPullRequest(repo.tenantId, repo.id, {
        title: title.trim(),
        body: body.trim() || undefined,
        head: head.trim(),
        base: base.trim(),
      }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      setNewOpen(false);
      queryClient.invalidateQueries({ queryKey: ['repo-prs', repo.tenantId, repo.id] });
    },
  });

  const branches = branchesPage?.items ?? [];
  useEffect(() => {
    if (branches.length > 0 && !head) {
      const nonDefault = branches.find((b) => b.name !== repo.defaultBranch) ?? branches[0];
      setHead(nonDefault.name);
    }
  }, [branches, head, repo.defaultBranch]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-0.5">
          {(['open', 'closed', 'all'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStateFilter(st)}
              className={`px-3 py-1 text-xs font-medium rounded capitalize cursor-pointer ${
                stateFilter === st
                  ? 'bg-[var(--brand-primary)] text-[var(--fg-on-emphasis)]'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg-default)]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" onClick={() => setNewOpen((v) => !v)}>
          <Plus className="w-3.5 h-3.5" />
          <span>New pull request</span>
        </Button>
      </div>

      {(error || createMutation.error) && (
        <ErrorBanner error={error || createMutation.error} tenantSlug={repo.owner} />
      )}

      {newOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Compare (head branch)</label>
              <select
                value={head}
                onChange={(e) => setHead(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
              >
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Into (base branch)</label>
              <select
                value={base}
                onChange={(e) => setBase(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
              >
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Pull request title"
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe detection rule changes (Markdown supported)"
            className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={createMutation.isPending || !title.trim()}>
              Open pull request
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : (prsPage?.items ?? []).length === 0 ? (
        <Blankslate
          icon={<GitPullRequest className="w-8 h-8" />}
          title="No pull requests"
          description="Create a branch and open a pull request to review detection rule updates before merging."
        />
      ) : (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
          {(prsPage?.items ?? []).map((pr) => (
            <Link
              key={pr.number}
              to={`/${repo.fullName}/pulls/${pr.number}`}
              className="p-4 flex items-center justify-between gap-3 hover:bg-[var(--bg-subtle)]"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-[var(--fg-default)]">
                    #{pr.number} {pr.title}
                  </span>
                  <StatusBadge status={pr.state} />
                </div>
                <div className="text-xs font-mono text-[var(--fg-muted)]">
                  {pr.head} → {pr.base} · opened by @{pr.author.username} · {formatRelativeTime(pr.createdAt)}
                </div>
              </div>
              <span className="text-xs text-[var(--brand-primary)] shrink-0">View →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function PullRequestDetailView({ repo, number }: { repo: RepositoryDto; number: number }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [reviewEvent, setReviewEvent] = useState<'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'>('APPROVE');
  const [reviewBody, setReviewBody] = useState('');
  const [commentPath, setCommentPath] = useState('');
  const [commentLine, setCommentLine] = useState('');
  const [commentText, setCommentText] = useState('');
  const [mergeMethod, setMergeMethod] = useState<'merge' | 'squash' | 'rebase'>('squash');

  const { data: pr, isLoading, error } = useQuery({
    queryKey: ['pr-detail', repo.tenantId, repo.id, number],
    queryFn: () => api.getPullRequest(repo.tenantId, repo.id, number),
  });

  const { data: filesPage } = useQuery({
    queryKey: ['pr-files', repo.tenantId, repo.id, number],
    queryFn: () => api.listPullRequestFiles(repo.tenantId, repo.id, number, { limit: 100 }),
  });

  const { data: reviews } = useQuery({
    queryKey: ['pr-reviews', repo.tenantId, repo.id, number],
    queryFn: () => api.listPullRequestReviews(repo.tenantId, repo.id, number),
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      api.createPullRequestReview(repo.tenantId, repo.id, number, {
        event: reviewEvent,
        body: reviewBody.trim() || undefined,
        comments:
          commentPath.trim() && commentText.trim()
            ? [
                {
                  path: commentPath.trim(),
                  body: commentText.trim(),
                  line: commentLine ? Number(commentLine) : undefined,
                },
              ]
            : undefined,
      }),
    onSuccess: () => {
      setReviewBody('');
      setCommentPath('');
      setCommentLine('');
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['pr-reviews', repo.tenantId, repo.id, number] });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: () => api.mergePullRequest(repo.tenantId, repo.id, number, { method: mergeMethod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-detail', repo.tenantId, repo.id, number] });
      queryClient.invalidateQueries({ queryKey: ['repo-prs', repo.tenantId, repo.id] });
    },
  });

  const stateMutation = useMutation({
    mutationFn: (state: 'open' | 'closed') =>
      api.updatePullRequest(repo.tenantId, repo.id, number, { state }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-detail', repo.tenantId, repo.id, number] });
    },
  });

  if (isLoading) return <SkeletonRows rows={4} />;
  if (error) return <ErrorBanner error={error} tenantSlug={repo.owner} />;
  if (!pr) return null;

  const files = filesPage?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link to={`/${repo.fullName}/pulls`} className="text-xs text-[var(--brand-primary)] hover:underline">
          ← All pull requests
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-xl font-bold text-[var(--fg-default)]">
                #{pr.number} {pr.title}
              </h2>
              <StatusBadge status={pr.state} />
            </div>
            <div className="text-xs font-mono text-[var(--fg-muted)] mt-1">
              @{pr.author.username} wants to merge {pr.head} into {pr.base}
            </div>
          </div>

          {pr.state === 'open' ? (
            <Button variant="secondary" size="sm" onClick={() => stateMutation.mutate('closed')}>
              Close PR
            </Button>
          ) : pr.state === 'closed' ? (
            <Button variant="secondary" size="sm" onClick={() => stateMutation.mutate('open')}>
              Reopen PR
            </Button>
          ) : null}
        </div>
      </div>

      {(reviewMutation.error || mergeMutation.error || stateMutation.error) && (
        <ErrorBanner
          error={reviewMutation.error || mergeMutation.error || stateMutation.error}
          tenantSlug={repo.owner}
        />
      )}

      {pr.body && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <MarkdownView content={pr.body} />
        </div>
      )}

      {/* Changed files summary (names + status + +/- counts only) */}
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)] text-xs font-semibold flex items-center justify-between">
          <span>Changed Files ({files.length})</span>
          <span className="text-[var(--fg-muted)] font-normal">Summary view</span>
        </div>
        <div className="divide-y divide-[var(--border-muted)]">
          {files.length === 0 ? (
            <div className="p-4 text-xs text-[var(--fg-muted)]">No changed files reported.</div>
          ) : (
            files.map((f) => (
              <div key={f.path} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode2 className="w-3.5 h-3.5 text-[var(--fg-muted)] shrink-0" />
                  <span className="truncate text-[var(--fg-default)]">{f.path}</span>
                  <span className="text-[11px] text-[var(--fg-muted)]">({f.status})</span>
                </div>
                <div className="flex items-center gap-2 tabular-nums shrink-0">
                  <span className="text-[var(--success)]">+{f.additions}</span>
                  <span className="text-[var(--danger)]">-{f.deletions}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Merge box */}
      {pr.state === 'open' && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs">
            <div className="font-semibold text-[var(--fg-default)]">
              {pr.mergeable ? 'Ready to merge' : 'Merge blocked by branch protection or conflicts'}
            </div>
            <div className="text-[var(--fg-muted)] mt-0.5">
              Head commit: <code className="font-mono">{pr.headSha.slice(0, 7)}</code>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Merge method"
              value={mergeMethod}
              onChange={(e) => setMergeMethod(e.target.value as 'merge' | 'squash' | 'rebase')}
              className="px-2.5 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              <option value="squash">Squash and merge</option>
              <option value="merge">Create merge commit</option>
              <option value="rebase">Rebase and merge</option>
            </select>
            <Button
              variant="primary"
              size="sm"
              disabled={mergeMutation.isPending || !pr.mergeable}
              onClick={() => mergeMutation.mutate()}
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>{mergeMutation.isPending ? 'Merging…' : 'Merge pull request'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="space-y-3">
        <h3 className="font-display text-sm font-semibold text-[var(--fg-default)]">
          Reviews ({(reviews ?? []).length})
        </h3>
        {(reviews ?? []).map((rev) => (
          <div key={rev.id} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold">@{rev.author.username}</span>
                <StatusBadge status={rev.state} />
                {rev.stale && <span className="text-[var(--warning)]">(stale)</span>}
              </div>
              <span className="text-[var(--fg-muted)]">{formatRelativeTime(rev.submittedAt)}</span>
            </div>
            {rev.body && <MarkdownView content={rev.body} />}
            {rev.comments.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-[var(--border-muted)]">
                {rev.comments.map((c) => (
                  <div key={c.id} className="text-xs bg-[var(--bg-subtle)] p-2 rounded">
                    <span className="font-mono font-semibold">{c.path}{c.line ? `:${c.line}` : ''}: </span>
                    <span>{c.body}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Submit Review form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            reviewMutation.mutate();
          }}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3"
        >
          <div className="font-semibold text-xs text-[var(--fg-default)]">Submit review</div>
          <textarea
            rows={2}
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
            placeholder="Overall review comment"
            className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={commentPath}
              onChange={(e) => setCommentPath(e.target.value)}
              placeholder="Optional file path (e.g. rules/kql.yaml)"
              className="px-2.5 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
            <input
              type="number"
              value={commentLine}
              onChange={(e) => setCommentLine(e.target.value)}
              placeholder="Line #"
              className="px-2.5 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Inline line note"
              className="px-2.5 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              value={reviewEvent}
              onChange={(e) => setReviewEvent(e.target.value as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT')}
              className="px-3 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              <option value="APPROVE">Approve</option>
              <option value="REQUEST_CHANGES">Request changes</option>
              <option value="COMMENT">Comment only</option>
            </select>
            <Button type="submit" variant="primary" size="sm" disabled={reviewMutation.isPending}>
              Submit review
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function IssuesTab({ repo }: { repo: RepositoryDto }) {
  const params = useParams<{ number?: string }>();
  const issueNum = params.number ? Number(params.number) : null;
  if (issueNum) return <IssueDetailView repo={repo} number={issueNum} />;
  return <IssueListView repo={repo} />;
}

function IssueListView({ repo }: { repo: RepositoryDto }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [newOpen, setNewOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#0F8C7E');
  const [milestoneTitle, setMilestoneTitle] = useState('');

  const { data: issuesPage, isLoading, error } = useQuery({
    queryKey: ['repo-issues', repo.tenantId, repo.id, stateFilter],
    queryFn: () => api.listIssues(repo.tenantId, repo.id, { limit: 30, state: stateFilter }),
  });

  const { data: labels } = useQuery({
    queryKey: ['repo-labels', repo.tenantId, repo.id],
    queryFn: () => api.listLabels(repo.tenantId, repo.id),
  });

  const { data: milestones } = useQuery({
    queryKey: ['repo-milestones', repo.tenantId, repo.id],
    queryFn: () => api.listMilestones(repo.tenantId, repo.id, 'all'),
  });

  const createIssueMutation = useMutation({
    mutationFn: () => api.createIssue(repo.tenantId, repo.id, { title: title.trim(), body: body.trim() || undefined }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      setNewOpen(false);
      queryClient.invalidateQueries({ queryKey: ['repo-issues', repo.tenantId, repo.id] });
    },
  });

  const createLabelMutation = useMutation({
    mutationFn: () => api.createLabel(repo.tenantId, repo.id, { name: labelName.trim(), color: labelColor }),
    onSuccess: () => {
      setLabelName('');
      queryClient.invalidateQueries({ queryKey: ['repo-labels', repo.tenantId, repo.id] });
    },
  });

  const createMilestoneMutation = useMutation({
    mutationFn: () => api.createMilestone(repo.tenantId, repo.id, { title: milestoneTitle.trim() }),
    onSuccess: () => {
      setMilestoneTitle('');
      queryClient.invalidateQueries({ queryKey: ['repo-milestones', repo.tenantId, repo.id] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-0.5">
          {(['open', 'closed', 'all'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStateFilter(st)}
              className={`px-3 py-1 text-xs font-medium rounded capitalize cursor-pointer ${
                stateFilter === st
                  ? 'bg-[var(--brand-primary)] text-[var(--fg-on-emphasis)]'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg-default)]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setMetaOpen((v) => !v)}>
            Labels &amp; Milestones
          </Button>
          <Button variant="primary" size="sm" onClick={() => setNewOpen((v) => !v)}>
            <Plus className="w-3.5 h-3.5" />
            <span>New issue</span>
          </Button>
        </div>
      </div>

      {error && <ErrorBanner error={error} tenantSlug={repo.owner} />}

      {metaOpen && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold">Labels ({(labels ?? []).length})</h4>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createLabelMutation.mutate();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                required
                value={labelName}
                onChange={(e) => setLabelName(e.target.value)}
                placeholder="Label name"
                className="flex-1 px-2.5 py-1 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
              />
              <input
                type="color"
                value={labelColor}
                onChange={(e) => setLabelColor(e.target.value)}
                className="w-8 h-7 rounded border border-[var(--border-default)] cursor-pointer"
              />
              <Button type="submit" variant="secondary" size="sm" disabled={!labelName.trim()}>
                Add
              </Button>
            </form>
            <div className="flex flex-wrap gap-1.5">
              {(labels ?? []).map((l) => (
                <span key={l.id} className="px-2 py-0.5 text-[11px] rounded border border-[var(--border-default)]">
                  {l.name}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold">Milestones ({(milestones ?? []).length})</h4>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMilestoneMutation.mutate();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                required
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                placeholder="Milestone title (e.g. Q4 Sprint)"
                className="flex-1 px-2.5 py-1 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
              />
              <Button type="submit" variant="secondary" size="sm" disabled={!milestoneTitle.trim()}>
                Add
              </Button>
            </form>
            <div className="space-y-1 text-xs text-[var(--fg-muted)]">
              {(milestones ?? []).map((m) => (
                <div key={m.id}>{m.title} ({m.state})</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {newOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createIssueMutation.mutate();
          }}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3"
        >
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Issue title (e.g. Tune false positive on svc-backup)"
            className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Details (Markdown supported)"
            className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={!title.trim()}>
              Submit issue
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : (issuesPage?.items ?? []).length === 0 ? (
        <Blankslate
          icon={<CircleDot className="w-8 h-8" />}
          title="No issues"
          description="Track false-positive tuning requests, telemetry gaps, and detection backlog items here."
        />
      ) : (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
          {(issuesPage?.items ?? []).map((issue) => (
            <Link
              key={issue.number}
              to={`/${repo.fullName}/issues/${issue.number}`}
              className="p-4 flex items-center justify-between gap-3 hover:bg-[var(--bg-subtle)]"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-[var(--fg-default)]">
                    #{issue.number} {issue.title}
                  </span>
                  <StatusBadge status={issue.state} />
                </div>
                <div className="text-xs text-[var(--fg-muted)] font-mono">
                  opened by @{issue.author.username} · {issue.comments} comments · {formatRelativeTime(issue.createdAt)}
                </div>
              </div>
              <span className="text-xs text-[var(--brand-primary)] shrink-0">View →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function IssueDetailView({ repo, number }: { repo: RepositoryDto; number: number }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState('');

  const { data: issue, isLoading, error } = useQuery({
    queryKey: ['issue-detail', repo.tenantId, repo.id, number],
    queryFn: () => api.getIssue(repo.tenantId, repo.id, number),
  });

  const { data: comments } = useQuery({
    queryKey: ['issue-comments', repo.tenantId, repo.id, number],
    queryFn: () => api.listIssueComments(repo.tenantId, repo.id, number),
  });

  const commentMutation = useMutation({
    mutationFn: () => api.createIssueComment(repo.tenantId, repo.id, number, { body: commentBody.trim() }),
    onSuccess: () => {
      setCommentBody('');
      queryClient.invalidateQueries({ queryKey: ['issue-comments', repo.tenantId, repo.id, number] });
    },
  });

  const stateMutation = useMutation({
    mutationFn: (state: 'open' | 'closed') => api.updateIssue(repo.tenantId, repo.id, number, { state }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-detail', repo.tenantId, repo.id, number] });
      queryClient.invalidateQueries({ queryKey: ['repo-issues', repo.tenantId, repo.id] });
    },
  });

  if (isLoading) return <SkeletonRows rows={3} />;
  if (error) return <ErrorBanner error={error} tenantSlug={repo.owner} />;
  if (!issue) return null;

  return (
    <div className="space-y-5">
      <Link to={`/${repo.fullName}/issues`} className="text-xs text-[var(--brand-primary)] hover:underline">
        ← All issues
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold">
              #{issue.number} {issue.title}
            </h2>
            <StatusBadge status={issue.state} />
          </div>
          <div className="text-xs font-mono text-[var(--fg-muted)] mt-1">
            opened by @{issue.author.username} · {formatRelativeTime(issue.createdAt)}
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => stateMutation.mutate(issue.state === 'open' ? 'closed' : 'open')}
        >
          {issue.state === 'open' ? 'Close issue' : 'Reopen issue'}
        </Button>
      </div>

      {issue.body && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <MarkdownView content={issue.body} />
        </div>
      )}

      <div className="space-y-3">
        {(comments ?? []).map((c) => (
          <div key={c.id} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-2">
            <div className="text-xs font-mono text-[var(--fg-muted)]">
              @{c.author.username} · {formatRelativeTime(c.createdAt)}
            </div>
            <MarkdownView content={c.body} />
          </div>
        ))}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            commentMutation.mutate();
          }}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3"
        >
          <textarea
            rows={3}
            required
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Leave a comment (Markdown supported)"
            className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <Button type="submit" variant="primary" size="sm" disabled={!commentBody.trim()}>
            Comment
          </Button>
        </form>
      </div>
    </div>
  );
}

export function ReleasesTab({ repo }: { repo: RepositoryDto }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [tagName, setTagName] = useState('');
  const [releaseName, setReleaseName] = useState('');
  const [releaseBody, setReleaseBody] = useState('');
  const [newTagName, setNewTagName] = useState('');

  const { data: releasesPage, error } = useQuery({
    queryKey: ['repo-releases', repo.tenantId, repo.id],
    queryFn: () => api.listReleases(repo.tenantId, repo.id, { limit: 30 }),
  });

  const { data: tagsPage } = useQuery({
    queryKey: ['repo-tags', repo.tenantId, repo.id],
    queryFn: () => api.listTags(repo.tenantId, repo.id, { limit: 30 }),
  });

  const createTagMutation = useMutation({
    mutationFn: () => api.createTag(repo.tenantId, repo.id, { name: newTagName.trim(), target: repo.defaultBranch }),
    onSuccess: () => {
      setNewTagName('');
      queryClient.invalidateQueries({ queryKey: ['repo-tags', repo.tenantId, repo.id] });
    },
  });

  const createReleaseMutation = useMutation({
    mutationFn: () =>
      api.createRelease(repo.tenantId, repo.id, {
        tag: tagName.trim(),
        target: repo.defaultBranch,
        name: releaseName.trim() || undefined,
        body: releaseBody.trim() || undefined,
      }),
    onSuccess: () => {
      setTagName('');
      setReleaseName('');
      setReleaseBody('');
      queryClient.invalidateQueries({ queryKey: ['repo-releases', repo.tenantId, repo.id] });
      queryClient.invalidateQueries({ queryKey: ['repo-tags', repo.tenantId, repo.id] });
    },
  });

  const deleteReleaseMutation = useMutation({
    mutationFn: (id: number) => api.deleteRelease(repo.tenantId, repo.id, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repo-releases', repo.tenantId, repo.id] }),
  });

  const deleteTagMutation = useMutation({
    mutationFn: (name: string) => api.deleteTag(repo.tenantId, repo.id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repo-tags', repo.tenantId, repo.id] }),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        {(error || createReleaseMutation.error) && (
          <ErrorBanner error={error || createReleaseMutation.error} tenantSlug={repo.owner} />
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createReleaseMutation.mutate();
          }}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3"
        >
          <div className="text-xs font-semibold text-[var(--fg-default)]">Draft a new release</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="Tag version (e.g. v1.2.0)"
              className="px-3 py-1.5 text-sm font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
            <input
              type="text"
              value={releaseName}
              onChange={(e) => setReleaseName(e.target.value)}
              placeholder="Release title"
              className="px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
          </div>
          <textarea
            rows={3}
            value={releaseBody}
            onChange={(e) => setReleaseBody(e.target.value)}
            placeholder="Release notes (Markdown)"
            className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <Button type="submit" variant="primary" size="sm" disabled={!tagName.trim()}>
            Publish release
          </Button>
        </form>

        {(releasesPage?.items ?? []).length === 0 ? (
          <Blankslate
            icon={<Tag className="w-8 h-8" />}
            title="No releases published"
            description="Tag rule pack baselines to track validated detection bundles across environments."
          />
        ) : (
          <div className="space-y-3">
            {(releasesPage?.items ?? []).map((rel) => (
              <div key={rel.id} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-base">{rel.name || rel.tag}</span>
                    <span className="px-2 py-0.5 text-xs font-mono rounded bg-[var(--bg-subtle)] text-[var(--fg-default)]">
                      {rel.tag}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteReleaseMutation.mutate(rel.id)}
                    className="text-[var(--danger)]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {rel.body && <MarkdownView content={rel.body} />}
                <div className="text-xs text-[var(--fg-muted)] font-mono">
                  by @{rel.author.username} · {formatRelativeTime(rel.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-default)]">Git Tags</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createTagMutation.mutate();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              required
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="v1.0.1"
              className="flex-1 px-2.5 py-1 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
            <Button type="submit" variant="secondary" size="sm" disabled={!newTagName.trim()}>
              Tag
            </Button>
          </form>
          <div className="divide-y divide-[var(--border-muted)] text-xs font-mono">
            {(tagsPage?.items ?? []).map((t) => (
              <div key={t.name} className="py-2 flex items-center justify-between gap-2">
                <span>{t.name}</span>
                <button
                  type="button"
                  onClick={() => deleteTagMutation.mutate(t.name)}
                  className="text-[var(--danger)] hover:underline cursor-pointer"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WikiTab({ repo }: { repo: RepositoryDto }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState<'none' | 'create' | 'edit'>('none');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const { data: pages, isLoading, error } = useQuery({
    queryKey: ['wiki-pages', repo.tenantId, repo.id],
    queryFn: async () => {
      try {
        return await api.listWikiPages(repo.tenantId, repo.id);
      } catch (err) {
        if (err instanceof SepApiError && err.status === 404) return [];
        throw err;
      }
    },
  });

  const activeSlug = selectedSlug ?? pages?.[0]?.page ?? null;

  const { data: activePage } = useQuery({
    queryKey: ['wiki-page', repo.tenantId, repo.id, activeSlug],
    queryFn: () => api.getWikiPage(repo.tenantId, repo.id, activeSlug!),
    enabled: Boolean(activeSlug),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editingMode === 'edit' && activeSlug) {
        return api.updateWikiPage(repo.tenantId, repo.id, activeSlug, {
          title: title.trim() || undefined,
          content,
        });
      }
      return api.createWikiPage(repo.tenantId, repo.id, {
        title: title.trim(),
        content,
      });
    },
    onSuccess: (saved) => {
      setEditingMode('none');
      setSelectedSlug(saved.page);
      queryClient.invalidateQueries({ queryKey: ['wiki-pages', repo.tenantId, repo.id] });
      queryClient.invalidateQueries({ queryKey: ['wiki-page', repo.tenantId, repo.id, saved.page] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (page: string) => api.deleteWikiPage(repo.tenantId, repo.id, page),
    onSuccess: () => {
      setSelectedSlug(null);
      queryClient.invalidateQueries({ queryKey: ['wiki-pages', repo.tenantId, repo.id] });
    },
  });

  if (isLoading) return <SkeletonRows rows={3} />;
  if (error) return <ErrorBanner error={error} tenantSlug={repo.owner} />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-default)]">Wiki Pages</h3>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingMode('create');
              setTitle('');
              setContent('# Runbook\n\nDocument triage steps and false-positive exclusions.');
            }}
          >
            New page
          </Button>
        </div>

        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
          {(pages ?? []).length === 0 ? (
            <div className="p-3 text-xs text-[var(--fg-muted)]">No wiki pages yet.</div>
          ) : (
            (pages ?? []).map((p) => (
              <button
                key={p.page}
                type="button"
                onClick={() => {
                  setEditingMode('none');
                  setSelectedSlug(p.page);
                }}
                className={`w-full text-left px-3 py-2 text-xs font-medium cursor-pointer ${
                  activeSlug === p.page
                    ? 'bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)] font-semibold'
                    : 'hover:bg-[var(--bg-subtle)] text-[var(--fg-default)]'
                }`}
              >
                {p.title}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="lg:col-span-3">
        {editingMode !== 'none' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4"
          >
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title"
              className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
            <textarea
              rows={12}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditingMode('none')}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={saveMutation.isPending}>
                Save page
              </Button>
            </div>
          </form>
        ) : !activePage ? (
          <Blankslate
            icon={<BookOpen className="w-8 h-8" />}
            title="Document your detection playbooks"
            description="Create wiki pages for triage runbooks, telemetry onboarding guides, and false-positive playbooks."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingMode('create');
                  setTitle('Home');
                  setContent('# Detection Engineering Playbook\n\nWelcome to the repository wiki.');
                }}
              >
                Create first page
              </Button>
            }
          />
        ) : (
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border-muted)]">
              <h2 className="font-display text-lg font-bold">{activePage.title}</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTitle(activePage.title);
                    setContent(activePage.content);
                    setEditingMode('edit');
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(activePage.page)}
                  className="text-[var(--danger)]"
                >
                  Delete
                </Button>
              </div>
            </div>
            <MarkdownView content={activePage.content} />
          </div>
        )}
      </div>
    </div>
  );
}
