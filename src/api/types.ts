export type TenantKind = 'INDIVIDUAL' | 'TEAM' | 'ENTERPRISE';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED';
export type RoleScope = 'TENANT' | 'ORGANIZATION' | 'TEAM' | 'REPOSITORY';
export type PrincipalType = 'user' | 'team';
export type RepositoryVisibility = 'PRIVATE' | 'PUBLIC';
export type RepositoryStatus = 'ACTIVE' | 'ARCHIVED';
export type PullRequestState = 'open' | 'closed' | 'merged';
export type IssueState = 'open' | 'closed';
export type ReviewState = 'APPROVED' | 'REQUEST_CHANGES' | 'COMMENT' | 'PENDING';
export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
export type RuleFormat = 'SEP_DETECTION_V1' | 'SIGMA';
export type RuleSeverity = 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RuleStatus = 'EXPERIMENTAL' | 'TEST' | 'STABLE' | 'DEPRECATED';
export type ValidationStatus = 'VALID' | 'WARNING' | 'INVALID';
export type RuleDeploymentStatus = 'NOT_DEPLOYED' | 'PENDING' | 'DEPLOYED' | 'FAILED';
export type IndexStatusValue = 'NEVER' | 'INDEXING' | 'INDEXED' | 'PARTIAL' | 'FAILED';
export type ConversionStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'SUCCEEDED_WITH_WARNINGS' | 'FAILED';
export type IntegrationEnvironment = 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
export type ExecutionMode = 'DIRECT' | 'CONNECTOR';
export type IntegrationStatus = 'ACTIVE' | 'DISABLED';
export type IntegrationHealth = 'UNKNOWN' | 'HEALTHY' | 'UNHEALTHY';
export type ConnectorStatus = 'ACTIVE' | 'DISABLED';
export type ConnectorHealth = 'PENDING' | 'ONLINE' | 'DEGRADED' | 'OFFLINE';
export type DeploymentAction = 'DEPLOY' | 'UNDEPLOY' | 'ROLLBACK';
export type DeploymentStatus =
  | 'PENDING_APPROVAL'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  | 'CANCELLED';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: ApiErrorDetail[];
  };
}

export interface TenantDto {
  id: string;
  slug: string;
  name: string;
  kind: TenantKind;
  status: TenantStatus;
  createdAt: string;
}

export interface OrganizationDto {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface CreatedWorkspaceDto {
  tenant: TenantDto;
  organization: OrganizationDto;
}

export interface MembershipDto {
  tenant: TenantDto;
  roles: string[];
}

export interface MeDto {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  memberships: MembershipDto[];
}

export interface UserSummaryDto {
  id: string;
  username: string;
  displayName: string | null;
}

export interface UserRefDto {
  id: string | null;
  username: string;
}

export interface RoleDto {
  key: string;
  name: string;
  description: string;
  scope: RoleScope;
  permissions: string[];
}

export interface RoleAssignmentDto {
  id: string;
  roleKey: string;
  scope: RoleScope;
  principalType: PrincipalType;
  principalId: string;
  organizationId: string | null;
  teamId: string | null;
  repositoryId: string | null;
  createdAt: string;
}

export interface MemberDto {
  user: UserSummaryDto;
  status: 'ACTIVE' | 'SUSPENDED';
  roles: RoleAssignmentDto[];
  joinedAt: string;
}

export interface TeamDto {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface TeamMemberDto {
  user: UserSummaryDto;
  addedAt: string;
}

export interface SessionDto {
  id: string;
  ipAddress: string;
  startedAt: string;
  lastAccessAt: string;
}

export interface SessionsResponseDto {
  items: SessionDto[];
  source: string;
}

export interface NotificationDto {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  link?: string | null;
  createdAt: string;
}

export interface GitTokenDto {
  id: string;
  name: string;
  displayPrefix: string;
  scopes: Array<'git:read' | 'git:write'>;
  expiresAt: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreatedGitTokenDto extends GitTokenDto {
  token: string;
}

export interface SshKeyDto {
  id: string;
  title: string;
  fingerprint: string;
  createdAt: string;
}

export interface RepositoryDto {
  id: string;
  tenantId: string;
  organizationId: string;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  visibility: RepositoryVisibility;
  status: RepositoryStatus;
  defaultBranch: string;
  forkedFromId: string | null;
  cloneUrls: {
    https: string;
    ssh: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BranchDto {
  name: string;
  protected: boolean;
  commitSha: string;
  commitMessage: string;
}

export interface CommitDto {
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  author: UserRefDto | null;
  parents: string[];
}

export interface BranchProtectionDto {
  pattern: string;
  requiredApprovals: number;
  allowDirectPush: boolean;
  blockOnRejectedReviews: boolean;
  dismissStaleApprovals: boolean;
}

export interface PullRequestDto {
  number: number;
  title: string;
  body: string;
  state: PullRequestState;
  author: UserRefDto;
  head: string;
  headSha: string;
  base: string;
  mergeable: boolean;
  mergeCommitSha: string | null;
  mergedBy: UserRefDto | null;
  mergedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestFileDto {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  previousPath: string | null;
}

export interface ReviewCommentDto {
  id: number;
  path: string;
  body: string;
  line: number | null;
  author: UserRefDto;
}

export interface ReviewDto {
  id: number;
  state: ReviewState;
  body: string;
  author: UserRefDto;
  commitSha: string;
  stale: boolean;
  submittedAt: string;
  comments: ReviewCommentDto[];
}

export interface IssueDto {
  number: number;
  title: string;
  body: string;
  state: IssueState;
  author: UserRefDto;
  comments: number;
  labels?: LabelDto[];
  milestone?: MilestoneDto | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface CommentDto {
  id: number;
  body: string;
  author: UserRefDto;
  createdAt: string;
}

export interface LabelDto {
  id: number;
  name: string;
  color: string;
  description: string;
}

export interface MilestoneDto {
  id: number;
  title: string;
  description: string;
  state: IssueState;
  openIssues: number;
  closedIssues: number;
  dueOn: string | null;
}

export interface TagDto {
  name: string;
  commitSha: string;
  message: string;
}

export interface ReleaseDto {
  id: number;
  tag: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  author: UserRefDto;
  createdAt: string;
  publishedAt: string | null;
}

export interface WikiPageSummaryDto {
  page: string;
  title: string;
  lastCommitSha: string | null;
  updatedAt: string | null;
}

export interface WikiPageDto extends WikiPageSummaryDto {
  content: string;
}

export interface StarStatusDto {
  starred: boolean;
}

export interface WatchStatusDto {
  watching: boolean;
}

export interface ValidationIssueDto {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  field?: string;
}

export interface RuleSummaryDto {
  id: string;
  ruleUid: string;
  name: string;
  format: RuleFormat;
  severity: RuleSeverity | null;
  status: RuleStatus | null;
  queryLanguage: string;
  dialect: string | null;
  path: string;
  validationStatus: ValidationStatus;
  deploymentStatus: RuleDeploymentStatus;
  tactics: string[];
  techniques: string[];
  currentCommitSha: string | null;
  updatedAt: string;
}

export interface RuleDetailDto extends RuleSummaryDto {
  description: string | null;
  author: string | null;
  category: string | null;
  queryText: string;
  platforms: string[];
  telemetry: string[];
  dataSources: string[];
  tags: string[];
  falsePositives: string[];
  references: string[];
  validationIssues: ValidationIssueDto[];
  repository: {
    id: string;
    fullName: string;
  };
}

export interface RuleVersionDto {
  id: string;
  commitSha: string;
  path: string;
  validationStatus: ValidationStatus;
  validationIssues: ValidationIssueDto[];
  document: Record<string, unknown>;
  createdAt: string;
}

export interface IndexStatusDto {
  status: IndexStatusValue;
  commitSha: string | null;
  indexedAt: string | null;
  report: {
    rules: number;
    changed: number;
    deleted: number;
    commitSha: string;
    truncated: boolean;
    candidates: number;
    duplicates: unknown[];
    invalidFiles: Array<{ path: string; issues: ValidationIssueDto[] }>;
  } | null;
}

export interface ValidationReportDto {
  commitSha: string;
  truncated: boolean;
  summary: {
    files: number;
    valid: number;
    warning: number;
    invalid: number;
  };
  files: Array<{
    path: string;
    ruleUid: string | null;
    name: string | null;
    validationStatus: ValidationStatus;
    issues: ValidationIssueDto[];
  }>;
}

export interface ValidateRuleResponseDto {
  kind: string;
  validationStatus: ValidationStatus;
  issues: ValidationIssueDto[];
  rule: Record<string, unknown> | null;
}

export interface RuleSearchItemDto {
  id: string;
  ruleUid: string;
  name: string;
  severity: RuleSeverity | null;
  status: RuleStatus | null;
  queryLanguage: string;
  path: string;
  tactics: string[];
  techniques: string[];
  validationStatus: ValidationStatus;
  repository: {
    id: string;
    tenantId: string;
    fullName: string;
    visibility: RepositoryVisibility;
  };
}

export interface MitreTacticDto {
  id: string;
  shortName: string;
  name: string;
}

export interface MitreTechniqueDto {
  id: string;
  name: string;
  parentId: string | null;
  tactics: string[];
  platforms: string[];
}

export interface CoverageTechniqueDto {
  id: string;
  name: string;
  rules: number;
  subTechniqueRules: number;
}

export interface CoverageTacticDto {
  id: string;
  shortName: string;
  name: string;
  covered: number;
  total: number;
  techniques: CoverageTechniqueDto[];
}

export interface CoverageMatrixDto {
  catalogVersion: string;
  totalRules: number;
  tactics: CoverageTacticDto[];
}

export interface ConversionDialectDto {
  id: string;
  name: string;
  language: string;
  aliases: string[];
  source: boolean;
  target: boolean;
}

export interface ConversionCatalogDto {
  dialects: ConversionDialectDto[];
  modes: string[];
}

export interface ConversionFieldMappingResultDto {
  status: string;
  sourceField: string;
  targetField: string | null;
  canonicalField: string | null;
}

export interface ConversionResultDto {
  status: ConversionStatus;
  method: string;
  query: string | null;
  warnings: Array<{ code?: string; message: string; severity?: string } | string>;
  unsupported: Array<{ construct?: string; message: string } | string>;
  fieldMappings: ConversionFieldMappingResultDto[];
  semanticDifferences: Array<string | { message: string }>;
  validation: {
    diagnostics: Array<{ message: string; severity?: string }>;
    targetSyntaxValid: boolean | null;
    roundTripEquivalent: boolean | null;
  };
  reviewRequired: boolean;
  error: {
    code: string;
    message: string;
    severity: string;
  } | null;
  logicalSource: string | null;
  ai: Record<string, unknown> | null;
  engineVersion: string;
  profile: {
    name: string;
    version: string;
  };
  createdAt: string;
}

export interface ConversionDto {
  id: string;
  organizationId: string;
  sourceDialect: string;
  targetDialect: string;
  mode: string;
  status: ConversionStatus;
  source: {
    type: 'query' | 'rule';
    repositoryId?: string;
    ruleId?: string;
  };
  sourceQuery: string;
  fieldMappingSetId: string | null;
  options: {
    xqlCaseSensitive: boolean | null;
  };
  errorCode: string | null;
  createdByUserId: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  result: ConversionResultDto | null;
}

export interface ValidateQueryResponseDto {
  dialect: string;
  valid: boolean;
  diagnostics: Array<{ message: string; severity?: string; line?: number; column?: number }>;
}

export interface FieldEntryDto {
  dialect: string;
  source: string;
  canonical: string;
  native: string;
}

export interface SourceEntryDto {
  dialect: string;
  source: string;
  container?: {
    kind: 'dataset' | 'preset' | 'table' | null;
    name: string;
  };
  predicates: Array<{
    field: string;
    value: string;
    kind?: 'string' | 'enum' | 'number';
  }>;
}

export interface FieldMappingSetDto {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  fields: FieldEntryDto[];
  sources: SourceEntryDto[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface JsonSchemaProperty {
  type?: string;
  default?: unknown;
  pattern?: string;
  maxLength?: number;
  format?: string;
  enum?: string[];
  description?: string;
}

export interface ProviderConfigSchema {
  $schema?: string;
  type: string;
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface IntegrationProviderDto {
  key: string;
  name: string;
  vendor: string;
  capabilities: string[];
  dialects: string[];
  credentialKinds: Array<{ kind: string; description: string }>;
  executionModes: ExecutionMode[];
  configSchema: ProviderConfigSchema;
  notes: string[];
}

export interface IntegrationDto {
  id: string;
  organizationId: string;
  name: string;
  provider: string;
  environment: IntegrationEnvironment;
  executionMode: ExecutionMode;
  connectorId: string | null;
  config: Record<string, unknown>;
  status: IntegrationStatus;
  health: IntegrationHealth | string;
  healthCheckedAt: string | null;
  capabilities: string[];
  credential: {
    kind: string;
    rotatedAt: string;
  } | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationEventDto {
  id: string;
  type: string;
  actorUserId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface DeploymentPolicyDto {
  id: string;
  organizationId: string;
  productionApprovals: number;
  nonProductionApprovals: number;
  allowSelfApprovalNonProduction: boolean;
  allowWarningRules: boolean;
  deploymentsEnabled: boolean;
  version: number;
  updatedByUserId: string;
  updatedAt: string;
}

export interface DeploymentApprovalDto {
  userId: string;
  username?: string;
  decision: 'APPROVE' | 'REJECT';
  comment: string | null;
  createdAt: string;
}

export interface DeploymentDto {
  id: string;
  organizationId: string;
  integrationId: string;
  action: DeploymentAction;
  operation: string;
  status: DeploymentStatus;
  environment: IntegrationEnvironment;
  executionMode: ExecutionMode;
  rule: {
    repositoryId: string;
    ruleId: string;
    uid: string;
    name: string;
    severity: RuleSeverity | null;
    commitSha: string;
    blobSha: string;
    dialect: string;
    query: string;
  };
  rollbackOfId: string | null;
  requiredApprovals: number;
  allowSelfApproval: boolean;
  approvals: DeploymentApprovalDto[];
  requestedByUserId: string;
  externalId: string | null;
  errorCode: string | null;
  attempts: number;
  createdAt: string;
  approvedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface DeploymentLogDto {
  id: string;
  level: string;
  event: string;
  message: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface ConnectorInstanceDto {
  id: string;
  hostname?: string;
  version?: string;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface ConnectorDto {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: ConnectorStatus;
  health: ConnectorHealth;
  lastSeenAt: string | null;
  healthChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
  instances?: ConnectorInstanceDto[];
}

export interface EnrollmentTokenResponseDto {
  id: string;
  token: string;
  displayPrefix: string;
  expiresAt: string;
  gatewayUrl: string;
}

export interface ConnectorJobDto {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export interface WebhookDto {
  id: string;
  organizationId: string;
  url: string;
  description: string | null;
  events: string[];
  status: 'ACTIVE' | 'DISABLED';
  disabledReason: string | null;
  consecutiveFailures: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  secret?: string;
}

export interface WebhookDeliveryDto {
  id: string;
  eventId: string;
  eventType: string;
  status: string;
  attempts: number;
  responseStatus: number | null;
  errorCode: string | null;
  createdAt: string;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
}

export interface ServiceAccountDto {
  id: string;
  userId: string;
  username: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyDto {
  id: string;
  name: string;
  displayPrefix: string;
  status: 'ACTIVE' | 'REVOKED' | 'ROTATING';
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  rotatedFromId: string | null;
  createdAt: string;
  key?: string;
}

export interface SsoConnectionDto {
  displayName: string;
  idpEntityId: string;
  ssoUrl: string;
  signingCertificate: string;
  nameIdFormat?: string;
  allowedDomains?: string[];
  enforced: boolean;
  ownerBypass: boolean;
}

export interface SecurityPolicyDto {
  requireMfa: boolean;
  acceptedAcr: string[];
  version: number;
}

export interface ScimTokenDto {
  id: string;
  name: string;
  displayPrefix: string;
  status: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  token?: string;
}

export interface AuditLogDto {
  id: string;
  action: string;
  actorUserId: string | null;
  targetType: string;
  targetId: string;
  requestId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PlanDto {
  key: string;
  name: string;
  description: string;
  trialDays: number;
  priceMonthlyCents: number;
  currency: string;
  entitlements: Record<string, number>;
}

export interface SubscriptionOverviewDto {
  subscription: {
    id: string;
    plan: { key: string; name: string };
    status: SubscriptionStatus;
    provider: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    pastDueSince: string | null;
    cancelAtPeriodEnd: boolean;
    requestedPlan: string | null;
    version: number;
  };
  effectivePlan: {
    key: string;
    name: string;
    fallback: boolean;
  };
  entitlements: Record<string, number>;
  overrides: Record<string, { value: number; reason: string; expiresAt?: string }>;
  provider: string;
}

export interface UsageItemDto {
  key: string;
  description: string;
  unit: string;
  limit: number;
  used: number;
}

export interface UsageResponseDto {
  periodStart: string;
  items: UsageItemDto[];
}

export interface PlanChangeResponseDto {
  status: string;
  checkoutUrl?: string;
  requestedPlan?: string;
}

export interface PlatformGitInstanceDto {
  name: string;
  baseUrl: string;
  sshHost?: string;
  sshPort?: number;
  adminUsername: string;
  createdAt?: string;
}
