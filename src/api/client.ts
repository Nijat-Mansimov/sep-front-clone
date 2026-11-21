import type {
  ApiErrorBody,
  ApiErrorDetail,
  ApiKeyDto,
  AuditLogDto,
  BranchDto,
  BranchProtectionDto,
  CommentDto,
  CommitDto,
  ConnectorDto,
  ConnectorJobDto,
  ConversionCatalogDto,
  ConversionDto,
  CoverageMatrixDto,
  CreatedGitTokenDto,
  CreatedWorkspaceDto,
  CursorPage,
  DeploymentDto,
  DeploymentLogDto,
  DeploymentPolicyDto,
  EnrollmentTokenResponseDto,
  FieldMappingSetDto,
  GitTokenDto,
  IndexStatusDto,
  IntegrationDto,
  IntegrationEventDto,
  IntegrationProviderDto,
  IssueDto,
  LabelDto,
  MeDto,
  MemberDto,
  MilestoneDto,
  MitreTacticDto,
  MitreTechniqueDto,
  NotificationDto,
  OrganizationDto,
  PlanChangeResponseDto,
  PlanDto,
  PlatformGitInstanceDto,
  PullRequestDto,
  PullRequestFileDto,
  ReleaseDto,
  RepositoryDto,
  ReviewDto,
  RoleAssignmentDto,
  RoleDto,
  RuleDetailDto,
  RuleSearchItemDto,
  RuleSummaryDto,
  RuleVersionDto,
  ScimTokenDto,
  SecurityPolicyDto,
  ServiceAccountDto,
  SessionsResponseDto,
  SshKeyDto,
  SsoConnectionDto,
  StarStatusDto,
  SubscriptionOverviewDto,
  TagDto,
  TeamDto,
  TeamMemberDto,
  TenantDto,
  UsageResponseDto,
  ValidateQueryResponseDto,
  ValidateRuleResponseDto,
  ValidationReportDto,
  WatchStatusDto,
  WebhookDeliveryDto,
  WebhookDto,
  WikiPageDto,
  WikiPageSummaryDto,
} from './types';

export class SepApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly details?: ApiErrorDetail[];

  constructor(params: {
    status: number;
    code: string;
    message: string;
    requestId: string;
    details?: ApiErrorDetail[];
  }) {
    super(params.message);
    this.name = 'SepApiError';
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;
    this.details = params.details;
  }
}

export function buildQueryString(params: Record<string, string | number | boolean | string[] | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length > 0) sp.set(k, v.join(','));
    } else {
      sp.set(k, String(v));
    }
  }
  const str = sp.toString();
  return str ? `?${str}` : '';
}

export interface ApiClientConfig {
  baseUrl?: string;
  getToken: () => string | null;
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
}

export function createSepClient(config: ApiClientConfig) {
  const baseUrl = (config.baseUrl ?? import.meta.env?.VITE_API_BASE ?? '/api/v1').replace(/\/$/, '');
  const fetchFn = config.fetchImpl ?? fetch;

  async function request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      skipAuth?: boolean;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(options?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers ?? {}),
    };
    const token = options?.skipAuth ? null : config.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetchFn(`${baseUrl}${path}`, {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const headerReqId = res.headers.get('x-request-id') ?? '';

    if (res.status === 204) {
      return undefined as T;
    }

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (!res.ok) {
      const errBody = parsed as ApiErrorBody | null;
      const code = errBody?.error?.code ?? `HTTP_${res.status}`;
      const message = errBody?.error?.message ?? (res.statusText || 'Request failed');
      const requestId = errBody?.error?.requestId ?? headerReqId;
      const details = errBody?.error?.details;
      if (res.status === 401 && config.onUnauthorized) {
        config.onUnauthorized();
      }
      throw new SepApiError({ status: res.status, code, message, requestId, details });
    }

    return parsed as T;
  }

  return {
    // 5.1 Session, user, workspaces
    getMe: () => request<MeDto>('GET', '/users/me'),
    listSessions: () => request<SessionsResponseDto>('GET', '/users/me/sessions'),
    revokeAllSessions: () => request<{ revoked: boolean }>('POST', '/users/me/sessions/revoke'),
    listTenants: (q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<TenantDto>>('GET', `/tenants${buildQueryString(q ?? {})}`),
    getTenant: (tenantId: string) => request<TenantDto>('GET', `/tenants/${tenantId}`),
    updateTenant: (tenantId: string, body: { name: string }) =>
      request<TenantDto>('PATCH', `/tenants/${tenantId}`, { body }),
    createOrganization: (body: { slug: string; name: string; description?: string }) =>
      request<CreatedWorkspaceDto>('POST', '/organizations', { body }),
    listOrganizations: (tenantId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<OrganizationDto>>('GET', `/tenants/${tenantId}/organizations${buildQueryString(q ?? {})}`),
    getOrganization: (tenantId: string, orgId: string) =>
      request<OrganizationDto>('GET', `/tenants/${tenantId}/organizations/${orgId}`),
    updateOrganization: (tenantId: string, orgId: string, body: { name?: string; description?: string | null }) =>
      request<OrganizationDto>('PATCH', `/tenants/${tenantId}/organizations/${orgId}`, { body }),
    renameOrganization: (tenantId: string, orgId: string, body: { slug: string }) =>
      request<OrganizationDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/rename`, { body }),
    listMembers: (tenantId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<MemberDto>>('GET', `/tenants/${tenantId}/members${buildQueryString(q ?? {})}`),
    addMember: (tenantId: string, body: { username: string; roleKey?: string }) =>
      request<MemberDto>('POST', `/tenants/${tenantId}/members`, { body }),
    removeMember: (tenantId: string, userId: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/members/${userId}`),
    listTeams: (tenantId: string, orgId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<TeamDto>>('GET', `/tenants/${tenantId}/organizations/${orgId}/teams${buildQueryString(q ?? {})}`),
    createTeam: (tenantId: string, orgId: string, body: { slug: string; name: string; description?: string }) =>
      request<TeamDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/teams`, { body }),
    deleteTeam: (tenantId: string, orgId: string, teamId: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/organizations/${orgId}/teams/${teamId}`),
    listTeamMembers: (tenantId: string, orgId: string, teamId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<TeamMemberDto>>('GET', `/tenants/${tenantId}/organizations/${orgId}/teams/${teamId}/members${buildQueryString(q ?? {})}`),
    addTeamMember: (tenantId: string, orgId: string, teamId: string, body: { username: string }) =>
      request<TeamMemberDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/teams/${teamId}/members`, { body }),
    removeTeamMember: (tenantId: string, orgId: string, teamId: string, userId: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/organizations/${orgId}/teams/${teamId}/members/${userId}`),
    listRoles: () => request<RoleDto[]>('GET', '/roles'),
    listRoleAssignments: (tenantId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<RoleAssignmentDto>>('GET', `/tenants/${tenantId}/role-assignments${buildQueryString(q ?? {})}`),
    createRoleAssignment: (
      tenantId: string,
      body: { roleKey: string; principalType: 'user' | 'team'; principalId: string; scopeType: string; scopeId?: string },
    ) => request<RoleAssignmentDto>('POST', `/tenants/${tenantId}/role-assignments`, { body }),
    deleteRoleAssignment: (tenantId: string, assignmentId: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/role-assignments/${assignmentId}`),
    listAuditLogs: (tenantId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<AuditLogDto>>('GET', `/tenants/${tenantId}/audit-logs${buildQueryString(q ?? {})}`),
    listNotifications: (q?: { limit?: number; cursor?: string; all?: boolean }) =>
      request<CursorPage<NotificationDto>>('GET', `/users/me/notifications${buildQueryString(q ?? {})}`),
    markNotificationRead: (notificationId: number) =>
      request<void>('PATCH', `/users/me/notifications/${notificationId}`),
    markAllNotificationsRead: () =>
      request<void>('POST', '/users/me/notifications/mark-all-read'),

    // 5.2 Git credentials
    listGitTokens: () => request<GitTokenDto[]>('GET', '/users/me/git-tokens'),
    createGitToken: (body: { name: string; scopes: Array<'git:read' | 'git:write'>; expiresInDays?: number }) =>
      request<CreatedGitTokenDto>('POST', '/users/me/git-tokens', { body }),
    revokeGitToken: (tokenId: string) =>
      request<void>('DELETE', `/users/me/git-tokens/${tokenId}`),
    listSshKeys: () => request<SshKeyDto[]>('GET', '/users/me/ssh-keys'),
    addSshKey: (body: { title: string; publicKey: string }) =>
      request<SshKeyDto>('POST', '/users/me/ssh-keys', { body }),
    removeSshKey: (keyId: string) =>
      request<void>('DELETE', `/users/me/ssh-keys/${keyId}`),

    // 5.3 Repositories & collaboration
    listRepositories: (tenantId: string, orgId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<RepositoryDto>>('GET', `/tenants/${tenantId}/organizations/${orgId}/repositories${buildQueryString(q ?? {})}`),
    createRepository: (
      tenantId: string,
      orgId: string,
      body: { name: string; description?: string; visibility?: 'PRIVATE' | 'PUBLIC'; autoInit?: boolean; defaultBranch?: string },
    ) => request<RepositoryDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/repositories`, { body }),
    getRepositoryByPath: (owner: string, name: string) =>
      request<RepositoryDto>('GET', `/repositories/by-path/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`),
    getRepository: (tenantId: string, repoId: string) =>
      request<RepositoryDto>('GET', `/tenants/${tenantId}/repositories/${repoId}`),
    updateRepository: (
      tenantId: string,
      repoId: string,
      body: { name?: string; description?: string; visibility?: 'PRIVATE' | 'PUBLIC'; defaultBranch?: string },
    ) => request<RepositoryDto>('PATCH', `/tenants/${tenantId}/repositories/${repoId}`, { body }),
    deleteRepository: (tenantId: string, repoId: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/repositories/${repoId}`),
    archiveRepository: (tenantId: string, repoId: string) =>
      request<RepositoryDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/archive`),
    unarchiveRepository: (tenantId: string, repoId: string) =>
      request<RepositoryDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/unarchive`),
    forkRepository: (tenantId: string, repoId: string, body: { tenantId: string; organizationId: string; name?: string }) =>
      request<RepositoryDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/forks`, { body }),
    transferRepository: (tenantId: string, repoId: string, body: { tenantId: string; organizationId: string }) =>
      request<RepositoryDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/transfer`, { body }),
    listBranches: (tenantId: string, repoId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<BranchDto>>('GET', `/tenants/${tenantId}/repositories/${repoId}/branches${buildQueryString(q ?? {})}`),
    createBranch: (tenantId: string, repoId: string, body: { name: string; from: string }) =>
      request<BranchDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/branches`, { body }),
    deleteBranch: (tenantId: string, repoId: string, name: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/repositories/${repoId}/branches${buildQueryString({ name })}`),
    listCommits: (tenantId: string, repoId: string, q?: { limit?: number; cursor?: string; ref?: string }) =>
      request<CursorPage<CommitDto>>('GET', `/tenants/${tenantId}/repositories/${repoId}/commits${buildQueryString(q ?? {})}`),
    listBranchProtections: (tenantId: string, repoId: string) =>
      request<BranchProtectionDto[]>('GET', `/tenants/${tenantId}/repositories/${repoId}/branch-protections`),
    putBranchProtection: (tenantId: string, repoId: string, body: BranchProtectionDto) =>
      request<BranchProtectionDto>('PUT', `/tenants/${tenantId}/repositories/${repoId}/branch-protections`, { body }),
    deleteBranchProtection: (tenantId: string, repoId: string, pattern: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/repositories/${repoId}/branch-protections${buildQueryString({ pattern })}`),
    listPullRequests: (tenantId: string, repoId: string, q?: { limit?: number; cursor?: string; state?: 'open' | 'closed' | 'all' }) =>
      request<CursorPage<PullRequestDto>>('GET', `/tenants/${tenantId}/repositories/${repoId}/pulls${buildQueryString(q ?? {})}`),
    createPullRequest: (tenantId: string, repoId: string, body: { title: string; body?: string; head: string; base: string }) =>
      request<PullRequestDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/pulls`, { body }),
    getPullRequest: (tenantId: string, repoId: string, number: number) =>
      request<PullRequestDto>('GET', `/tenants/${tenantId}/repositories/${repoId}/pulls/${number}`),
    updatePullRequest: (tenantId: string, repoId: string, number: number, body: { title?: string; body?: string; state?: 'open' | 'closed' }) =>
      request<PullRequestDto>('PATCH', `/tenants/${tenantId}/repositories/${repoId}/pulls/${number}`, { body }),
    mergePullRequest: (tenantId: string, repoId: string, number: number, body: { method?: 'merge' | 'squash' | 'rebase'; message?: string }) =>
      request<PullRequestDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/pulls/${number}/merge`, { body }),
    listPullRequestFiles: (tenantId: string, repoId: string, number: number, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<PullRequestFileDto>>('GET', `/tenants/${tenantId}/repositories/${repoId}/pulls/${number}/files${buildQueryString(q ?? {})}`),
    listPullRequestReviews: (tenantId: string, repoId: string, number: number) =>
      request<ReviewDto[]>('GET', `/tenants/${tenantId}/repositories/${repoId}/pulls/${number}/reviews`),
    createPullRequestReview: (
      tenantId: string,
      repoId: string,
      number: number,
      body: {
        event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
        body?: string;
        comments?: Array<{ path: string; body: string; line?: number; oldLine?: number }>;
      },
    ) => request<ReviewDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/pulls/${number}/reviews`, { body }),
    listIssues: (tenantId: string, repoId: string, q?: { limit?: number; cursor?: string; state?: 'open' | 'closed' | 'all' }) =>
      request<CursorPage<IssueDto>>('GET', `/tenants/${tenantId}/repositories/${repoId}/issues${buildQueryString(q ?? {})}`),
    createIssue: (tenantId: string, repoId: string, body: { title: string; body?: string }) =>
      request<IssueDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/issues`, { body }),
    getIssue: (tenantId: string, repoId: string, number: number) =>
      request<IssueDto>('GET', `/tenants/${tenantId}/repositories/${repoId}/issues/${number}`),
    updateIssue: (tenantId: string, repoId: string, number: number, body: { title?: string; body?: string; state?: 'open' | 'closed' }) =>
      request<IssueDto>('PATCH', `/tenants/${tenantId}/repositories/${repoId}/issues/${number}`, { body }),
    listIssueComments: (tenantId: string, repoId: string, number: number) =>
      request<CommentDto[]>('GET', `/tenants/${tenantId}/repositories/${repoId}/issues/${number}/comments`),
    createIssueComment: (tenantId: string, repoId: string, number: number, body: { body: string }) =>
      request<CommentDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/issues/${number}/comments`, { body }),
    listLabels: (tenantId: string, repoId: string) =>
      request<LabelDto[]>('GET', `/tenants/${tenantId}/repositories/${repoId}/labels`),
    createLabel: (tenantId: string, repoId: string, body: { name: string; color: string; description?: string }) =>
      request<LabelDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/labels`, { body }),
    deleteLabel: (tenantId: string, repoId: string, labelId: number) =>
      request<void>('DELETE', `/tenants/${tenantId}/repositories/${repoId}/labels/${labelId}`),
    setIssueLabels: (tenantId: string, repoId: string, number: number, labelIds: number[]) =>
      request<LabelDto[]>('PUT', `/tenants/${tenantId}/repositories/${repoId}/issues/${number}/labels`, { body: { labelIds } }),
    listMilestones: (tenantId: string, repoId: string, state?: 'open' | 'closed' | 'all') =>
      request<MilestoneDto[]>('GET', `/tenants/${tenantId}/repositories/${repoId}/milestones${buildQueryString({ state })}`),
    createMilestone: (tenantId: string, repoId: string, body: { title: string; description?: string; dueOn?: string }) =>
      request<MilestoneDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/milestones`, { body }),
    setIssueMilestone: (tenantId: string, repoId: string, number: number, milestoneId: number | null) =>
      request<void>('PUT', `/tenants/${tenantId}/repositories/${repoId}/issues/${number}/milestone`, { body: { milestoneId } }),
    listTags: (tenantId: string, repoId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<TagDto>>('GET', `/tenants/${tenantId}/repositories/${repoId}/tags${buildQueryString(q ?? {})}`),
    createTag: (tenantId: string, repoId: string, body: { name: string; target: string; message?: string }) =>
      request<TagDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/tags`, { body }),
    deleteTag: (tenantId: string, repoId: string, name: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/repositories/${repoId}/tags${buildQueryString({ name })}`),
    listReleases: (tenantId: string, repoId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<ReleaseDto>>('GET', `/tenants/${tenantId}/repositories/${repoId}/releases${buildQueryString(q ?? {})}`),
    createRelease: (
      tenantId: string,
      repoId: string,
      body: { tag: string; target?: string; name?: string; body?: string; draft?: boolean; prerelease?: boolean },
    ) => request<ReleaseDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/releases`, { body }),
    deleteRelease: (tenantId: string, repoId: string, releaseId: number) =>
      request<void>('DELETE', `/tenants/${tenantId}/repositories/${repoId}/releases/${releaseId}`),
    listWikiPages: (tenantId: string, repoId: string) =>
      request<WikiPageSummaryDto[]>('GET', `/tenants/${tenantId}/repositories/${repoId}/wiki/pages`),
    getWikiPage: (tenantId: string, repoId: string, page: string) =>
      request<WikiPageDto>('GET', `/tenants/${tenantId}/repositories/${repoId}/wiki/page${buildQueryString({ page })}`),
    createWikiPage: (tenantId: string, repoId: string, body: { title: string; content: string; message?: string }) =>
      request<WikiPageDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/wiki/pages`, { body }),
    updateWikiPage: (tenantId: string, repoId: string, page: string, body: { title?: string; content: string; message?: string }) =>
      request<WikiPageDto>('PUT', `/tenants/${tenantId}/repositories/${repoId}/wiki/page${buildQueryString({ page })}`, { body }),
    deleteWikiPage: (tenantId: string, repoId: string, page: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/repositories/${repoId}/wiki/page${buildQueryString({ page })}`),
    getStarStatus: (tenantId: string, repoId: string) =>
      request<StarStatusDto>('GET', `/tenants/${tenantId}/repositories/${repoId}/star`),
    starRepo: (tenantId: string, repoId: string) =>
      request<StarStatusDto>('PUT', `/tenants/${tenantId}/repositories/${repoId}/star`),
    unstarRepo: (tenantId: string, repoId: string) =>
      request<StarStatusDto>('DELETE', `/tenants/${tenantId}/repositories/${repoId}/star`),
    listStargazers: (tenantId: string, repoId: string) =>
      request<CursorPage<{ id: string; username: string }>>('GET', `/tenants/${tenantId}/repositories/${repoId}/stargazers`),
    getWatchStatus: (tenantId: string, repoId: string) =>
      request<WatchStatusDto>('GET', `/tenants/${tenantId}/repositories/${repoId}/subscription`),
    watchRepo: (tenantId: string, repoId: string) =>
      request<WatchStatusDto>('PUT', `/tenants/${tenantId}/repositories/${repoId}/subscription`),
    unwatchRepo: (tenantId: string, repoId: string) =>
      request<WatchStatusDto>('DELETE', `/tenants/${tenantId}/repositories/${repoId}/subscription`),
    listWatchers: (tenantId: string, repoId: string) =>
      request<CursorPage<{ id: string; username: string }>>('GET', `/tenants/${tenantId}/repositories/${repoId}/watchers`),

    // 5.4 Detection rules, search, MITRE ATT&CK
    listRepoRules: (
      tenantId: string,
      repoId: string,
      q?: {
        limit?: number;
        cursor?: string;
        severity?: string[];
        status?: string[];
        validationStatus?: string;
        technique?: string;
        tactic?: string;
        language?: string;
        q?: string;
      },
    ) => request<CursorPage<RuleSummaryDto>>('GET', `/tenants/${tenantId}/repositories/${repoId}/rules${buildQueryString(q ?? {})}`),
    getRule: (tenantId: string, repoId: string, ruleId: string) =>
      request<RuleDetailDto>('GET', `/tenants/${tenantId}/repositories/${repoId}/rules/${ruleId}`),
    getRuleVersions: (tenantId: string, repoId: string, ruleId: string) =>
      request<RuleVersionDto[]>('GET', `/tenants/${tenantId}/repositories/${repoId}/rules/${ruleId}/versions`),
    getRuleIndexStatus: (tenantId: string, repoId: string) =>
      request<IndexStatusDto>('GET', `/tenants/${tenantId}/repositories/${repoId}/rules/index-status`),
    getRuleValidationReport: (tenantId: string, repoId: string, ref?: string) =>
      request<ValidationReportDto>('GET', `/tenants/${tenantId}/repositories/${repoId}/rules/validation${buildQueryString({ ref })}`),
    validateRuleYaml: (tenantId: string, repoId: string, content: string) =>
      request<ValidateRuleResponseDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/rules/validate`, { body: { content } }),
    reindexRules: (tenantId: string, repoId: string) =>
      request<IndexStatusDto>('POST', `/tenants/${tenantId}/repositories/${repoId}/rules/reindex`),
    searchTenantRules: (
      tenantId: string,
      q?: {
        limit?: number;
        cursor?: string;
        q?: string;
        severity?: string[];
        status?: string[];
        technique?: string;
        tactic?: string;
        language?: string;
        platform?: string;
        validationStatus?: string;
        repositoryId?: string;
      },
    ) => request<CursorPage<RuleSearchItemDto>>('GET', `/tenants/${tenantId}/rules/search${buildQueryString(q ?? {})}`),
    searchPublicRules: (q?: { limit?: number; cursor?: string; q?: string }) =>
      request<CursorPage<RuleSearchItemDto>>('GET', `/rules/search${buildQueryString(q ?? {})}`),
    getCoverageMatrix: (tenantId: string, repositoryId?: string) =>
      request<CoverageMatrixDto>('GET', `/tenants/${tenantId}/rules/coverage${buildQueryString({ repositoryId })}`),
    listMitreTactics: () => request<{ version: string; items: MitreTacticDto[] }>('GET', '/mitre/tactics'),
    listMitreTechniques: (q?: { limit?: number; cursor?: string; q?: string; tactic?: string }) =>
      request<CursorPage<MitreTechniqueDto>>('GET', `/mitre/techniques${buildQueryString(q ?? {})}`),

    // 5.5 Query conversion
    getConversionDialects: () => request<ConversionCatalogDto>('GET', '/conversions/dialects'),
    createConversion: (
      tenantId: string,
      orgId: string,
      body: {
        sourceDialect?: string;
        targetDialect: string;
        query?: string;
        rule?: { repositoryId: string; ruleId: string };
        mode?: string;
        fieldMappingSetId?: string;
        options?: { xqlCaseSensitive?: boolean };
      },
      idempotencyKey?: string,
    ) =>
      request<ConversionDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/conversions`, {
        body,
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      }),
    listConversions: (tenantId: string, orgId: string, q?: { limit?: number; cursor?: string; status?: string }) =>
      request<CursorPage<ConversionDto>>('GET', `/tenants/${tenantId}/organizations/${orgId}/conversions${buildQueryString(q ?? {})}`),
    getConversion: (tenantId: string, orgId: string, conversionId: string) =>
      request<ConversionDto>('GET', `/tenants/${tenantId}/organizations/${orgId}/conversions/${conversionId}`),
    validateQuerySyntax: (tenantId: string, orgId: string, body: { dialect: string; query: string; options?: { xqlCaseSensitive?: boolean } }) =>
      request<ValidateQueryResponseDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/conversions/validate-query`, { body }),
    listFieldMappings: (tenantId: string, orgId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<FieldMappingSetDto>>('GET', `/tenants/${tenantId}/organizations/${orgId}/field-mappings${buildQueryString(q ?? {})}`),
    createFieldMapping: (tenantId: string, orgId: string, body: Omit<FieldMappingSetDto, 'id' | 'organizationId' | 'version' | 'createdAt' | 'updatedAt'>) =>
      request<FieldMappingSetDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/field-mappings`, { body }),
    updateFieldMapping: (
      tenantId: string,
      orgId: string,
      mappingId: string,
      body: Omit<FieldMappingSetDto, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>,
    ) => request<FieldMappingSetDto>('PUT', `/tenants/${tenantId}/organizations/${orgId}/field-mappings/${mappingId}`, { body }),
    deleteFieldMapping: (tenantId: string, orgId: string, mappingId: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/organizations/${orgId}/field-mappings/${mappingId}`),

    // 5.6 Integrations, deployments, connectors, webhooks
    listProviders: () => request<{ items: IntegrationProviderDto[] }>('GET', '/integrations/providers'),
    listIntegrations: (tenantId: string, orgId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<IntegrationDto>>('GET', `/tenants/${tenantId}/organizations/${orgId}/integrations${buildQueryString(q ?? {})}`),
    createIntegration: (
      tenantId: string,
      orgId: string,
      body: {
        name: string;
        provider: string;
        environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
        executionMode: 'DIRECT' | 'CONNECTOR';
        connectorId?: string;
        config: Record<string, unknown>;
      },
    ) => request<IntegrationDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/integrations`, { body }),
    getIntegration: (tenantId: string, orgId: string, integrationId: string) =>
      request<IntegrationDto>('GET', `/tenants/${tenantId}/organizations/${orgId}/integrations/${integrationId}`),
    updateIntegration: (
      tenantId: string,
      orgId: string,
      integrationId: string,
      body: { version: number; name?: string; config?: Record<string, unknown>; status?: 'ACTIVE' | 'DISABLED' },
    ) => request<IntegrationDto>('PATCH', `/tenants/${tenantId}/organizations/${orgId}/integrations/${integrationId}`, { body }),
    deleteIntegration: (tenantId: string, orgId: string, integrationId: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/organizations/${orgId}/integrations/${integrationId}`),
    setIntegrationCredential: (tenantId: string, orgId: string, integrationId: string, body: { kind: string; secret: string }) =>
      request<IntegrationDto>('PUT', `/tenants/${tenantId}/organizations/${orgId}/integrations/${integrationId}/credential`, { body }),
    deleteIntegrationCredential: (tenantId: string, orgId: string, integrationId: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/organizations/${orgId}/integrations/${integrationId}/credential`),
    healthCheckIntegration: (tenantId: string, orgId: string, integrationId: string) =>
      request<{ integrationId: string; queued: boolean; connectorJobId: string | null }>(
        'POST',
        `/tenants/${tenantId}/organizations/${orgId}/integrations/${integrationId}/health-check`,
      ),
    listIntegrationEvents: (tenantId: string, orgId: string, integrationId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<IntegrationEventDto>>('GET', `/tenants/${tenantId}/organizations/${orgId}/integrations/${integrationId}/events${buildQueryString(q ?? {})}`),

    getDeploymentPolicy: (tenantId: string, orgId: string) =>
      request<DeploymentPolicyDto>('GET', `/tenants/${tenantId}/organizations/${orgId}/deployment-policy`),
    upsertDeploymentPolicy: (
      tenantId: string,
      orgId: string,
      body: {
        version?: number;
        productionApprovals: number;
        nonProductionApprovals: number;
        allowSelfApprovalNonProduction?: boolean;
        allowWarningRules?: boolean;
        deploymentsEnabled?: boolean;
      },
    ) => request<DeploymentPolicyDto>('PUT', `/tenants/${tenantId}/organizations/${orgId}/deployment-policy`, { body }),

    listDeployments: (tenantId: string, orgId: string, q?: { limit?: number; cursor?: string; status?: string; integrationId?: string }) =>
      request<CursorPage<DeploymentDto>>('GET', `/tenants/${tenantId}/organizations/${orgId}/deployments${buildQueryString(q ?? {})}`),
    createDeployment: (
      tenantId: string,
      orgId: string,
      body: { integrationId: string; repositoryId: string; ruleId: string; action?: 'DEPLOY' | 'UNDEPLOY' },
      idempotencyKey?: string,
    ) =>
      request<DeploymentDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/deployments`, {
        body,
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      }),
    getDeployment: (tenantId: string, orgId: string, deploymentId: string) =>
      request<DeploymentDto>('GET', `/tenants/${tenantId}/organizations/${orgId}/deployments/${deploymentId}`),
    listDeploymentLogs: (tenantId: string, orgId: string, deploymentId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<DeploymentLogDto>>('GET', `/tenants/${tenantId}/organizations/${orgId}/deployments/${deploymentId}/logs${buildQueryString(q ?? {})}`),
    approveDeployment: (tenantId: string, orgId: string, deploymentId: string, comment?: string) =>
      request<DeploymentDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/deployments/${deploymentId}/approve`, {
        body: { comment },
      }),
    rejectDeployment: (tenantId: string, orgId: string, deploymentId: string, comment?: string) =>
      request<DeploymentDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/deployments/${deploymentId}/reject`, {
        body: { comment },
      }),
    cancelDeployment: (tenantId: string, orgId: string, deploymentId: string) =>
      request<DeploymentDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/deployments/${deploymentId}/cancel`),
    rollbackDeployment: (tenantId: string, orgId: string, deploymentId: string) =>
      request<DeploymentDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/deployments/${deploymentId}/rollback`),

    listConnectors: (tenantId: string, orgId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<ConnectorDto>>('GET', `/tenants/${tenantId}/organizations/${orgId}/connectors${buildQueryString(q ?? {})}`),
    createConnector: (tenantId: string, orgId: string, body: { name: string; description?: string }) =>
      request<ConnectorDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/connectors`, { body }),
    getConnector: (tenantId: string, orgId: string, connectorId: string) =>
      request<ConnectorDto>('GET', `/tenants/${tenantId}/organizations/${orgId}/connectors/${connectorId}`),
    deleteConnector: (tenantId: string, orgId: string, connectorId: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/organizations/${orgId}/connectors/${connectorId}`),
    createEnrollmentToken: (tenantId: string, orgId: string, connectorId: string, ttlMinutes?: number) =>
      request<EnrollmentTokenResponseDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/connectors/${connectorId}/enrollment-tokens`, {
        body: ttlMinutes ? { ttlMinutes } : {},
      }),
    revokeConnectorInstance: (tenantId: string, orgId: string, connectorId: string, instanceId: string) =>
      request<void>('POST', `/tenants/${tenantId}/organizations/${orgId}/connectors/${connectorId}/instances/${instanceId}/revoke`),
    listConnectorJobs: (tenantId: string, orgId: string, connectorId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<ConnectorJobDto>>('GET', `/tenants/${tenantId}/organizations/${orgId}/connectors/${connectorId}/jobs${buildQueryString(q ?? {})}`),

    listWebhooks: (tenantId: string, orgId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<WebhookDto>>('GET', `/tenants/${tenantId}/organizations/${orgId}/webhooks${buildQueryString(q ?? {})}`),
    createWebhook: (tenantId: string, orgId: string, body: { url: string; description?: string; events: string[] }) =>
      request<WebhookDto>('POST', `/tenants/${tenantId}/organizations/${orgId}/webhooks`, { body }),
    updateWebhook: (
      tenantId: string,
      orgId: string,
      webhookId: string,
      body: { version: number; url?: string; description?: string; events?: string[]; status?: 'ACTIVE' | 'DISABLED' },
    ) => request<WebhookDto>('PATCH', `/tenants/${tenantId}/organizations/${orgId}/webhooks/${webhookId}`, { body }),
    deleteWebhook: (tenantId: string, orgId: string, webhookId: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/organizations/${orgId}/webhooks/${webhookId}`),
    rotateWebhookSecret: (tenantId: string, orgId: string, webhookId: string) =>
      request<{ secret: string }>('POST', `/tenants/${tenantId}/organizations/${orgId}/webhooks/${webhookId}/rotate-secret`),
    pingWebhook: (tenantId: string, orgId: string, webhookId: string) =>
      request<{ eventId: string }>('POST', `/tenants/${tenantId}/organizations/${orgId}/webhooks/${webhookId}/ping`),
    listWebhookDeliveries: (tenantId: string, orgId: string, webhookId: string, q?: { limit?: number; cursor?: string }) =>
      request<CursorPage<WebhookDeliveryDto>>('GET', `/tenants/${tenantId}/organizations/${orgId}/webhooks/${webhookId}/deliveries${buildQueryString(q ?? {})}`),

    // 5.7 Enterprise identity & access
    listServiceAccounts: (tenantId: string) =>
      request<{ items: ServiceAccountDto[] }>('GET', `/tenants/${tenantId}/service-accounts`),
    createServiceAccount: (tenantId: string, body: { name: string; description?: string }) =>
      request<ServiceAccountDto>('POST', `/tenants/${tenantId}/service-accounts`, { body }),
    deleteServiceAccount: (tenantId: string, saId: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/service-accounts/${saId}`),
    listApiKeys: (tenantId: string, saId: string) =>
      request<{ items: ApiKeyDto[] }>('GET', `/tenants/${tenantId}/service-accounts/${saId}/api-keys`),
    createApiKey: (tenantId: string, saId: string, body: { name: string; expiresInDays?: number }) =>
      request<ApiKeyDto>('POST', `/tenants/${tenantId}/service-accounts/${saId}/api-keys`, { body }),
    rotateApiKey: (tenantId: string, saId: string, keyId: string, graceHours = 24) =>
      request<ApiKeyDto>('POST', `/tenants/${tenantId}/service-accounts/${saId}/api-keys/${keyId}/rotate`, { body: { graceHours } }),
    revokeApiKey: (tenantId: string, saId: string, keyId: string) =>
      request<void>('POST', `/tenants/${tenantId}/service-accounts/${saId}/api-keys/${keyId}/revoke`),

    getSsoConnection: (tenantId: string) =>
      request<SsoConnectionDto>('GET', `/tenants/${tenantId}/sso-connection`),
    putSsoConnection: (tenantId: string, body: SsoConnectionDto) =>
      request<SsoConnectionDto>('PUT', `/tenants/${tenantId}/sso-connection`, { body }),
    deleteSsoConnection: (tenantId: string) =>
      request<void>('DELETE', `/tenants/${tenantId}/sso-connection`),

    getSecurityPolicy: (tenantId: string) =>
      request<SecurityPolicyDto>('GET', `/tenants/${tenantId}/security-policy`),
    putSecurityPolicy: (tenantId: string, body: { requireMfa: boolean; acceptedAcr?: string[] }) =>
      request<SecurityPolicyDto>('PUT', `/tenants/${tenantId}/security-policy`, { body }),

    listScimTokens: (tenantId: string) =>
      request<{ items: ScimTokenDto[] }>('GET', `/tenants/${tenantId}/scim-tokens`),
    createScimToken: (tenantId: string, body: { name: string; expiresInDays?: number }) =>
      request<ScimTokenDto>('POST', `/tenants/${tenantId}/scim-tokens`, { body }),
    revokeScimToken: (tenantId: string, tokenId: string) =>
      request<void>('POST', `/tenants/${tenantId}/scim-tokens/${tokenId}/revoke`),

    // 5.8 Plans, subscription, usage
    listPlans: () => request<{ items: PlanDto[] }>('GET', '/plans'),
    getSubscription: (tenantId: string) =>
      request<SubscriptionOverviewDto>('GET', `/tenants/${tenantId}/subscription`),
    getUsage: (tenantId: string) =>
      request<UsageResponseDto>('GET', `/tenants/${tenantId}/usage`),
    changePlan: (tenantId: string, planKey: string) =>
      request<PlanChangeResponseDto>('POST', `/tenants/${tenantId}/subscription/plan-change`, { body: { planKey } }),
    cancelSubscription: (tenantId: string) =>
      request<SubscriptionOverviewDto>('POST', `/tenants/${tenantId}/subscription/cancel`),
    resumeSubscription: (tenantId: string) =>
      request<SubscriptionOverviewDto>('POST', `/tenants/${tenantId}/subscription/resume`),

    // 5.9 Platform operator console
    listPlatformPlans: () => request<{ items: PlanDto[] }>('GET', '/platform/plans'),
    setPlatformPlanEntitlements: (planKey: string, entitlements: Record<string, number>) =>
      request<PlanDto>('PUT', `/platform/plans/${planKey}/entitlements`, { body: { entitlements } }),
    lookupPlatformTenant: (slug: string) =>
      request<TenantDto>('GET', `/platform/tenants${buildQueryString({ slug })}`),
    getPlatformTenantSubscription: (tenantId: string) =>
      request<SubscriptionOverviewDto>('GET', `/platform/tenants/${tenantId}/subscription`),
    setPlatformTenantSubscription: (
      tenantId: string,
      body: { planKey: string; periodDays?: number; providerSubscriptionRef?: string; status?: 'ACTIVE' | 'PAST_DUE' },
    ) => request<SubscriptionOverviewDto>('POST', `/platform/tenants/${tenantId}/subscription`, { body }),
    setPlatformOverride: (tenantId: string, featureKey: string, body: { value: number; reason: string; contractRef?: string; expiresAt?: string }) =>
      request<Record<string, unknown>>('PUT', `/platform/tenants/${tenantId}/entitlement-overrides/${featureKey}`, { body }),
    deletePlatformOverride: (tenantId: string, featureKey: string) =>
      request<void>('DELETE', `/platform/tenants/${tenantId}/entitlement-overrides/${featureKey}`),
    listPlatformGitInstances: () =>
      request<{ items: PlatformGitInstanceDto[] }>('GET', '/platform/git-instances'),
    registerPlatformGitInstance: (body: PlatformGitInstanceDto & { adminToken?: string; adminPassword?: string }) =>
      request<PlatformGitInstanceDto>('POST', '/platform/git-instances', { body }),
    assignPlatformTenantGitInstance: (tenantId: string, instanceName: string) =>
      request<Record<string, unknown>>('PUT', `/platform/tenants/${tenantId}/git-instance`, { body: { instanceName } }),
  };
}

export type SepClient = ReturnType<typeof createSepClient>;
