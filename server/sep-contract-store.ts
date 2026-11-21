import crypto from 'node:crypto';
import express from 'express';
import YAML from 'yaml';

interface ApiErrOptions {
  status: number;
  code: string;
  message: string;
  details?: Array<{ field?: string; message: string }>;
}

function makeUuid(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function paginate<T>(items: T[], limitParam?: unknown, cursorParam?: unknown): { items: T[]; nextCursor: string | null } {
  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);
  let offset = 0;
  if (typeof cursorParam === 'string' && cursorParam) {
    try {
      const decoded = JSON.parse(Buffer.from(cursorParam, 'base64').toString('utf8')) as { o?: number };
      if (typeof decoded.o === 'number') offset = decoded.o;
    } catch {
      offset = 0;
    }
  }
  const slice = items.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const nextCursor = nextOffset < items.length
    ? Buffer.from(JSON.stringify({ o: nextOffset }), 'utf8').toString('base64')
    : null;
  return { items: slice, nextCursor };
}

export function createSepRouter(): express.Router {
  const router = express.Router();
  router.use(express.json({ limit: '4mb' }));

  // Request ID middleware
  router.use((req, res, next) => {
    const reqId = (req.headers['x-request-id'] as string) || makeUuid();
    res.setHeader('x-request-id', reqId);
    res.locals.requestId = reqId;
    next();
  });

  function sendErr(res: express.Response, opts: ApiErrOptions) {
    res.status(opts.status).json({
      error: {
        code: opts.code,
        message: opts.message,
        requestId: res.locals.requestId as string,
        ...(opts.details ? { details: opts.details } : {}),
      },
    });
  }

  // Seeded canonical IDs from response-examples.json
  const OWNER_ID = '84a9acad-6d3b-421b-8965-acf910476cc0';
  const MEMBER_ID = 'c7b03327-f289-47b5-8dbc-ebbb6286deef';
  const PERSONAL_TENANT_ID = '1df3b9b8-5811-406d-ba9b-b5f2d0e4f46b';
  const TEAM_TENANT_ID = 'ae6dd9f7-0bd2-4693-b631-a45b717d0c11';
  const ORG_ID = 'cb9d684d-6b15-487c-88b0-d9af5678d85e';
  const REPO_ID = '6918de89-0559-4f9c-bcf1-33281ea3e4bd';
  const TEAM_ID = '8a820d93-fc85-43db-ba97-6599a4ba0280';
  const INTEGRATION_ID = '411ef6da-fc10-48b1-a98c-c8011f0ac523';
  const CONNECTOR_ID = '0959081c-8262-4e28-8496-21cd1fe57afc';
  const DEPLOYMENT_ID = '2d20cb54-30c8-44de-8b68-76e32496be3d';
  const RULE_SPL_ID = 'a1984471-47fc-4a7f-be83-dc84f89aebbe';
  const RULE_XQL_ID = '94f40249-e923-4c4f-94aa-7e94e21b558d';

  const users = [
    { id: OWNER_ID, username: 'exowner-5a4ea276', email: 'exowner-5a4ea276@example.test', displayName: 'exowner Test' },
    { id: MEMBER_ID, username: 'exmember-138c23c5', email: 'exmember-138c23c5@example.test', displayName: 'exmember Test' },
  ];

  const tenants = [
    { id: PERSONAL_TENANT_ID, slug: 'exowner-5a4ea276', name: 'exowner Test', kind: 'INDIVIDUAL', status: 'ACTIVE', createdAt: '2026-11-21T22:34:01.664Z' },
    { id: TEAM_TENANT_ID, slug: 'ex-181748', name: 'Example SOC', kind: 'TEAM', status: 'ACTIVE', createdAt: '2026-11-21T22:34:01.812Z' },
  ];

  const organizations = [
    { id: ORG_ID, tenantId: TEAM_TENANT_ID, slug: 'ex-181748', name: 'Example SOC', description: null as string | null, createdAt: '2026-11-21T22:34:01.812Z' },
    { id: 'cb9d684d-6b15-487c-88b0-d9af5678d85f', tenantId: PERSONAL_TENANT_ID, slug: 'exowner-5a4ea276', name: 'exowner Test', description: null as string | null, createdAt: '2026-11-21T22:34:01.664Z' },
  ];

  const rolesCatalog = [
    {
      key: 'tenant.owner',
      name: 'Workspace owner',
      description: 'Full administrative control of the workspace, billing, SSO, and organizations',
      scope: 'TENANT',
      permissions: ['tenant.manage', 'organization.manage', 'repository.manage', 'deployment.approve', 'connector.manage', 'connector.read', 'audit.read'],
    },
    {
      key: 'tenant.admin',
      name: 'Workspace administrator',
      description: 'Manages members, service accounts, and organizations within a workspace',
      scope: 'TENANT',
      permissions: ['tenant.manage', 'organization.manage', 'repository.manage', 'connector.manage', 'connector.read', 'audit.read'],
    },
    {
      key: 'tenant.member',
      name: 'Workspace member',
      description: 'Standard workspace member with read access to shared repositories',
      scope: 'TENANT',
      permissions: ['repository.read', 'connector.read'],
    },
    {
      key: 'organization.admin',
      name: 'Organization administrator',
      description: 'Manages one organization, its teams, repositories and rules',
      scope: 'ORGANIZATION',
      permissions: ['organization.manage', 'repository.manage', 'connector.manage', 'connector.read', 'deployment.request'],
    },
    {
      key: 'organization.deployment_approver',
      name: 'Deployment approver',
      description: 'Reviews and approves rule deployments in one organization',
      scope: 'ORGANIZATION',
      permissions: ['connector.read', 'deployment.approve'],
    },
    {
      key: 'repository.maintainer',
      name: 'Repository maintainer',
      description: 'Manages branches, branch protections, pull requests, and rules in a repository',
      scope: 'REPOSITORY',
      permissions: ['repository.manage', 'repository.read'],
    },
  ];

  const roleAssignments: Array<{
    id: string;
    tenantId: string;
    roleKey: string;
    scope: string;
    principalType: 'user' | 'team';
    principalId: string;
    organizationId: string | null;
    teamId: string | null;
    repositoryId: string | null;
    createdAt: string;
  }> = [
    {
      id: 'ca023281-5135-4fc3-84df-54b48eea9a13',
      tenantId: TEAM_TENANT_ID,
      roleKey: 'tenant.owner',
      scope: 'TENANT',
      principalType: 'user',
      principalId: OWNER_ID,
      organizationId: null,
      teamId: null,
      repositoryId: null,
      createdAt: '2026-11-21T22:34:01.813Z',
    },
    {
      id: 'dac52377-691f-46d5-9ab3-e65785800757',
      tenantId: TEAM_TENANT_ID,
      roleKey: 'organization.admin',
      scope: 'ORGANIZATION',
      principalType: 'user',
      principalId: OWNER_ID,
      organizationId: ORG_ID,
      teamId: null,
      repositoryId: null,
      createdAt: '2026-11-21T22:34:01.813Z',
    },
    {
      id: '9a81e27e-1a92-44c7-bc4d-5e5e05936ee7',
      tenantId: TEAM_TENANT_ID,
      roleKey: 'tenant.member',
      scope: 'TENANT',
      principalType: 'user',
      principalId: MEMBER_ID,
      organizationId: null,
      teamId: null,
      repositoryId: null,
      createdAt: '2026-11-21T22:34:02.220Z',
    },
    {
      id: 'aa81e27e-1a92-44c7-bc4d-5e5e05936ee8',
      tenantId: TEAM_TENANT_ID,
      roleKey: 'organization.deployment_approver',
      scope: 'ORGANIZATION',
      principalType: 'user',
      principalId: MEMBER_ID,
      organizationId: ORG_ID,
      teamId: null,
      repositoryId: null,
      createdAt: '2026-11-21T22:34:02.220Z',
    },
    {
      id: 'ba023281-5135-4fc3-84df-54b48eea9a14',
      tenantId: PERSONAL_TENANT_ID,
      roleKey: 'tenant.owner',
      scope: 'TENANT',
      principalType: 'user',
      principalId: OWNER_ID,
      organizationId: null,
      teamId: null,
      repositoryId: null,
      createdAt: '2026-11-21T22:34:01.664Z',
    },
  ];

  const tenantMembers = [
    { tenantId: TEAM_TENANT_ID, userId: OWNER_ID, status: 'ACTIVE', joinedAt: '2026-11-21T22:34:01.813Z' },
    { tenantId: TEAM_TENANT_ID, userId: MEMBER_ID, status: 'ACTIVE', joinedAt: '2026-11-21T22:34:02.220Z' },
    { tenantId: PERSONAL_TENANT_ID, userId: OWNER_ID, status: 'ACTIVE', joinedAt: '2026-11-21T22:34:01.664Z' },
  ];

  const teams: Array<{
    id: string;
    tenantId: string;
    organizationId: string;
    slug: string;
    name: string;
    description: string | null;
    createdAt: string;
  }> = [
    {
      id: TEAM_ID,
      tenantId: TEAM_TENANT_ID,
      organizationId: ORG_ID,
      slug: 'detection',
      name: 'Detection engineering',
      description: 'Core threat detection and rule tuning group',
      createdAt: '2026-11-21T22:34:02.371Z',
    },
  ];

  const teamMembers = [
    { teamId: TEAM_ID, userId: OWNER_ID, addedAt: '2026-11-21T22:34:02.372Z' },
    { teamId: TEAM_ID, userId: MEMBER_ID, addedAt: '2026-11-21T22:34:02.573Z' },
  ];

  const repositories: Array<{
    id: string;
    tenantId: string;
    organizationId: string;
    owner: string;
    name: string;
    fullName: string;
    description: string | null;
    visibility: string;
    status: string;
    defaultBranch: string;
    forkedFromId: string | null;
    cloneUrls: { https: string; ssh: string };
    createdAt: string;
    updatedAt: string;
  }> = [
    {
      id: REPO_ID,
      tenantId: TEAM_TENANT_ID,
      organizationId: ORG_ID,
      owner: 'ex-181748',
      name: 'detections',
      fullName: 'ex-181748/detections',
      description: 'Production detections',
      visibility: 'PRIVATE',
      status: 'ACTIVE',
      defaultBranch: 'main',
      forkedFromId: null as string | null,
      cloneUrls: {
        https: 'http://localhost:13000/git/ex-181748/detections.git',
        ssh: 'ssh://git@localhost:12222/ex-181748/detections.git',
      },
      createdAt: '2026-11-21T22:34:04.168Z',
      updatedAt: '2026-11-21T22:34:04.536Z',
    },
  ];

  const branchesByRepo = new Map<string, Array<{ name: string; protected: boolean; commitSha: string; commitMessage: string }>>([
    [
      REPO_ID,
      [
        { name: 'main', protected: false, commitSha: '78bce0e60f3119bdc6f6d6b53367e61e56a45b0c', commitMessage: 'Add LSASS detection' },
        { name: 'feature/tuning-2', protected: false, commitSha: '291dde9a92d3633f7e3430f3a6219f88b847100b', commitMessage: 'Raise LSASS severity' },
      ],
    ],
  ]);

  const commitsByRepo = new Map<string, Array<{ sha: string; message: string; authorName: string; authorEmail: string; authoredAt: string; author: { id: string | null; username: string } | null; parents: string[] }>>([
    [
      REPO_ID,
      [
        {
          sha: '78bce0e60f3119bdc6f6d6b53367e61e56a45b0c',
          message: 'Add LSASS detection\n',
          authorName: 'SEP Engineer',
          authorEmail: 'engineer@example.test',
          authoredAt: '2026-11-22T02:34:04+04:00',
          author: { id: OWNER_ID, username: 'exowner-5a4ea276' },
          parents: ['47f7f25591cb8b1fbc48b9051d0ca15ca098253d'],
        },
        {
          sha: '47f7f25591cb8b1fbc48b9051d0ca15ca098253d',
          message: 'Initial commit\n',
          authorName: 'sep-platform',
          authorEmail: 'sep-platform@forgejo.internal',
          authoredAt: '2026-11-21T22:34:04Z',
          author: { id: null, username: 'system' },
          parents: [],
        },
      ],
    ],
  ]);

  const protectionsByRepo = new Map<string, Array<{ pattern: string; requiredApprovals: number; allowDirectPush: boolean; blockOnRejectedReviews: boolean; dismissStaleApprovals: boolean }>>([
    [REPO_ID, []],
  ]);

  const pullsByRepo = new Map<string, Array<{
    number: number; title: string; body: string; state: string;
    author: { id: string | null; username: string };
    head: string; headSha: string; base: string; mergeable: boolean;
    mergeCommitSha: string | null; mergedBy: { id: string | null; username: string } | null;
    mergedAt: string | null; createdAt: string; updatedAt: string;
  }>>([
    [
      REPO_ID,
      [
        {
          number: 1,
          title: 'Raise LSASS severity',
          body: 'Seen in the wild across production endpoints.',
          state: 'open',
          author: { id: OWNER_ID, username: 'exowner-5a4ea276' },
          head: 'feature/tuning-2',
          headSha: '291dde9a92d3633f7e3430f3a6219f88b847100b',
          base: 'main',
          mergeable: true,
          mergeCommitSha: null,
          mergedBy: null,
          mergedAt: null,
          createdAt: '2026-11-21T22:34:09Z',
          updatedAt: '2026-11-21T22:34:09Z',
        },
      ],
    ],
  ]);

  const prFilesMap = new Map<string, Array<{ path: string; status: string; additions: number; deletions: number; previousPath: string | null }>>([
    [`${REPO_ID}:1`, [{ path: 'rules/windows/lsass.yml', status: 'changed', additions: 1, deletions: 1, previousPath: null }]],
  ]);

  const prReviewsMap = new Map<string, Array<{
    id: number; state: string; body: string; author: { id: string | null; username: string };
    commitSha: string; stale: boolean; submittedAt: string;
    comments: Array<{ id: number; path: string; body: string; line: number | null; author: { id: string | null; username: string } }>;
  }>>([]);

  const labelsByRepo = new Map<string, Array<{ id: number; name: string; color: string; description: string }>>([
    [REPO_ID, [{ id: 18, name: 'tuning', color: '#0e8a16', description: 'False positive tuning' }]],
  ]);

  const milestonesByRepo = new Map<string, Array<{ id: number; title: string; description: string; state: string; openIssues: number; closedIssues: number; dueOn: string | null }>>([
    [REPO_ID, []],
  ]);

  const issuesByRepo = new Map<string, Array<{
    number: number; title: string; body: string; state: string;
    author: { id: string | null; username: string }; comments: number;
    labelIds: number[]; milestoneId: number | null;
    createdAt: string; updatedAt: string; closedAt: string | null;
  }>>([
    [
      REPO_ID,
      [
        {
          number: 2,
          title: 'False positives from EDR scanner',
          body: 'Tune exclusions for scheduled scanner processes.',
          state: 'open',
          author: { id: OWNER_ID, username: 'exowner-5a4ea276' },
          comments: 1,
          labelIds: [18],
          milestoneId: null,
          createdAt: '2026-11-21T22:34:10Z',
          updatedAt: '2026-11-21T22:34:10Z',
          closedAt: null,
        },
      ],
    ],
  ]);

  const issueCommentsMap = new Map<string, Array<{ id: number; body: string; author: { id: string | null; username: string }; createdAt: string }>>([
    [`${REPO_ID}:2`, [{ id: 92, body: 'Working on it.', author: { id: OWNER_ID, username: 'exowner-5a4ea276' }, createdAt: '2026-11-21T22:34:10Z' }]],
  ]);

  const tagsByRepo = new Map<string, Array<{ name: string; commitSha: string; message: string }>>([[REPO_ID, []]]);
  const releasesByRepo = new Map<string, Array<{ id: number; tag: string; name: string; body: string; draft: boolean; prerelease: boolean; author: { id: string | null; username: string }; createdAt: string; publishedAt: string | null }>>([[REPO_ID, []]]);
  const wikiByRepo = new Map<string, Array<{ page: string; title: string; content: string; lastCommitSha: string | null; updatedAt: string | null }>>();

  const starsByRepo = new Map<string, Set<string>>([[REPO_ID, new Set([OWNER_ID])]]);
  const watchesByRepo = new Map<string, Set<string>>([[REPO_ID, new Set()]]);

  const rules = [
    {
      id: RULE_SPL_ID,
      repositoryId: REPO_ID,
      tenantId: TEAM_TENANT_ID,
      ruleUid: '7c9e2f41-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
      name: 'Many failed logons',
      format: 'SEP_DETECTION_V1',
      severity: 'MEDIUM',
      status: 'TEST',
      queryLanguage: 'spl',
      dialect: 'splunk:spl',
      path: 'rules/splunk/failed_logons.yml',
      validationStatus: 'VALID',
      deploymentStatus: 'NOT_DEPLOYED',
      tactics: ['TA0006'],
      techniques: ['T1110'],
      currentCommitSha: '78bce0e60f3119bdc6f6d6b53367e61e56a45b0c',
      updatedAt: '2026-11-21T22:34:07.607Z',
      description: 'Detects bursts of Windows Event ID 4625 failed logon attempts exceeding threshold',
      author: 'SOC',
      category: 'authentication',
      queryText: 'index=windows EventCode=4625 | stats count by user | where count > 20\n',
      platforms: ['splunk'],
      telemetry: ['authentication'],
      dataSources: ['Windows Security Event Log'],
      tags: ['attack.t1110', 'windows'],
      falsePositives: ['Service account password rotation'],
      references: ['https://attack.mitre.org/techniques/T1110/'],
      validationIssues: [],
    },
    {
      id: RULE_XQL_ID,
      repositoryId: REPO_ID,
      tenantId: TEAM_TENANT_ID,
      ruleUid: '3f0c2a10-5d4b-4e8f-9a61-0c1d2e3f4a5b',
      name: 'LSASS memory access',
      format: 'SEP_DETECTION_V1',
      severity: 'HIGH',
      status: 'STABLE',
      queryLanguage: 'xql',
      dialect: 'cortex-xsiam:xql',
      path: 'rules/windows/lsass.yml',
      validationStatus: 'VALID',
      deploymentStatus: 'NOT_DEPLOYED',
      tactics: ['TA0006'],
      techniques: ['T1003.001'],
      currentCommitSha: '78bce0e60f3119bdc6f6d6b53367e61e56a45b0c',
      updatedAt: '2026-11-21T22:34:07.607Z',
      description: 'Handle requests to lsass.exe by unusual processes',
      author: 'SOC',
      category: null,
      queryText: 'dataset = xdr_data\n| filter event_type = ENUM.PROCESS and action_process_image_name = "lsass.exe"\n',
      platforms: ['cortex-xsiam'],
      telemetry: ['process_access'],
      dataSources: ['Cortex XDR Agent'],
      tags: [],
      falsePositives: ['EDR scanners'],
      references: ['https://attack.mitre.org/techniques/T1003/001/'],
      validationIssues: [],
    },
  ];

  const indexStatusByRepo = new Map<string, { status: string; pollCount: number; commitSha: string | null; indexedAt: string | null }>([
    [REPO_ID, { status: 'INDEXED', pollCount: 2, commitSha: '78bce0e60f3119bdc6f6d6b53367e61e56a45b0c', indexedAt: '2026-11-21T22:34:07.607Z' }],
  ]);

  const mitreTactics = [
    { id: 'TA0043', shortName: 'reconnaissance', name: 'Reconnaissance' },
    { id: 'TA0042', shortName: 'resource-development', name: 'Resource Development' },
    { id: 'TA0001', shortName: 'initial-access', name: 'Initial Access' },
    { id: 'TA0002', shortName: 'execution', name: 'Execution' },
    { id: 'TA0003', shortName: 'persistence', name: 'Persistence' },
    { id: 'TA0004', shortName: 'privilege-escalation', name: 'Privilege Escalation' },
    { id: 'TA0005', shortName: 'defense-evasion', name: 'Defense Evasion' },
    { id: 'TA0006', shortName: 'credential-access', name: 'Credential Access' },
    { id: 'TA0007', shortName: 'discovery', name: 'Discovery' },
    { id: 'TA0008', shortName: 'lateral-movement', name: 'Lateral Movement' },
  ];

  const mitreTechniques = [
    { id: 'T1589', name: 'Gather Victim Identity Information', parentId: null, tactics: ['reconnaissance'], platforms: ['PRE'] },
    { id: 'T1583', name: 'Acquire Infrastructure', parentId: null, tactics: ['resource-development'], platforms: ['PRE'] },
    { id: 'T1566', name: 'Phishing', parentId: null, tactics: ['initial-access'], platforms: ['Windows', 'macOS', 'Linux'] },
    { id: 'T1059', name: 'Command and Scripting Interpreter', parentId: null, tactics: ['execution'], platforms: ['Windows', 'macOS', 'Linux'] },
    { id: 'T1053', name: 'Scheduled Task/Job', parentId: null, tactics: ['execution', 'persistence', 'privilege-escalation'], platforms: ['Windows', 'Linux'] },
    { id: 'T1547', name: 'Boot or Logon Autostart Execution', parentId: null, tactics: ['persistence', 'privilege-escalation'], platforms: ['Windows', 'macOS'] },
    { id: 'T1078', name: 'Valid Accounts', parentId: null, tactics: ['defense-evasion', 'persistence', 'privilege-escalation', 'initial-access'], platforms: ['Windows', 'Cloud'] },
    { id: 'T1055', name: 'Process Injection', parentId: null, tactics: ['defense-evasion', 'privilege-escalation'], platforms: ['Windows', 'Linux'] },
    { id: 'T1003', name: 'OS Credential Dumping', parentId: null, tactics: ['credential-access'], platforms: ['Linux', 'Windows'] },
    { id: 'T1003.001', name: 'LSASS Memory', parentId: 'T1003', tactics: ['credential-access'], platforms: ['Windows'] },
    { id: 'T1110', name: 'Brute Force', parentId: null, tactics: ['credential-access'], platforms: ['Windows', 'Linux', 'Cloud'] },
    { id: 'T1082', name: 'System Information Discovery', parentId: null, tactics: ['discovery'], platforms: ['Windows', 'Linux', 'macOS'] },
    { id: 'T1021', name: 'Remote Services', parentId: null, tactics: ['lateral-movement'], platforms: ['Windows', 'Linux'] },
  ];

  const conversionCatalog = {
    dialects: [
      { id: 'cortex-xsiam:xql', name: 'Cortex XSIAM XQL', language: 'xql', aliases: ['cortex-xdr:xql'], source: true, target: true },
      { id: 'splunk:spl', name: 'Splunk SPL', language: 'spl', aliases: [], source: true, target: true },
      { id: 'microsoft-sentinel:kql', name: 'Microsoft Sentinel KQL', language: 'kql', aliases: [], source: true, target: true },
    ],
    modes: ['strict', 'assisted'],
  };

  const conversions: Array<Record<string, unknown>> = [
    {
      id: 'b9930161-66ce-403e-9923-cf279266c86c',
      organizationId: ORG_ID,
      sourceDialect: 'microsoft-sentinel:kql',
      targetDialect: 'splunk:spl',
      mode: 'strict',
      status: 'SUCCEEDED',
      source: { type: 'query' },
      sourceQuery: 'DeviceProcessEvents\n| where FileName =~ "powershell.exe" and ProcessCommandLine contains "-enc"',
      fieldMappingSetId: null,
      options: { xqlCaseSensitive: null },
      errorCode: null,
      createdByUserId: OWNER_ID,
      createdAt: '2026-11-21T22:34:11.614Z',
      startedAt: '2026-11-21T22:34:11.619Z',
      completedAt: '2026-11-21T22:34:11.624Z',
      result: {
        status: 'SUCCEEDED',
        method: 'deterministic',
        query: 'tag=process tag=report process_name="powershell.exe" process="*-enc*"',
        warnings: [],
        unsupported: [],
        fieldMappings: [
          { status: 'mapped', sourceField: 'FileName', targetField: 'process_name', canonicalField: 'process.name' },
          { status: 'mapped', sourceField: 'ProcessCommandLine', targetField: 'process', canonicalField: 'process.command_line' },
        ],
        semanticDifferences: [],
        validation: { diagnostics: [], targetSyntaxValid: true, roundTripEquivalent: true },
        reviewRequired: false,
        error: null,
        logicalSource: 'edr.process',
        ai: null,
        engineVersion: '0.2.0',
        profile: { name: 'default', version: '2026.11.1' },
        createdAt: '2026-11-21T22:34:11.623Z',
      },
    },
    {
      id: '980ffb50-0c6a-49e5-8ec6-0bd91c1a412f',
      organizationId: ORG_ID,
      sourceDialect: 'splunk:spl',
      targetDialect: 'cortex-xsiam:xql',
      mode: 'strict',
      status: 'FAILED',
      source: { type: 'query' },
      sourceQuery: 'index=windows EventCode=4625 | stats count by user',
      fieldMappingSetId: null,
      options: { xqlCaseSensitive: null },
      errorCode: 'mapping.source_unmapped',
      createdByUserId: OWNER_ID,
      createdAt: '2026-11-21T22:34:11.414Z',
      startedAt: '2026-11-21T22:34:11.427Z',
      completedAt: '2026-11-21T22:34:11.435Z',
      result: {
        status: 'FAILED',
        method: 'none',
        query: null,
        warnings: [],
        unsupported: [],
        fieldMappings: [],
        semanticDifferences: [],
        validation: { diagnostics: [], targetSyntaxValid: null, roundTripEquivalent: null },
        reviewRequired: true,
        error: {
          code: 'mapping.source_unmapped',
          message: "The query's data source does not match any source in the mapping profile (check the dataset/table/index and the selecting conditions, or add a source override)",
          severity: 'error',
        },
        logicalSource: null,
        ai: null,
        engineVersion: '0.2.0',
        profile: { name: 'default', version: '2026.11.1' },
        createdAt: '2026-11-21T22:34:11.434Z',
      },
    },
  ];

  const fieldMappings: Array<Record<string, unknown>> = [];

  const providers = [
    {
      key: 'splunk',
      name: 'Splunk Enterprise / Splunk Cloud',
      vendor: 'Splunk',
      capabilities: ['rule.read', 'rule.create'],
      dialects: ['splunk:spl'],
      credentialKinds: [{ kind: 'splunk_token', description: 'Splunk authentication token' }],
      executionModes: ['DIRECT', 'CONNECTOR'],
      configSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          baseUrl: { type: 'string', maxLength: 2048, format: 'uri' },
          app: { default: 'search', type: 'string', pattern: '^[A-Za-z0-9_.-]{1,80}$' },
          owner: { default: 'nobody', type: 'string', pattern: '^[A-Za-z0-9_.@-]{1,80}$' },
          cronSchedule: { default: '*/15 * * * *', type: 'string', pattern: '^[0-9*/,\\- ]{9,64}$' },
          earliestTime: { default: '-20m', type: 'string', pattern: '^[-+@a-zA-Z0-9]{1,32}$' },
          latestTime: { default: 'now', type: 'string', pattern: '^[-+@a-zA-Z0-9]{1,32}$' },
          caCertificate: { type: 'string', maxLength: 16384 },
        },
        required: ['baseUrl'],
        additionalProperties: false,
      },
      notes: [
        'Rules are stored as scheduled saved searches named "SEP-<rule id>" in the configured app.',
      ],
    },
    {
      key: 'cortex-xsiam',
      name: 'Cortex XSIAM',
      vendor: 'Palo Alto Networks',
      capabilities: ['rule.read', 'rule.create'],
      dialects: ['cortex-xsiam:xql'],
      credentialKinds: [{ kind: 'xsiam_api_key', description: 'Cortex XSIAM API key' }],
      executionModes: ['DIRECT', 'CONNECTOR'],
      configSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          baseUrl: { type: 'string', maxLength: 2048, format: 'uri' },
          apiKeyId: { type: 'string', pattern: '^[0-9]{1,10}$' },
          keyType: { default: 'advanced', type: 'string', enum: ['standard', 'advanced'] },
          schedule: { default: '10 minutes', type: 'string', pattern: '^[0-9]{1,3} (minutes|hours?)$' },
          searchWindow: { default: '20 minutes', type: 'string', pattern: '^[0-9]{1,3} (minutes|hours?|days?)$' },
          timezone: { default: 'UTC', type: 'string', pattern: '^[A-Za-z_/+-]{1,64}$' },
          alertCategory: { default: 'OTHER', type: 'string', pattern: '^[A-Z_]{1,64}$' },
          caCertificate: { type: 'string', maxLength: 16384 },
        },
        required: ['baseUrl', 'apiKeyId'],
        additionalProperties: false,
      },
      notes: [
        'No parse-only endpoint exists; XQL syntax is validated by the platform converter.',
      ],
    },
  ];

  const integrations: Array<Record<string, unknown>> = [
    {
      id: INTEGRATION_ID,
      organizationId: ORG_ID,
      name: 'Splunk production',
      provider: 'splunk',
      environment: 'PRODUCTION',
      executionMode: 'DIRECT',
      connectorId: null,
      config: {
        app: 'search',
        owner: 'nobody',
        baseUrl: 'http://fake-siem:8088',
        latestTime: 'now',
        cronSchedule: '*/15 * * * *',
        earliestTime: '-20m',
      },
      status: 'ACTIVE',
      health: 'HEALTHY',
      healthCheckedAt: '2026-11-21T22:34:12.332Z',
      capabilities: ['rule.read', 'rule.create'],
      credential: { kind: 'splunk_token', rotatedAt: '2026-11-21T22:34:12.146Z' },
      version: 1,
      createdAt: '2026-11-21T22:34:12.009Z',
      updatedAt: '2026-11-21T22:34:12.148Z',
    },
  ];

  const integrationEvents: Array<Record<string, unknown>> = [
    {
      id: 'e12d09c7-51fb-497b-9c2e-ff159c5c051d',
      integrationId: INTEGRATION_ID,
      type: 'health.checked',
      actorUserId: null,
      data: { via: 'direct', healthy: true },
      createdAt: '2026-11-21T22:34:12.332Z',
    },
    {
      id: '2cb5770f-55cb-4d2a-9a32-fdca160eab7e',
      integrationId: INTEGRATION_ID,
      type: 'credential.set',
      actorUserId: OWNER_ID,
      data: { kind: 'splunk_token', kekId: 'k1' },
      createdAt: '2026-11-21T22:34:12.150Z',
    },
  ];

  let deploymentPolicy = {
    id: '84e72659-5f2c-4123-aa6b-42bad1cde4cf',
    organizationId: ORG_ID,
    productionApprovals: 1,
    nonProductionApprovals: 0,
    allowSelfApprovalNonProduction: false,
    allowWarningRules: false,
    deploymentsEnabled: true,
    version: 1,
    updatedByUserId: OWNER_ID,
    updatedAt: '2026-11-21T22:34:12.475Z',
  };

  const deployments: Array<Record<string, unknown>> = [
    {
      id: DEPLOYMENT_ID,
      organizationId: ORG_ID,
      integrationId: INTEGRATION_ID,
      action: 'DEPLOY',
      operation: 'deploy',
      status: 'PENDING_APPROVAL',
      environment: 'PRODUCTION',
      executionMode: 'DIRECT',
      rule: {
        repositoryId: REPO_ID,
        ruleId: RULE_SPL_ID,
        uid: '7c9e2f41-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
        name: 'Many failed logons',
        severity: 'MEDIUM',
        commitSha: '78bce0e60f3119bdc6f6d6b53367e61e56a45b0c',
        blobSha: 'c4da5022c6cf577a062cc197bb1c4389911a614e',
        dialect: 'splunk:spl',
        query: 'index=windows EventCode=4625 | stats count by user | where count > 20\n',
      },
      rollbackOfId: null,
      requiredApprovals: 1,
      allowSelfApproval: false,
      approvals: [],
      requestedByUserId: OWNER_ID,
      externalId: null,
      errorCode: null,
      attempts: 0,
      createdAt: '2026-11-21T22:34:12.607Z',
      approvedAt: null,
      startedAt: null,
      completedAt: null,
    },
  ];

  const deploymentLogs: Array<Record<string, unknown>> = [
    {
      id: 'c1a4a831-d090-4f5f-846f-43950b0156a3',
      deploymentId: DEPLOYMENT_ID,
      level: 'info',
      event: 'deployment.requested',
      message: 'Deployment requested',
      data: { environment: 'PRODUCTION', requiredApprovals: 1 },
      createdAt: '2026-11-21T22:34:12.608Z',
    },
  ];

  const connectors: Array<Record<string, unknown>> = [
    {
      id: CONNECTOR_ID,
      organizationId: ORG_ID,
      name: 'dc1-agent',
      description: 'Data centre 1',
      status: 'ACTIVE',
      health: 'PENDING',
      lastSeenAt: null,
      healthChangedAt: null,
      createdAt: '2026-11-21T22:34:13.026Z',
      updatedAt: '2026-11-21T22:34:13.026Z',
      instances: [],
    },
  ];

  const webhooks: Array<Record<string, unknown>> = [
    {
      id: '3071f5df-4895-4a80-a7a2-c6d837f88234',
      organizationId: ORG_ID,
      url: 'http://fake-siem:8088/webhooks/example',
      description: 'SIEM deployment status webhook',
      events: ['deployment.succeeded', 'conversion.completed'],
      status: 'ACTIVE',
      disabledReason: null,
      consecutiveFailures: 0,
      version: 1,
      createdAt: '2026-11-21T22:34:13.370Z',
      updatedAt: '2026-11-21T22:34:13.370Z',
    },
  ];

  const webhookDeliveries: Array<Record<string, unknown>> = [
    {
      id: 'f6700bdc-0b8e-4583-93aa-9f573e57d29f',
      webhookId: '3071f5df-4895-4a80-a7a2-c6d837f88234',
      eventId: 'cee17c6f-6185-4247-b032-66a91e994219',
      eventType: 'webhook.ping',
      status: 'SUCCEEDED',
      attempts: 1,
      responseStatus: 200,
      errorCode: null,
      createdAt: '2026-11-21T22:34:13.515Z',
      lastAttemptAt: '2026-11-21T22:34:13.519Z',
      deliveredAt: '2026-11-21T22:34:13.519Z',
    },
  ];

  const serviceAccounts: Array<Record<string, unknown>> = [
    {
      id: 'da45d503-5ad6-425f-adbf-d0d2ba49ad7b',
      tenantId: TEAM_TENANT_ID,
      userId: 'de60173a-232a-4e78-b038-8ed44640d575',
      username: 'svc-dab3a09ec84c5842',
      name: 'ci-pipeline',
      description: 'CI deploys',
      status: 'ACTIVE',
      createdAt: '2026-11-21T22:34:03.291Z',
      updatedAt: '2026-11-21T22:34:03.291Z',
    },
  ];

  const apiKeys: Array<Record<string, unknown>> = [
    {
      id: '27392918-f3af-4ef2-875f-bf76effa3118',
      serviceAccountId: 'da45d503-5ad6-425f-adbf-d0d2ba49ad7b',
      name: 'ci',
      displayPrefix: 'sep_key_9f8a',
      status: 'ACTIVE',
      expiresAt: '2027-02-19T22:34:03.422Z',
      lastUsedAt: null,
      revokedAt: null,
      rotatedFromId: null,
      createdAt: '2026-11-21T22:34:03.422Z',
    },
  ];

  const gitTokens: Array<Record<string, unknown>> = [
    {
      id: '3c77aac5-33ab-4751-bd82-5f16e25dca7a',
      userId: OWNER_ID,
      name: 'laptop',
      displayPrefix: 'sep_git_4b2e',
      scopes: ['git:read', 'git:write'],
      expiresAt: '2027-02-19T22:34:03.550Z',
      lastUsedAt: null,
      createdAt: '2026-11-21T22:34:03.550Z',
    },
  ];

  const sshKeys: Array<Record<string, unknown>> = [];
  const scimTokens: Array<Record<string, unknown>> = [];
  let ssoConnection: Record<string, unknown> | null = null;
  let securityPolicy = { requireMfa: false, acceptedAcr: [] as string[], version: 0 };

  const notifications = [
    {
      id: 1,
      userId: OWNER_ID,
      type: 'deployment.requested',
      title: 'Deployment awaiting approval',
      body: 'Many failed logons (splunk:spl) requested for Splunk production.',
      read: false,
      link: `/ex-181748/deployments/${DEPLOYMENT_ID}`,
      createdAt: '2026-11-21T22:34:12.610Z',
    },
    {
      id: 2,
      userId: MEMBER_ID,
      type: 'deployment.requested',
      title: 'Approval requested from exowner-5a4ea276',
      body: 'Many failed logons requires 1 approval for PRODUCTION.',
      read: false,
      link: `/ex-181748/deployments/${DEPLOYMENT_ID}`,
      createdAt: '2026-11-21T22:34:12.610Z',
    },
  ];

  const auditLogs: Array<Record<string, unknown>> = [
    {
      id: '52c53e1a-8594-49d4-8abd-774326999ade',
      tenantId: TEAM_TENANT_ID,
      action: 'team.member.added',
      actorUserId: OWNER_ID,
      targetType: 'team',
      targetId: TEAM_ID,
      requestId: '2b0aee02-89ed-4467-ae6b-42f68b51dd72',
      metadata: { userId: MEMBER_ID },
      createdAt: '2026-11-21T22:34:02.574Z',
    },
    {
      id: '4010d4aa-ada2-4595-80b8-8e7125151605',
      tenantId: TEAM_TENANT_ID,
      action: 'team.created',
      actorUserId: OWNER_ID,
      targetType: 'team',
      targetId: TEAM_ID,
      requestId: '80966c3b-bee0-49e0-82ab-dec120ab9d57',
      metadata: { slug: 'detection', organizationId: ORG_ID },
      createdAt: '2026-11-21T22:34:02.376Z',
    },
  ];

  const plans = [
    {
      key: 'community',
      name: 'Community',
      description: 'Individuals and small teams getting started',
      trialDays: 0,
      priceMonthlyCents: 0,
      currency: 'USD',
      entitlements: {
        'api.service_accounts': 0,
        'deployments.advanced': 0,
        'git.dedicated_instance': 0,
        'security.mfa_enforcement': 0,
        'identity.scim': 0,
        'sso.enterprise': 0,
        'audit.retention_days': 30,
        'connectors.max': 1,
        'integrations.max': 2,
        'storage.bytes': 1073741824,
        'api.requests.monthly': 100000,
        'conversions.monthly': 200,
        'repositories.private.max': 10,
        'seats.max': 5,
      },
    },
    {
      key: 'team',
      name: 'Team',
      description: 'SOC and detection-engineering teams',
      trialDays: 14,
      priceMonthlyCents: 4900,
      currency: 'USD',
      entitlements: {
        'api.service_accounts': 20,
        'deployments.advanced': 1,
        'git.dedicated_instance': 0,
        'security.mfa_enforcement': 1,
        'identity.scim': 0,
        'sso.enterprise': 0,
        'audit.retention_days': 365,
        'connectors.max': 10,
        'integrations.max': 20,
        'storage.bytes': 53687091200,
        'api.requests.monthly': 2000000,
        'conversions.monthly': 10000,
        'repositories.private.max': 200,
        'seats.max': 50,
      },
    },
    {
      key: 'enterprise',
      name: 'Enterprise',
      description: 'Dedicated Git isolation, SAML SSO, SCIM provisioning, and custom retention',
      trialDays: 30,
      priceMonthlyCents: 19900,
      currency: 'USD',
      entitlements: {
        'api.service_accounts': 100,
        'deployments.advanced': 1,
        'git.dedicated_instance': 1,
        'security.mfa_enforcement': 1,
        'identity.scim': 1,
        'sso.enterprise': 1,
        'audit.retention_days': 1825,
        'connectors.max': 50,
        'integrations.max': 100,
        'storage.bytes': 536870912000,
        'api.requests.monthly': 20000000,
        'conversions.monthly': -1,
        'repositories.private.max': -1,
        'seats.max': -1,
      },
    },
  ];

  const subscriptionsByTenant = new Map<string, Record<string, unknown>>([
    [
      TEAM_TENANT_ID,
      {
        subscription: {
          id: '4e59f6ed-de09-42e2-a609-184c83df079d',
          plan: { key: 'team', name: 'Team' },
          status: 'TRIALING',
          provider: 'manual',
          currentPeriodStart: '2026-11-21T22:34:01.813Z',
          currentPeriodEnd: '2026-12-05T22:34:01.813Z',
          trialEndsAt: '2026-12-05T22:34:01.813Z',
          pastDueSince: null,
          cancelAtPeriodEnd: false,
          requestedPlan: null,
          version: 1,
        },
        effectivePlan: { key: 'team', name: 'Team', fallback: false },
        entitlements: plans[1].entitlements,
        overrides: {},
        provider: 'signed-webhook',
      },
    ],
  ]);

  const gitInstances: Array<Record<string, unknown>> = [
    {
      name: 'default-forgejo',
      baseUrl: 'https://git.internal.sep.local',
      sshHost: 'git.internal.sep.local',
      sshPort: 12222,
      adminUsername: 'sep-platform',
      createdAt: '2026-11-21T22:34:00.000Z',
    },
  ];

  function getAuthUser(req: express.Request) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    const token = auth.slice(7).trim();
    if (!token) return null;
    if (token === 'sep-demo-member') return users[1];
    return users[0];
  }

  function requireAuth(req: express.Request, res: express.Response) {
    const u = getAuthUser(req);
    if (!u) {
      sendErr(res, { status: 401, code: 'UNAUTHENTICATED', message: 'Authentication required' });
      return null;
    }
    return u;
  }

  function isTenantOwnerOrAdmin(userId: string, tenantId: string): boolean {
    return roleAssignments.some(
      (a) =>
        a.tenantId === tenantId &&
        a.principalId === userId &&
        (a.roleKey === 'tenant.owner' || a.roleKey === 'tenant.admin' || a.roleKey === 'organization.admin'),
    );
  }

  function recordAudit(tenantId: string, actorUserId: string, action: string, targetType: string, targetId: string, reqId: string, metadata: Record<string, unknown> = {}) {
    auditLogs.unshift({
      id: makeUuid(),
      tenantId,
      action,
      actorUserId,
      targetType,
      targetId,
      requestId: reqId,
      metadata,
      createdAt: nowIso(),
    });
  }

  // Public endpoints
  router.get('/plans', (_req, res) => {
    res.json({ items: plans });
  });

  router.get('/rules/search', (req, res) => {
    const q = String(req.query.q ?? '').toLowerCase();
    const publicRepos = new Set(repositories.filter((r) => r.visibility === 'PUBLIC').map((r) => r.id));
    const matches = rules
      .filter((r) => publicRepos.has(r.repositoryId))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.queryText.toLowerCase().includes(q))
      .map((r) => {
        const repo = repositories.find((x) => x.id === r.repositoryId)!;
        return {
          id: r.id,
          ruleUid: r.ruleUid,
          name: r.name,
          severity: r.severity,
          status: r.status,
          queryLanguage: r.queryLanguage,
          path: r.path,
          tactics: r.tactics,
          techniques: r.techniques,
          validationStatus: r.validationStatus,
          repository: { id: repo.id, tenantId: repo.tenantId, fullName: repo.fullName, visibility: repo.visibility },
        };
      });
    res.json(paginate(matches, req.query.limit, req.query.cursor));
  });

  // Protected auth endpoints
  router.get('/users/me', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const memberships = tenantMembers
      .filter((m) => m.userId === u.id)
      .map((m) => {
        const tenant = tenants.find((t) => t.id === m.tenantId)!;
        const roles = roleAssignments
          .filter((a) => a.tenantId === m.tenantId && a.principalId === u.id && a.scope === 'TENANT')
          .map((a) => a.roleKey);
        return { tenant, roles };
      });
    res.json({ ...u, memberships });
  });

  router.get('/users/me/sessions', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    res.json({
      items: [
        { id: '3e71ba39-c6b5-79e4-d0b4-e47063a98dc9', ipAddress: '127.0.0.1', startedAt: '2026-11-21T22:34:01.000Z', lastAccessAt: nowIso() },
      ],
      source: 'idp',
    });
  });

  router.post('/users/me/sessions/revoke', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    res.json({ revoked: true });
  });

  router.get('/users/me/notifications', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const includeAll = req.query.all === 'true';
    const items = notifications.filter((n) => n.userId === u.id && (includeAll || !n.read));
    res.json(paginate(items, req.query.limit, req.query.cursor));
  });

  router.patch('/users/me/notifications/:id', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const id = Number(req.params.id);
    const n = notifications.find((x) => x.id === id && x.userId === u.id);
    if (n) n.read = true;
    res.status(204).end();
  });

  router.post('/users/me/notifications/mark-all-read', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    for (const n of notifications) {
      if (n.userId === u.id) n.read = true;
    }
    res.status(204).end();
  });

  router.get('/users/me/git-tokens', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    res.json(gitTokens.filter((t) => t.userId === u.id));
  });

  router.post('/users/me/git-tokens', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const { name, scopes, expiresInDays } = req.body as { name?: string; scopes?: string[]; expiresInDays?: number };
    if (!name?.trim()) {
      sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'Request validation failed', details: [{ field: 'name', message: 'name is required' }] });
      return;
    }
    const secret = `sep_git_${crypto.randomBytes(16).toString('hex')}`;
    const exp = new Date(Date.now() + ((expiresInDays || 90) * 86400000)).toISOString();
    const rec = {
      id: makeUuid(),
      userId: u.id,
      name: name.trim(),
      displayPrefix: secret.slice(0, 12),
      scopes: scopes && scopes.length > 0 ? scopes : ['git:read'],
      expiresAt: exp,
      lastUsedAt: null,
      createdAt: nowIso(),
    };
    gitTokens.unshift(rec);
    res.status(201).json({ ...rec, token: secret });
  });

  router.delete('/users/me/git-tokens/:tokenId', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const idx = gitTokens.findIndex((t) => t.id === req.params.tokenId && t.userId === u.id);
    if (idx >= 0) gitTokens.splice(idx, 1);
    res.status(204).end();
  });

  router.get('/users/me/ssh-keys', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    res.json(sshKeys.filter((k) => k.userId === u.id));
  });

  router.post('/users/me/ssh-keys', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const { title, publicKey } = req.body as { title?: string; publicKey?: string };
    if (!title?.trim() || !publicKey?.trim()) {
      sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'title and publicKey are required' });
      return;
    }
    const fp = `SHA256:${crypto.createHash('sha256').update(publicKey.trim()).digest('base64').slice(0, 24)}`;
    const rec = { id: makeUuid(), userId: u.id, title: title.trim(), fingerprint: fp, createdAt: nowIso() };
    sshKeys.unshift(rec);
    res.status(201).json(rec);
  });

  router.delete('/users/me/ssh-keys/:keyId', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const idx = sshKeys.findIndex((k) => k.id === req.params.keyId && k.userId === u.id);
    if (idx >= 0) sshKeys.splice(idx, 1);
    res.status(204).end();
  });

  router.get('/roles', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    res.json(rolesCatalog);
  });

  router.get('/tenants', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const memberTenantIds = new Set(tenantMembers.filter((m) => m.userId === u.id).map((m) => m.tenantId));
    res.json(paginate(tenants.filter((t) => memberTenantIds.has(t.id)), req.query.limit, req.query.cursor));
  });

  router.get('/tenants/:tenantId', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const t = tenants.find((x) => x.id === req.params.tenantId);
    if (!t) {
      sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Workspace not found' });
      return;
    }
    res.json(t);
  });

  router.patch('/tenants/:tenantId', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const t = tenants.find((x) => x.id === req.params.tenantId);
    if (!t) {
      sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Workspace not found' });
      return;
    }
    if (!isTenantOwnerOrAdmin(u.id, t.id)) {
      sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
      return;
    }
    const { name } = req.body as { name?: string };
    if (!name?.trim()) {
      sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'name is required' });
      return;
    }
    t.name = name.trim();
    res.json(t);
  });

  router.post('/organizations', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const { slug, name, description } = req.body as { slug?: string; name?: string; description?: string };
    if (!slug || !/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(slug)) {
      sendErr(res, {
        status: 400,
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: [{ field: 'slug', message: 'slug must be lowercase alphanumeric with hyphens' }],
      });
      return;
    }
    if (!name?.trim()) {
      sendErr(res, {
        status: 400,
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: [{ field: 'name', message: 'name is required' }],
      });
      return;
    }
    if (organizations.some((o) => o.slug === slug)) {
      sendErr(res, { status: 409, code: 'CONFLICT', message: `Namespace "${slug}" already exists` });
      return;
    }
    const now = nowIso();
    const tenant = { id: makeUuid(), slug, name: name.trim(), kind: 'TEAM', status: 'ACTIVE', createdAt: now };
    const org = { id: makeUuid(), tenantId: tenant.id, slug, name: name.trim(), description: description ?? null, createdAt: now };
    tenants.push(tenant);
    organizations.push(org);
    tenantMembers.push({ tenantId: tenant.id, userId: u.id, status: 'ACTIVE', joinedAt: now });
    roleAssignments.push({
      id: makeUuid(),
      tenantId: tenant.id,
      roleKey: 'tenant.owner',
      scope: 'TENANT',
      principalType: 'user',
      principalId: u.id,
      organizationId: null,
      teamId: null,
      repositoryId: null,
      createdAt: now,
    });
    subscriptionsByTenant.set(tenant.id, {
      subscription: {
        id: makeUuid(),
        plan: { key: 'team', name: 'Team' },
        status: 'TRIALING',
        provider: 'manual',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(Date.now() + 14 * 86400000).toISOString(),
        trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
        pastDueSince: null,
        cancelAtPeriodEnd: false,
        requestedPlan: null,
        version: 1,
      },
      effectivePlan: { key: 'team', name: 'Team', fallback: false },
      entitlements: plans[1].entitlements,
      overrides: {},
      provider: 'signed-webhook',
    });
    res.status(201).json({ tenant, organization: org });
  });

  router.get('/tenants/:tenantId/organizations', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    res.json(paginate(organizations.filter((o) => o.tenantId === req.params.tenantId), req.query.limit, req.query.cursor));
  });

  router.get('/tenants/:tenantId/organizations/:orgId', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const o = organizations.find((x) => x.id === req.params.orgId && x.tenantId === req.params.tenantId);
    if (!o) {
      sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Organization not found' });
      return;
    }
    res.json(o);
  });

  router.patch('/tenants/:tenantId/organizations/:orgId', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const o = organizations.find((x) => x.id === req.params.orgId && x.tenantId === req.params.tenantId);
    if (!o) {
      sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Organization not found' });
      return;
    }
    const { name, description } = req.body as { name?: string; description?: string | null };
    if (name !== undefined) o.name = name;
    if (description !== undefined) o.description = description;
    res.json(o);
  });

  router.post('/tenants/:tenantId/organizations/:orgId/rename', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const o = organizations.find((x) => x.id === req.params.orgId && x.tenantId === req.params.tenantId);
    if (!o) {
      sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Organization not found' });
      return;
    }
    const { slug } = req.body as { slug?: string };
    if (!slug || !/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(slug)) {
      sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'Invalid slug' });
      return;
    }
    if (organizations.some((x) => x.slug === slug && x.id !== o.id)) {
      sendErr(res, { status: 409, code: 'CONFLICT', message: 'Slug already taken' });
      return;
    }
    o.slug = slug;
    for (const r of repositories) {
      if (r.organizationId === o.id) {
        r.owner = slug;
        r.fullName = `${slug}/${r.name}`;
      }
    }
    res.json(o);
  });

  // Members, teams, roles, audit
  router.get('/tenants/:tenantId/members', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const items = tenantMembers
      .filter((m) => m.tenantId === req.params.tenantId)
      .map((m) => {
        const user = users.find((x) => x.id === m.userId)!;
        const roles = roleAssignments.filter((a) => a.tenantId === req.params.tenantId && a.principalId === m.userId);
        return { user: { id: user.id, username: user.username, displayName: user.displayName }, status: m.status, roles, joinedAt: m.joinedAt };
      });
    res.json(paginate(items, req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/members', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (!isTenantOwnerOrAdmin(u.id, req.params.tenantId)) {
      sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
      return;
    }
    const { username, roleKey } = req.body as { username?: string; roleKey?: string };
    if (!username?.trim()) {
      sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'username is required' });
      return;
    }
    let targetUser = users.find((x) => x.username === username.trim());
    if (!targetUser) {
      targetUser = { id: makeUuid(), username: username.trim(), email: `${username.trim()}@example.test`, displayName: username.trim() };
      users.push(targetUser);
    }
    if (tenantMembers.some((m) => m.tenantId === req.params.tenantId && m.userId === targetUser.id)) {
      sendErr(res, { status: 409, code: 'CONFLICT', message: 'User is already a member' });
      return;
    }
    const now = nowIso();
    tenantMembers.push({ tenantId: req.params.tenantId, userId: targetUser.id, status: 'ACTIVE', joinedAt: now });
    const ra = {
      id: makeUuid(),
      tenantId: req.params.tenantId,
      roleKey: roleKey || 'tenant.member',
      scope: 'TENANT',
      principalType: 'user' as const,
      principalId: targetUser.id,
      organizationId: null,
      teamId: null,
      repositoryId: null,
      createdAt: now,
    };
    roleAssignments.push(ra);
    recordAudit(req.params.tenantId, u.id, 'member.added', 'user', targetUser.id, res.locals.requestId as string, { username: targetUser.username });
    res.status(201).json({ user: { id: targetUser.id, username: targetUser.username, displayName: targetUser.displayName }, status: 'ACTIVE', roles: [ra], joinedAt: now });
  });

  router.delete('/tenants/:tenantId/members/:userId', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (!isTenantOwnerOrAdmin(u.id, req.params.tenantId)) {
      sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
      return;
    }
    const idx = tenantMembers.findIndex((m) => m.tenantId === req.params.tenantId && m.userId === req.params.userId);
    if (idx >= 0) tenantMembers.splice(idx, 1);
    res.status(204).end();
  });

  router.get('/tenants/:tenantId/organizations/:orgId/teams', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    res.json(paginate(teams.filter((t) => t.organizationId === req.params.orgId), req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/organizations/:orgId/teams', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const { slug, name, description } = req.body as { slug?: string; name?: string; description?: string };
    if (!slug?.trim() || !name?.trim()) {
      sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'slug and name are required' });
      return;
    }
    const team = { id: makeUuid(), tenantId: req.params.tenantId, organizationId: req.params.orgId, slug: slug.trim(), name: name.trim(), description: description ?? null, createdAt: nowIso() };
    teams.push(team);
    recordAudit(req.params.tenantId, u.id, 'team.created', 'team', team.id, res.locals.requestId as string, { slug: team.slug });
    res.status(201).json(team);
  });

  router.delete('/tenants/:tenantId/organizations/:orgId/teams/:teamId', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const idx = teams.findIndex((t) => t.id === req.params.teamId && t.organizationId === req.params.orgId);
    if (idx >= 0) teams.splice(idx, 1);
    res.status(204).end();
  });

  router.get('/tenants/:tenantId/organizations/:orgId/teams/:teamId/members', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const items = teamMembers
      .filter((tm) => tm.teamId === req.params.teamId)
      .map((tm) => {
        const user = users.find((x) => x.id === tm.userId)!;
        return { user: { id: user.id, username: user.username, displayName: user.displayName }, addedAt: tm.addedAt };
      });
    res.json(paginate(items, req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/organizations/:orgId/teams/:teamId/members', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const { username } = req.body as { username?: string };
    const target = users.find((x) => x.username === username?.trim());
    if (!target) {
      sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'User not found in workspace' });
      return;
    }
    const now = nowIso();
    teamMembers.push({ teamId: req.params.teamId, userId: target.id, addedAt: now });
    res.status(201).json({ user: { id: target.id, username: target.username, displayName: target.displayName }, addedAt: now });
  });

  router.delete('/tenants/:tenantId/organizations/:orgId/teams/:teamId/members/:userId', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const idx = teamMembers.findIndex((tm) => tm.teamId === req.params.teamId && tm.userId === req.params.userId);
    if (idx >= 0) teamMembers.splice(idx, 1);
    res.status(204).end();
  });

  router.get('/tenants/:tenantId/role-assignments', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    res.json(paginate(roleAssignments.filter((a) => a.tenantId === req.params.tenantId), req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/role-assignments', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (!isTenantOwnerOrAdmin(u.id, req.params.tenantId)) {
      sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
      return;
    }
    const { roleKey, principalType, principalId, scopeType, scopeId } = req.body as {
      roleKey: string; principalType: 'user' | 'team'; principalId: string; scopeType: string; scopeId?: string;
    };
    const ra = {
      id: makeUuid(),
      tenantId: req.params.tenantId,
      roleKey,
      scope: scopeType,
      principalType,
      principalId,
      organizationId: scopeType === 'ORGANIZATION' ? (scopeId ?? null) : null,
      teamId: scopeType === 'TEAM' ? (scopeId ?? null) : null,
      repositoryId: scopeType === 'REPOSITORY' ? (scopeId ?? null) : null,
      createdAt: nowIso(),
    };
    roleAssignments.push(ra);
    res.status(201).json(ra);
  });

  router.delete('/tenants/:tenantId/role-assignments/:assignmentId', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (!isTenantOwnerOrAdmin(u.id, req.params.tenantId)) {
      sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
      return;
    }
    const idx = roleAssignments.findIndex((a) => a.id === req.params.assignmentId && a.tenantId === req.params.tenantId);
    if (idx >= 0) roleAssignments.splice(idx, 1);
    res.status(204).end();
  });

  router.get('/tenants/:tenantId/audit-logs', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (!isTenantOwnerOrAdmin(u.id, req.params.tenantId)) {
      sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
      return;
    }
    res.json(paginate(auditLogs.filter((l) => l.tenantId === req.params.tenantId), req.query.limit, req.query.cursor));
  });

  // Repositories
  router.get('/tenants/:tenantId/organizations/:orgId/repositories', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    res.json(paginate(repositories.filter((r) => r.organizationId === req.params.orgId), req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/organizations/:orgId/repositories', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const org = organizations.find((o) => o.id === req.params.orgId && o.tenantId === req.params.tenantId);
    if (!org) {
      sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Organization not found' });
      return;
    }
    const { name, description, visibility, defaultBranch } = req.body as {
      name?: string; description?: string; visibility?: 'PRIVATE' | 'PUBLIC'; defaultBranch?: string;
    };
    if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
      sendErr(res, {
        status: 400,
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: [{ field: 'name', message: 'name is not a valid repository name' }],
      });
      return;
    }
    if (repositories.some((r) => r.organizationId === org.id && r.name === name)) {
      sendErr(res, { status: 409, code: 'CONFLICT', message: `Repository ${org.slug}/${name} already exists` });
      return;
    }
    const now = nowIso();
    const repo = {
      id: makeUuid(),
      tenantId: req.params.tenantId,
      organizationId: org.id,
      owner: org.slug,
      name,
      fullName: `${org.slug}/${name}`,
      description: description ?? null,
      visibility: visibility ?? 'PRIVATE',
      status: 'ACTIVE',
      defaultBranch: defaultBranch || 'main',
      forkedFromId: null,
      cloneUrls: {
        https: `http://localhost:13000/git/${org.slug}/${name}.git`,
        ssh: `ssh://git@localhost:12222/${org.slug}/${name}.git`,
      },
      createdAt: now,
      updatedAt: now,
    };
    repositories.unshift(repo);
    const sha = crypto.randomBytes(20).toString('hex');
    branchesByRepo.set(repo.id, [{ name: repo.defaultBranch, protected: false, commitSha: sha, commitMessage: 'Initial commit' }]);
    commitsByRepo.set(repo.id, [{ sha, message: 'Initial commit\n', authorName: 'sep-platform', authorEmail: 'sep-platform@forgejo.internal', authoredAt: now, author: { id: null, username: 'system' }, parents: [] }]);
    indexStatusByRepo.set(repo.id, { status: 'NEVER', pollCount: 0, commitSha: sha, indexedAt: null });
    recordAudit(req.params.tenantId, u.id, 'repository.created', 'repository', repo.id, res.locals.requestId as string, { fullName: repo.fullName });
    res.status(201).json(repo);
  });

  router.get('/repositories/by-path/:owner/:name', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const repo = repositories.find((r) => r.owner === req.params.owner && r.name === req.params.name);
    if (!repo) {
      sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Not Found' });
      return;
    }
    res.json(repo);
  });

  router.get('/tenants/:tenantId/repositories/:repoId', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const repo = repositories.find((r) => r.id === req.params.repoId && r.tenantId === req.params.tenantId);
    if (!repo) {
      sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Not Found' });
      return;
    }
    res.json(repo);
  });

  router.patch('/tenants/:tenantId/repositories/:repoId', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const repo = repositories.find((r) => r.id === req.params.repoId && r.tenantId === req.params.tenantId);
    if (!repo) {
      sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Not Found' });
      return;
    }
    const { name, description, visibility, defaultBranch } = req.body as {
      name?: string; description?: string; visibility?: 'PRIVATE' | 'PUBLIC'; defaultBranch?: string;
    };
    if (name !== undefined) {
      repo.name = name;
      repo.fullName = `${repo.owner}/${name}`;
    }
    if (description !== undefined) repo.description = description;
    if (visibility !== undefined) repo.visibility = visibility;
    if (defaultBranch !== undefined) repo.defaultBranch = defaultBranch;
    repo.updatedAt = nowIso();
    res.json(repo);
  });

  router.delete('/tenants/:tenantId/repositories/:repoId', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const idx = repositories.findIndex((r) => r.id === req.params.repoId && r.tenantId === req.params.tenantId);
    if (idx >= 0) repositories.splice(idx, 1);
    res.status(204).end();
  });

  router.post('/tenants/:tenantId/repositories/:repoId/archive', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const repo = repositories.find((r) => r.id === req.params.repoId && r.tenantId === req.params.tenantId);
    if (!repo) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Not Found' });
    repo.status = 'ARCHIVED';
    res.json(repo);
  });

  router.post('/tenants/:tenantId/repositories/:repoId/unarchive', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const repo = repositories.find((r) => r.id === req.params.repoId && r.tenantId === req.params.tenantId);
    if (!repo) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Not Found' });
    repo.status = 'ACTIVE';
    res.json(repo);
  });

  router.post('/tenants/:tenantId/repositories/:repoId/forks', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const src = repositories.find((r) => r.id === req.params.repoId);
    if (!src) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Not Found' });
    const { tenantId, organizationId, name } = req.body as { tenantId: string; organizationId: string; name?: string };
    const org = organizations.find((o) => o.id === organizationId && o.tenantId === tenantId);
    if (!org) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Target organization not found' });
    const forkName = name || src.name;
    const now = nowIso();
    const fork = {
      ...src,
      id: makeUuid(),
      tenantId,
      organizationId,
      owner: org.slug,
      name: forkName,
      fullName: `${org.slug}/${forkName}`,
      forkedFromId: src.id,
      cloneUrls: {
        https: `http://localhost:13000/git/${org.slug}/${forkName}.git`,
        ssh: `ssh://git@localhost:12222/${org.slug}/${forkName}.git`,
      },
      createdAt: now,
      updatedAt: now,
    };
    repositories.unshift(fork);
    res.status(201).json(fork);
  });

  router.post('/tenants/:tenantId/repositories/:repoId/transfer', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const repo = repositories.find((r) => r.id === req.params.repoId && r.tenantId === req.params.tenantId);
    if (!repo) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Not Found' });
    const { tenantId, organizationId } = req.body as { tenantId: string; organizationId: string };
    const org = organizations.find((o) => o.id === organizationId && o.tenantId === tenantId);
    if (!org) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Target organization not found' });
    repo.tenantId = tenantId;
    repo.organizationId = organizationId;
    repo.owner = org.slug;
    repo.fullName = `${org.slug}/${repo.name}`;
    res.json(repo);
  });

  // Branches, commits, protections
  router.get('/tenants/:tenantId/repositories/:repoId/branches', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(paginate(branchesByRepo.get(req.params.repoId) ?? [], req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/repositories/:repoId/branches', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { name, from } = req.body as { name?: string; from?: string };
    if (!name?.trim() || !from?.trim()) {
      return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'name and from are required' });
    }
    const list = branchesByRepo.get(req.params.repoId) ?? [];
    const base = list.find((b) => b.name === from) ?? list[0];
    const branch = { name: name.trim(), protected: false, commitSha: base?.commitSha ?? crypto.randomBytes(20).toString('hex'), commitMessage: base?.commitMessage ?? 'Branch created' };
    list.push(branch);
    branchesByRepo.set(req.params.repoId, list);
    res.status(201).json(branch);
  });

  router.delete('/tenants/:tenantId/repositories/:repoId/branches', (req, res) => {
    if (!requireAuth(req, res)) return;
    const name = String(req.query.name ?? '');
    const list = branchesByRepo.get(req.params.repoId) ?? [];
    branchesByRepo.set(req.params.repoId, list.filter((b) => b.name !== name));
    res.status(204).end();
  });

  router.get('/tenants/:tenantId/repositories/:repoId/commits', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(paginate(commitsByRepo.get(req.params.repoId) ?? [], req.query.limit, req.query.cursor));
  });

  router.get('/tenants/:tenantId/repositories/:repoId/branch-protections', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(protectionsByRepo.get(req.params.repoId) ?? []);
  });

  router.put('/tenants/:tenantId/repositories/:repoId/branch-protections', (req, res) => {
    if (!requireAuth(req, res)) return;
    const body = req.body as { pattern: string; requiredApprovals?: number; allowDirectPush?: boolean; blockOnRejectedReviews?: boolean; dismissStaleApprovals?: boolean };
    const list = protectionsByRepo.get(req.params.repoId) ?? [];
    const entry = {
      pattern: body.pattern,
      requiredApprovals: body.requiredApprovals ?? 1,
      allowDirectPush: body.allowDirectPush ?? false,
      blockOnRejectedReviews: body.blockOnRejectedReviews ?? true,
      dismissStaleApprovals: body.dismissStaleApprovals ?? true,
    };
    const idx = list.findIndex((p) => p.pattern === body.pattern);
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
    protectionsByRepo.set(req.params.repoId, list);
    res.json(entry);
  });

  router.delete('/tenants/:tenantId/repositories/:repoId/branch-protections', (req, res) => {
    if (!requireAuth(req, res)) return;
    const pattern = String(req.query.pattern ?? '');
    const list = protectionsByRepo.get(req.params.repoId) ?? [];
    protectionsByRepo.set(req.params.repoId, list.filter((p) => p.pattern !== pattern));
    res.status(204).end();
  });

  // Pull requests
  router.get('/tenants/:tenantId/repositories/:repoId/pulls', (req, res) => {
    if (!requireAuth(req, res)) return;
    const state = String(req.query.state ?? 'open');
    const all = pullsByRepo.get(req.params.repoId) ?? [];
    const filtered = state === 'all' ? all : all.filter((p) => (state === 'closed' ? p.state !== 'open' : p.state === state));
    res.json(paginate(filtered, req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/repositories/:repoId/pulls', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const { title, body, head, base } = req.body as { title?: string; body?: string; head?: string; base?: string };
    if (!title?.trim() || !head?.trim() || !base?.trim()) {
      return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'title, head, and base are required' });
    }
    const list = pullsByRepo.get(req.params.repoId) ?? [];
    const nextNum = list.reduce((m, p) => Math.max(m, p.number), 0) + 1;
    const now = nowIso();
    const pr = {
      number: nextNum,
      title: title.trim(),
      body: body ?? '',
      state: 'open',
      author: { id: u.id, username: u.username },
      head: head.trim(),
      headSha: crypto.randomBytes(20).toString('hex'),
      base: base.trim(),
      mergeable: true,
      mergeCommitSha: null,
      mergedBy: null,
      mergedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    list.unshift(pr);
    pullsByRepo.set(req.params.repoId, list);
    res.status(201).json(pr);
  });

  router.get('/tenants/:tenantId/repositories/:repoId/pulls/:number', (req, res) => {
    if (!requireAuth(req, res)) return;
    const pr = (pullsByRepo.get(req.params.repoId) ?? []).find((p) => p.number === Number(req.params.number));
    if (!pr) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Pull request not found' });
    res.json(pr);
  });

  router.patch('/tenants/:tenantId/repositories/:repoId/pulls/:number', (req, res) => {
    if (!requireAuth(req, res)) return;
    const pr = (pullsByRepo.get(req.params.repoId) ?? []).find((p) => p.number === Number(req.params.number));
    if (!pr) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Pull request not found' });
    const { title, body, state } = req.body as { title?: string; body?: string; state?: string };
    if (title !== undefined) pr.title = title;
    if (body !== undefined) pr.body = body;
    if (state !== undefined) pr.state = state;
    pr.updatedAt = nowIso();
    res.json(pr);
  });

  router.post('/tenants/:tenantId/repositories/:repoId/pulls/:number/merge', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const pr = (pullsByRepo.get(req.params.repoId) ?? []).find((p) => p.number === Number(req.params.number));
    if (!pr) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Pull request not found' });
    pr.state = 'merged';
    pr.mergeCommitSha = crypto.randomBytes(20).toString('hex');
    pr.mergedBy = { id: u.id, username: u.username };
    pr.mergedAt = nowIso();
    pr.updatedAt = nowIso();
    res.json(pr);
  });

  router.get('/tenants/:tenantId/repositories/:repoId/pulls/:number/files', (req, res) => {
    if (!requireAuth(req, res)) return;
    const files = prFilesMap.get(`${req.params.repoId}:${req.params.number}`) ?? [];
    res.json(paginate(files, req.query.limit, req.query.cursor));
  });

  router.get('/tenants/:tenantId/repositories/:repoId/pulls/:number/reviews', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(prReviewsMap.get(`${req.params.repoId}:${req.params.number}`) ?? []);
  });

  router.post('/tenants/:tenantId/repositories/:repoId/pulls/:number/reviews', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const pr = (pullsByRepo.get(req.params.repoId) ?? []).find((p) => p.number === Number(req.params.number));
    if (!pr) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Pull request not found' });
    const { event, body, comments } = req.body as { event: string; body?: string; comments?: Array<{ path: string; body: string; line?: number }> };
    const key = `${req.params.repoId}:${req.params.number}`;
    const list = prReviewsMap.get(key) ?? [];
    const state = event === 'APPROVE' ? 'APPROVED' : event === 'REQUEST_CHANGES' ? 'REQUEST_CHANGES' : 'COMMENT';
    const review = {
      id: Date.now(),
      state,
      body: body ?? '',
      author: { id: u.id, username: u.username },
      commitSha: pr.headSha,
      stale: false,
      submittedAt: nowIso(),
      comments: (comments ?? []).map((c, idx) => ({
        id: Date.now() + idx + 1,
        path: c.path,
        body: c.body,
        line: c.line ?? null,
        author: { id: u.id, username: u.username },
      })),
    };
    list.push(review);
    prReviewsMap.set(key, list);
    res.status(201).json(review);
  });

  // Issues, labels, milestones
  function serializeIssue(repoId: string, issue: { number: number; title: string; body: string; state: string; author: { id: string | null; username: string }; comments: number; labelIds: number[]; milestoneId: number | null; createdAt: string; updatedAt: string; closedAt: string | null }) {
    const repoLabels = labelsByRepo.get(repoId) ?? [];
    const repoMilestones = milestonesByRepo.get(repoId) ?? [];
    return {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      author: issue.author,
      comments: issue.comments,
      labels: repoLabels.filter((l) => issue.labelIds.includes(l.id)),
      milestone: repoMilestones.find((m) => m.id === issue.milestoneId) ?? null,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      closedAt: issue.closedAt,
    };
  }

  router.get('/tenants/:tenantId/repositories/:repoId/issues', (req, res) => {
    if (!requireAuth(req, res)) return;
    const state = String(req.query.state ?? 'open');
    const all = issuesByRepo.get(req.params.repoId) ?? [];
    const filtered = (state === 'all' ? all : all.filter((i) => i.state === state)).map((i) => serializeIssue(req.params.repoId, i));
    res.json(paginate(filtered, req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/repositories/:repoId/issues', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const { title, body } = req.body as { title?: string; body?: string };
    if (!title?.trim()) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'title is required' });
    const list = issuesByRepo.get(req.params.repoId) ?? [];
    const num = list.reduce((m, i) => Math.max(m, i.number), 0) + 1;
    const now = nowIso();
    const issue = { number: num, title: title.trim(), body: body ?? '', state: 'open', author: { id: u.id, username: u.username }, comments: 0, labelIds: [], milestoneId: null, createdAt: now, updatedAt: now, closedAt: null };
    list.unshift(issue);
    issuesByRepo.set(req.params.repoId, list);
    res.status(201).json(serializeIssue(req.params.repoId, issue));
  });

  router.get('/tenants/:tenantId/repositories/:repoId/issues/:number', (req, res) => {
    if (!requireAuth(req, res)) return;
    const issue = (issuesByRepo.get(req.params.repoId) ?? []).find((i) => i.number === Number(req.params.number));
    if (!issue) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Issue not found' });
    res.json(serializeIssue(req.params.repoId, issue));
  });

  router.patch('/tenants/:tenantId/repositories/:repoId/issues/:number', (req, res) => {
    if (!requireAuth(req, res)) return;
    const issue = (issuesByRepo.get(req.params.repoId) ?? []).find((i) => i.number === Number(req.params.number));
    if (!issue) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Issue not found' });
    const { title, body, state } = req.body as { title?: string; body?: string; state?: string };
    if (title !== undefined) issue.title = title;
    if (body !== undefined) issue.body = body;
    if (state !== undefined) {
      issue.state = state;
      issue.closedAt = state === 'closed' ? nowIso() : null;
    }
    issue.updatedAt = nowIso();
    res.json(serializeIssue(req.params.repoId, issue));
  });

  router.get('/tenants/:tenantId/repositories/:repoId/issues/:number/comments', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(issueCommentsMap.get(`${req.params.repoId}:${req.params.number}`) ?? []);
  });

  router.post('/tenants/:tenantId/repositories/:repoId/issues/:number/comments', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const { body } = req.body as { body?: string };
    if (!body?.trim()) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'body is required' });
    const key = `${req.params.repoId}:${req.params.number}`;
    const list = issueCommentsMap.get(key) ?? [];
    const comment = { id: Date.now(), body: body.trim(), author: { id: u.id, username: u.username }, createdAt: nowIso() };
    list.push(comment);
    issueCommentsMap.set(key, list);
    const issue = (issuesByRepo.get(req.params.repoId) ?? []).find((i) => i.number === Number(req.params.number));
    if (issue) issue.comments = list.length;
    res.status(201).json(comment);
  });

  router.get('/tenants/:tenantId/repositories/:repoId/labels', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(labelsByRepo.get(req.params.repoId) ?? []);
  });

  router.post('/tenants/:tenantId/repositories/:repoId/labels', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { name, color, description } = req.body as { name?: string; color?: string; description?: string };
    if (!name?.trim() || !color?.trim()) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'name and color required' });
    const list = labelsByRepo.get(req.params.repoId) ?? [];
    const label = { id: Date.now(), name: name.trim(), color: color.trim(), description: description ?? '' };
    list.push(label);
    labelsByRepo.set(req.params.repoId, list);
    res.status(201).json(label);
  });

  router.delete('/tenants/:tenantId/repositories/:repoId/labels/:labelId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const list = labelsByRepo.get(req.params.repoId) ?? [];
    labelsByRepo.set(req.params.repoId, list.filter((l) => l.id !== Number(req.params.labelId)));
    res.status(204).end();
  });

  router.put('/tenants/:tenantId/repositories/:repoId/issues/:number/labels', (req, res) => {
    if (!requireAuth(req, res)) return;
    const issue = (issuesByRepo.get(req.params.repoId) ?? []).find((i) => i.number === Number(req.params.number));
    if (!issue) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Issue not found' });
    const { labelIds } = req.body as { labelIds: number[] };
    issue.labelIds = labelIds ?? [];
    const labels = (labelsByRepo.get(req.params.repoId) ?? []).filter((l) => issue.labelIds.includes(l.id));
    res.json(labels);
  });

  router.get('/tenants/:tenantId/repositories/:repoId/milestones', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(milestonesByRepo.get(req.params.repoId) ?? []);
  });

  router.post('/tenants/:tenantId/repositories/:repoId/milestones', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { title, description, dueOn } = req.body as { title?: string; description?: string; dueOn?: string };
    if (!title?.trim()) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'title is required' });
    const list = milestonesByRepo.get(req.params.repoId) ?? [];
    const m = { id: Date.now(), title: title.trim(), description: description ?? '', state: 'open', openIssues: 0, closedIssues: 0, dueOn: dueOn ?? null };
    list.push(m);
    milestonesByRepo.set(req.params.repoId, list);
    res.status(201).json(m);
  });

  router.put('/tenants/:tenantId/repositories/:repoId/issues/:number/milestone', (req, res) => {
    if (!requireAuth(req, res)) return;
    const issue = (issuesByRepo.get(req.params.repoId) ?? []).find((i) => i.number === Number(req.params.number));
    if (!issue) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Issue not found' });
    const { milestoneId } = req.body as { milestoneId: number | null };
    issue.milestoneId = milestoneId;
    res.status(204).end();
  });

  // Tags, releases, wiki, star, watch
  router.get('/tenants/:tenantId/repositories/:repoId/tags', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(paginate(tagsByRepo.get(req.params.repoId) ?? [], req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/repositories/:repoId/tags', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { name, target, message } = req.body as { name?: string; target?: string; message?: string };
    if (!name?.trim() || !target?.trim()) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'name and target required' });
    const list = tagsByRepo.get(req.params.repoId) ?? [];
    const tag = { name: name.trim(), commitSha: crypto.randomBytes(20).toString('hex'), message: message ?? '' };
    list.unshift(tag);
    tagsByRepo.set(req.params.repoId, list);
    res.status(201).json(tag);
  });

  router.delete('/tenants/:tenantId/repositories/:repoId/tags', (req, res) => {
    if (!requireAuth(req, res)) return;
    const name = String(req.query.name ?? '');
    const list = tagsByRepo.get(req.params.repoId) ?? [];
    tagsByRepo.set(req.params.repoId, list.filter((t) => t.name !== name));
    res.status(204).end();
  });

  router.get('/tenants/:tenantId/repositories/:repoId/releases', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(paginate(releasesByRepo.get(req.params.repoId) ?? [], req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/repositories/:repoId/releases', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const { tag, name, body, draft, prerelease } = req.body as { tag?: string; name?: string; body?: string; draft?: boolean; prerelease?: boolean };
    if (!tag?.trim()) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'tag is required' });
    const list = releasesByRepo.get(req.params.repoId) ?? [];
    const now = nowIso();
    const rel = { id: Date.now(), tag: tag.trim(), name: name?.trim() || tag.trim(), body: body ?? '', draft: !!draft, prerelease: !!prerelease, author: { id: u.id, username: u.username }, createdAt: now, publishedAt: draft ? null : now };
    list.unshift(rel);
    releasesByRepo.set(req.params.repoId, list);
    res.status(201).json(rel);
  });

  router.delete('/tenants/:tenantId/repositories/:repoId/releases/:releaseId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const list = releasesByRepo.get(req.params.repoId) ?? [];
    releasesByRepo.set(req.params.repoId, list.filter((r) => r.id !== Number(req.params.releaseId)));
    res.status(204).end();
  });

  router.get('/tenants/:tenantId/repositories/:repoId/wiki/pages', (req, res) => {
    if (!requireAuth(req, res)) return;
    const pages = wikiByRepo.get(req.params.repoId);
    if (!pages || pages.length === 0) {
      return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Not Found' });
    }
    res.json(pages.map(({ page, title, lastCommitSha, updatedAt }) => ({ page, title, lastCommitSha, updatedAt })));
  });

  router.get('/tenants/:tenantId/repositories/:repoId/wiki/page', (req, res) => {
    if (!requireAuth(req, res)) return;
    const slug = String(req.query.page ?? '');
    const page = (wikiByRepo.get(req.params.repoId) ?? []).find((p) => p.page === slug);
    if (!page) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Wiki page not found' });
    res.json(page);
  });

  router.post('/tenants/:tenantId/repositories/:repoId/wiki/pages', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { title, content } = req.body as { title?: string; content?: string };
    if (!title?.trim() || content === undefined) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'title and content required' });
    const list = wikiByRepo.get(req.params.repoId) ?? [];
    const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';
    const page = { page: slug, title: title.trim(), content, lastCommitSha: crypto.randomBytes(20).toString('hex'), updatedAt: nowIso() };
    list.push(page);
    wikiByRepo.set(req.params.repoId, list);
    res.status(201).json(page);
  });

  router.put('/tenants/:tenantId/repositories/:repoId/wiki/page', (req, res) => {
    if (!requireAuth(req, res)) return;
    const slug = String(req.query.page ?? '');
    const list = wikiByRepo.get(req.params.repoId) ?? [];
    const page = list.find((p) => p.page === slug);
    if (!page) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Wiki page not found' });
    const { title, content } = req.body as { title?: string; content: string };
    if (title !== undefined) page.title = title;
    page.content = content;
    page.updatedAt = nowIso();
    res.json(page);
  });

  router.delete('/tenants/:tenantId/repositories/:repoId/wiki/page', (req, res) => {
    if (!requireAuth(req, res)) return;
    const slug = String(req.query.page ?? '');
    const list = wikiByRepo.get(req.params.repoId) ?? [];
    wikiByRepo.set(req.params.repoId, list.filter((p) => p.page !== slug));
    res.status(204).end();
  });

  router.get('/tenants/:tenantId/repositories/:repoId/star', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    res.json({ starred: starsByRepo.get(req.params.repoId)?.has(u.id) ?? false });
  });

  router.put('/tenants/:tenantId/repositories/:repoId/star', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const set = starsByRepo.get(req.params.repoId) ?? new Set<string>();
    set.add(u.id);
    starsByRepo.set(req.params.repoId, set);
    res.json({ starred: true });
  });

  router.delete('/tenants/:tenantId/repositories/:repoId/star', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    starsByRepo.get(req.params.repoId)?.delete(u.id);
    res.json({ starred: false });
  });

  router.get('/tenants/:tenantId/repositories/:repoId/stargazers', (req, res) => {
    if (!requireAuth(req, res)) return;
    const ids = Array.from(starsByRepo.get(req.params.repoId) ?? []);
    res.json(paginate(ids.map((id) => {
      const user = users.find((x) => x.id === id);
      return { id, username: user?.username ?? id };
    }), req.query.limit, req.query.cursor));
  });

  router.get('/tenants/:tenantId/repositories/:repoId/subscription', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    res.json({ watching: watchesByRepo.get(req.params.repoId)?.has(u.id) ?? false });
  });

  router.put('/tenants/:tenantId/repositories/:repoId/subscription', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const set = watchesByRepo.get(req.params.repoId) ?? new Set<string>();
    set.add(u.id);
    watchesByRepo.set(req.params.repoId, set);
    res.json({ watching: true });
  });

  router.delete('/tenants/:tenantId/repositories/:repoId/subscription', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    watchesByRepo.get(req.params.repoId)?.delete(u.id);
    res.json({ watching: false });
  });

  router.get('/tenants/:tenantId/repositories/:repoId/watchers', (req, res) => {
    if (!requireAuth(req, res)) return;
    const ids = Array.from(watchesByRepo.get(req.params.repoId) ?? []);
    res.json(paginate(ids.map((id) => {
      const user = users.find((x) => x.id === id);
      return { id, username: user?.username ?? id };
    }), req.query.limit, req.query.cursor));
  });

  // Detection Rules, Search, Coverage, MITRE
  router.get('/tenants/:tenantId/repositories/:repoId/rules', (req, res) => {
    if (!requireAuth(req, res)) return;
    const sev = req.query.severity ? String(req.query.severity).split(',') : [];
    const st = req.query.status ? String(req.query.status).split(',') : [];
    const val = req.query.validationStatus ? String(req.query.validationStatus) : '';
    const tech = req.query.technique ? String(req.query.technique) : '';
    const tactic = req.query.tactic ? String(req.query.tactic) : '';
    const lang = req.query.language ? String(req.query.language) : '';
    const q = req.query.q ? String(req.query.q).toLowerCase() : '';

    const items = rules
      .filter((r) => r.repositoryId === req.params.repoId)
      .filter((r) => sev.length === 0 || (r.severity && sev.includes(r.severity)))
      .filter((r) => st.length === 0 || (r.status && st.includes(r.status)))
      .filter((r) => !val || r.validationStatus === val)
      .filter((r) => !tech || r.techniques.some((t) => t.startsWith(tech)))
      .filter((r) => !tactic || r.tactics.includes(tactic))
      .filter((r) => !lang || r.queryLanguage === lang)
      .filter((r) => !q || r.name.toLowerCase().includes(q));
    res.json(paginate(items, req.query.limit, req.query.cursor));
  });

  router.get('/tenants/:tenantId/repositories/:repoId/rules/index-status', (req, res) => {
    if (!requireAuth(req, res)) return;
    const st = indexStatusByRepo.get(req.params.repoId) ?? { status: 'NEVER', pollCount: 0, commitSha: null, indexedAt: null };
    if (st.status === 'INDEXING') {
      st.pollCount += 1;
      if (st.pollCount >= 2) {
        st.status = 'INDEXED';
        st.indexedAt = nowIso();
      }
    }
    const repoRulesCount = rules.filter((r) => r.repositoryId === req.params.repoId).length;
    res.json({
      status: st.status,
      commitSha: st.commitSha,
      indexedAt: st.indexedAt,
      report: {
        rules: repoRulesCount,
        changed: 0,
        deleted: 0,
        commitSha: st.commitSha ?? '',
        truncated: false,
        candidates: repoRulesCount,
        duplicates: [],
        invalidFiles: [],
      },
    });
  });

  router.post('/tenants/:tenantId/repositories/:repoId/rules/reindex', (req, res) => {
    if (!requireAuth(req, res)) return;
    const st = indexStatusByRepo.get(req.params.repoId) ?? { status: 'NEVER', pollCount: 0, commitSha: null, indexedAt: null };
    st.status = 'INDEXING';
    st.pollCount = 0;
    indexStatusByRepo.set(req.params.repoId, st);
    res.status(202).json({ status: 'INDEXING', commitSha: st.commitSha, indexedAt: st.indexedAt, report: null });
  });

  router.get('/tenants/:tenantId/repositories/:repoId/rules/validation', (req, res) => {
    if (!requireAuth(req, res)) return;
    const repoRules = rules.filter((r) => r.repositoryId === req.params.repoId);
    res.json({
      commitSha: '78bce0e60f3119bdc6f6d6b53367e61e56a45b0c',
      truncated: false,
      summary: {
        files: repoRules.length,
        valid: repoRules.filter((r) => r.validationStatus === 'VALID').length,
        warning: repoRules.filter((r) => r.validationStatus === 'WARNING').length,
        invalid: repoRules.filter((r) => r.validationStatus === 'INVALID').length,
      },
      files: repoRules.map((r) => ({
        path: r.path,
        ruleUid: r.ruleUid,
        name: r.name,
        validationStatus: r.validationStatus,
        issues: r.validationIssues,
      })),
    });
  });

  router.post('/tenants/:tenantId/repositories/:repoId/rules/validate', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { content } = req.body as { content?: string };
    if (!content?.trim()) {
      return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'content is required' });
    }
    try {
      const parsed = YAML.parse(content) as Record<string, unknown>;
      const issues: Array<{ severity: 'error' | 'warning'; code: string; message: string; field?: string }> = [];
      if (!parsed || typeof parsed !== 'object') {
        issues.push({ severity: 'error', code: 'INVALID_YAML', message: 'Rule YAML must parse to an object' });
      } else {
        if (!parsed.name && !parsed.title) {
          issues.push({ severity: 'error', code: 'MISSING_NAME', message: 'Rule name/title is required', field: 'name' });
        }
        if (!parsed.query && !parsed.detection) {
          issues.push({ severity: 'error', code: 'MISSING_QUERY', message: 'query.text or detection block is required', field: 'query' });
        }
        if (!parsed.severity && !parsed.level) {
          issues.push({ severity: 'warning', code: 'MISSING_SEVERITY', message: 'severity is recommended', field: 'severity' });
        }
      }
      const hasErrors = issues.some((i) => i.severity === 'error');
      const hasWarnings = issues.some((i) => i.severity === 'warning');
      const validationStatus = hasErrors ? 'INVALID' : hasWarnings ? 'WARNING' : 'VALID';
      res.json({
        kind: 'rule',
        validationStatus,
        issues,
        rule: hasErrors ? null : parsed,
      });
    } catch (e) {
      res.json({
        kind: 'rule',
        validationStatus: 'INVALID',
        issues: [{ severity: 'error', code: 'YAML_PARSE_ERROR', message: e instanceof Error ? e.message : 'YAML syntax error' }],
        rule: null,
      });
    }
  });

  router.get('/tenants/:tenantId/repositories/:repoId/rules/:ruleId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const r = rules.find((x) => x.id === req.params.ruleId && x.repositoryId === req.params.repoId);
    if (!r) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Rule not found' });
    const repo = repositories.find((x) => x.id === r.repositoryId)!;
    res.json({ ...r, repository: { id: repo.id, fullName: repo.fullName } });
  });

  router.get('/tenants/:tenantId/repositories/:repoId/rules/:ruleId/versions', (req, res) => {
    if (!requireAuth(req, res)) return;
    const r = rules.find((x) => x.id === req.params.ruleId && x.repositoryId === req.params.repoId);
    if (!r) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Rule not found' });
    res.json([
      {
        id: 'efa60a97-bd11-41a3-9b13-1a728af05495',
        commitSha: r.currentCommitSha ?? '78bce0e60f3119bdc6f6d6b53367e61e56a45b0c',
        path: r.path,
        validationStatus: r.validationStatus,
        validationIssues: r.validationIssues,
        document: {
          uid: r.ruleUid,
          name: r.name,
          format: 'sep.detection/v1',
          status: (r.status ?? 'TEST').toLowerCase(),
          severity: (r.severity ?? 'MEDIUM').toLowerCase(),
          query: { text: r.queryText, dialect: r.dialect, language: r.queryLanguage },
          tactics: r.tactics,
          techniques: r.techniques,
        },
        createdAt: r.updatedAt,
      },
    ]);
  });

  router.get('/tenants/:tenantId/rules/search', (req, res) => {
    if (!requireAuth(req, res)) return;
    const q = req.query.q ? String(req.query.q).toLowerCase() : '';
    const sev = req.query.severity ? String(req.query.severity).split(',') : [];
    const st = req.query.status ? String(req.query.status).split(',') : [];
    const val = req.query.validationStatus ? String(req.query.validationStatus) : '';
    const tech = req.query.technique ? String(req.query.technique) : '';
    const tactic = req.query.tactic ? String(req.query.tactic) : '';
    const lang = req.query.language ? String(req.query.language) : '';
    const repoId = req.query.repositoryId ? String(req.query.repositoryId) : '';

    const items = rules
      .filter((r) => r.tenantId === req.params.tenantId)
      .filter((r) => !repoId || r.repositoryId === repoId)
      .filter((r) => sev.length === 0 || (r.severity && sev.includes(r.severity)))
      .filter((r) => st.length === 0 || (r.status && st.includes(r.status)))
      .filter((r) => !val || r.validationStatus === val)
      .filter((r) => !tech || r.techniques.some((t) => t.startsWith(tech)))
      .filter((r) => !tactic || r.tactics.includes(tactic))
      .filter((r) => !lang || r.queryLanguage === lang)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          (r.description ?? '').toLowerCase().includes(q) ||
          r.queryText.toLowerCase().includes(q) ||
          r.techniques.some((t) => t.toLowerCase().includes(q)),
      )
      .map((r) => {
        const repo = repositories.find((x) => x.id === r.repositoryId)!;
        return {
          id: r.id,
          ruleUid: r.ruleUid,
          name: r.name,
          severity: r.severity,
          status: r.status,
          queryLanguage: r.queryLanguage,
          path: r.path,
          tactics: r.tactics,
          techniques: r.techniques,
          validationStatus: r.validationStatus,
          repository: { id: repo.id, tenantId: repo.tenantId, fullName: repo.fullName, visibility: repo.visibility },
        };
      });
    res.json(paginate(items, req.query.limit, req.query.cursor));
  });

  router.get('/tenants/:tenantId/rules/coverage', (req, res) => {
    if (!requireAuth(req, res)) return;
    const repoId = req.query.repositoryId ? String(req.query.repositoryId) : '';
    const activeRules = rules.filter((r) => r.tenantId === req.params.tenantId && (!repoId || r.repositoryId === repoId));
    const tactics = mitreTactics.map((tac) => {
      const techs = mitreTechniques.filter((t) => t.tactics.includes(tac.shortName));
      const techCells = techs.map((tech) => {
        const direct = activeRules.filter((r) => r.techniques.includes(tech.id)).length;
        const sub = activeRules.filter((r) => r.techniques.some((rt) => rt.startsWith(`${tech.id}.`))).length;
        return { id: tech.id, name: tech.name, rules: direct + sub, subTechniqueRules: sub };
      });
      return {
        id: tac.id,
        shortName: tac.shortName,
        name: tac.name,
        covered: techCells.filter((c) => c.rules > 0).length,
        total: techCells.length,
        techniques: techCells,
      };
    });
    res.json({ catalogVersion: '19.2', totalRules: activeRules.length, tactics });
  });

  router.get('/mitre/tactics', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json({ version: '19.2', items: mitreTactics });
  });

  router.get('/mitre/techniques', (req, res) => {
    if (!requireAuth(req, res)) return;
    const q = String(req.query.q ?? '').toLowerCase();
    const tactic = String(req.query.tactic ?? '');
    const items = mitreTechniques.filter(
      (t) => (!tactic || t.tactics.includes(tactic)) && (!q || t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)),
    );
    res.json(paginate(items, req.query.limit, req.query.cursor));
  });

  // Conversions & field mappings
  router.get('/conversions/dialects', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(conversionCatalog);
  });

  router.get('/tenants/:tenantId/organizations/:orgId/conversions', (req, res) => {
    if (!requireAuth(req, res)) return;
    const status = req.query.status ? String(req.query.status) : '';
    const items = conversions.filter((c) => c.organizationId === req.params.orgId && (!status || c.status === status));
    res.json(paginate(items, req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/organizations/:orgId/conversions', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const { sourceDialect, targetDialect, query, rule, mode, fieldMappingSetId, options } = req.body as {
      sourceDialect?: string;
      targetDialect?: string;
      query?: string;
      rule?: { repositoryId: string; ruleId: string };
      mode?: string;
      fieldMappingSetId?: string;
      options?: { xqlCaseSensitive?: boolean };
    };
    if (!targetDialect) {
      return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'targetDialect is required' });
    }
    let resolvedSource = sourceDialect;
    let sourceQuery = query ?? '';
    let sourceMeta: Record<string, unknown> = { type: 'query' };
    if (rule) {
      const foundRule = rules.find((r) => r.id === rule.ruleId && r.repositoryId === rule.repositoryId);
      if (!foundRule) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Source rule not found' });
      resolvedSource = foundRule.dialect ?? `${foundRule.queryLanguage}`;
      sourceQuery = foundRule.queryText;
      sourceMeta = { type: 'rule', repositoryId: rule.repositoryId, ruleId: rule.ruleId };
    }
    if (!sourceQuery.trim()) {
      return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'Query text is required' });
    }
    const id = makeUuid();
    const conv = {
      id,
      organizationId: req.params.orgId,
      sourceDialect: resolvedSource || 'microsoft-sentinel:kql',
      targetDialect,
      mode: mode || 'strict',
      status: 'QUEUED',
      source: sourceMeta,
      sourceQuery,
      fieldMappingSetId: fieldMappingSetId ?? null,
      options: { xqlCaseSensitive: options?.xqlCaseSensitive ?? null },
      errorCode: null,
      createdByUserId: u.id,
      createdAt: nowIso(),
      startedAt: null,
      completedAt: null,
      result: null,
      _polls: 0,
    };
    conversions.unshift(conv);
    res.status(202).json(conv);
  });

  router.get('/tenants/:tenantId/organizations/:orgId/conversions/:conversionId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const conv = conversions.find((c) => c.id === req.params.conversionId && c.organizationId === req.params.orgId) as Record<string, unknown> & { _polls?: number } | undefined;
    if (!conv) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Conversion not found' });

    if (conv.status === 'QUEUED' || conv.status === 'RUNNING') {
      conv._polls = (conv._polls ?? 0) + 1;
      if (conv._polls === 1) {
        conv.status = 'RUNNING';
        conv.startedAt = nowIso();
      } else {
        const srcQ = String(conv.sourceQuery ?? '');
        const isAssisted = conv.mode === 'assisted';
        const target = String(conv.targetDialect);
        let converted = srcQ;
        if (target === 'splunk:spl') {
          converted = `tag=process process_name="lsass.exe" /* converted from ${conv.sourceDialect} */`;
          if (srcQ.includes('FileName') || srcQ.includes('powershell')) {
            converted = 'tag=process tag=report process_name="powershell.exe" process="*-enc*"';
          }
        } else if (target === 'cortex-xsiam:xql') {
          converted = 'dataset = xdr_data\n| filter event_type = ENUM.PROCESS and action_process_image_name ~= "powershell.exe"';
        } else if (target === 'microsoft-sentinel:kql') {
          converted = 'DeviceProcessEvents\n| where FileName =~ "powershell.exe"';
        }
        conv.status = isAssisted ? 'SUCCEEDED_WITH_WARNINGS' : 'SUCCEEDED';
        conv.completedAt = nowIso();
        conv.result = {
          status: conv.status,
          method: isAssisted ? 'AI-assisted' : 'deterministic',
          query: converted,
          warnings: isAssisted ? [{ code: 'ASSISTED_REVIEW', message: 'Generated via assisted translation; review field semantics before production deployment.', severity: 'warning' }] : [],
          unsupported: [],
          fieldMappings: [
            { status: 'mapped', sourceField: 'action_process_image_name', targetField: 'process_name', canonicalField: 'process.name' },
          ],
          semanticDifferences: [],
          validation: { diagnostics: [], targetSyntaxValid: true, roundTripEquivalent: !isAssisted },
          reviewRequired: isAssisted,
          error: null,
          logicalSource: 'edr.process',
          ai: isAssisted ? { model: 'converter-assisted' } : null,
          engineVersion: '0.2.0',
          profile: { name: 'default', version: '2026.11.1' },
          createdAt: nowIso(),
        };
      }
    }
    res.json(conv);
  });

  router.post('/tenants/:tenantId/organizations/:orgId/conversions/validate-query', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { dialect, query } = req.body as { dialect?: string; query?: string };
    if (!dialect || !query?.trim()) {
      return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'dialect and query are required' });
    }
    const invalidPipe = query.trim().endsWith('|');
    res.json({
      dialect,
      valid: !invalidPipe,
      diagnostics: invalidPipe ? [{ message: 'Trailing pipe operator with no stage', severity: 'error', line: 1 }] : [],
    });
  });

  router.get('/tenants/:tenantId/organizations/:orgId/field-mappings', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(paginate(fieldMappings.filter((f) => f.organizationId === req.params.orgId), req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/organizations/:orgId/field-mappings', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { name, description, fields, sources } = req.body as { name?: string; description?: string; fields?: unknown[]; sources?: unknown[] };
    if (!name?.trim()) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'name is required' });
    const now = nowIso();
    const item = { id: makeUuid(), organizationId: req.params.orgId, name: name.trim(), description: description ?? null, fields: fields ?? [], sources: sources ?? [], version: 1, createdAt: now, updatedAt: now };
    fieldMappings.unshift(item);
    res.status(201).json(item);
  });

  router.put('/tenants/:tenantId/organizations/:orgId/field-mappings/:mappingId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const item = fieldMappings.find((f) => f.id === req.params.mappingId && f.organizationId === req.params.orgId);
    if (!item) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Field mapping set not found' });
    const { name, description, fields, sources, version } = req.body as { name: string; description?: string; fields: unknown[]; sources: unknown[]; version: number };
    if (item.version !== version) return sendErr(res, { status: 409, code: 'CONFLICT', message: 'Field mapping set was modified by someone else' });
    item.name = name;
    item.description = description ?? null;
    item.fields = fields;
    item.sources = sources;
    item.version = Number(item.version) + 1;
    item.updatedAt = nowIso();
    res.json(item);
  });

  router.delete('/tenants/:tenantId/organizations/:orgId/field-mappings/:mappingId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const idx = fieldMappings.findIndex((f) => f.id === req.params.mappingId && f.organizationId === req.params.orgId);
    if (idx >= 0) fieldMappings.splice(idx, 1);
    res.status(204).end();
  });

  // Integrations, Deployment Policy, Deployments, Connectors, Webhooks
  router.get('/integrations/providers', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json({ items: providers });
  });

  router.get('/tenants/:tenantId/organizations/:orgId/integrations', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(paginate(integrations.filter((i) => i.organizationId === req.params.orgId), req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/organizations/:orgId/integrations', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const { name, provider, environment, executionMode, connectorId, config } = req.body as {
      name?: string; provider?: string; environment?: string; executionMode?: string; connectorId?: string; config?: Record<string, unknown>;
    };
    if (!name?.trim() || !provider || !config?.baseUrl) {
      return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'name, provider, and config.baseUrl are required' });
    }
    const prov = providers.find((p) => p.key === provider);
    const now = nowIso();
    const item = {
      id: makeUuid(),
      organizationId: req.params.orgId,
      name: name.trim(),
      provider,
      environment: environment ?? 'PRODUCTION',
      executionMode: executionMode ?? 'DIRECT',
      connectorId: connectorId ?? null,
      config,
      status: 'ACTIVE',
      health: 'UNKNOWN',
      healthCheckedAt: null,
      capabilities: prov?.capabilities ?? ['rule.read', 'rule.create'],
      credential: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    integrations.unshift(item);
    recordAudit(req.params.tenantId, u.id, 'integration.created', 'integration', item.id, res.locals.requestId as string, { name: item.name, provider });
    res.status(201).json(item);
  });

  router.get('/tenants/:tenantId/organizations/:orgId/integrations/:integrationId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const item = integrations.find((i) => i.id === req.params.integrationId && i.organizationId === req.params.orgId);
    if (!item) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Integration not found' });
    res.json(item);
  });

  router.patch('/tenants/:tenantId/organizations/:orgId/integrations/:integrationId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const item = integrations.find((i) => i.id === req.params.integrationId && i.organizationId === req.params.orgId);
    if (!item) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Integration not found' });
    const { version, name, config, status } = req.body as { version: number; name?: string; config?: Record<string, unknown>; status?: string };
    if (item.version !== version) return sendErr(res, { status: 409, code: 'CONFLICT', message: 'Integration modified concurrently' });
    if (name !== undefined) item.name = name;
    if (config !== undefined) item.config = config;
    if (status !== undefined) item.status = status;
    item.version = Number(item.version) + 1;
    item.updatedAt = nowIso();
    res.json(item);
  });

  router.delete('/tenants/:tenantId/organizations/:orgId/integrations/:integrationId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const idx = integrations.findIndex((i) => i.id === req.params.integrationId && i.organizationId === req.params.orgId);
    if (idx >= 0) integrations.splice(idx, 1);
    res.status(204).end();
  });

  router.put('/tenants/:tenantId/organizations/:orgId/integrations/:integrationId/credential', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const item = integrations.find((i) => i.id === req.params.integrationId && i.organizationId === req.params.orgId);
    if (!item) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Integration not found' });
    const { kind, secret } = req.body as { kind?: string; secret?: string };
    if (!kind || !secret?.trim()) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'kind and secret are required' });
    const now = nowIso();
    item.credential = { kind, rotatedAt: now };
    item.updatedAt = now;
    integrationEvents.unshift({ id: makeUuid(), integrationId: item.id, type: 'credential.set', actorUserId: u.id, data: { kind }, createdAt: now });
    res.json(item);
  });

  router.delete('/tenants/:tenantId/organizations/:orgId/integrations/:integrationId/credential', (req, res) => {
    if (!requireAuth(req, res)) return;
    const item = integrations.find((i) => i.id === req.params.integrationId && i.organizationId === req.params.orgId);
    if (item) item.credential = null;
    res.status(204).end();
  });

  router.post('/tenants/:tenantId/organizations/:orgId/integrations/:integrationId/health-check', (req, res) => {
    if (!requireAuth(req, res)) return;
    const item = integrations.find((i) => i.id === req.params.integrationId && i.organizationId === req.params.orgId);
    if (!item) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Integration not found' });
    const hasCred = Boolean(item.credential);
    item.health = hasCred ? 'HEALTHY' : 'UNHEALTHY';
    item.healthCheckedAt = nowIso();
    integrationEvents.unshift({
      id: makeUuid(),
      integrationId: item.id,
      type: 'health.checked',
      actorUserId: null,
      data: { via: String(item.executionMode).toLowerCase(), healthy: hasCred, ...(hasCred ? {} : { errorCode: 'integration.credential_missing' }) },
      createdAt: nowIso(),
    });
    res.status(202).json({ integrationId: item.id, queued: true, connectorJobId: null });
  });

  router.get('/tenants/:tenantId/organizations/:orgId/integrations/:integrationId/events', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(paginate(integrationEvents.filter((e) => e.integrationId === req.params.integrationId), req.query.limit, req.query.cursor));
  });

  router.get('/tenants/:tenantId/organizations/:orgId/deployment-policy', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json({ ...deploymentPolicy, organizationId: req.params.orgId });
  });

  router.put('/tenants/:tenantId/organizations/:orgId/deployment-policy', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const body = req.body as Partial<typeof deploymentPolicy>;
    if (body.version !== undefined && body.version !== deploymentPolicy.version) {
      return sendErr(res, { status: 409, code: 'CONFLICT', message: 'Deployment policy was modified by someone else' });
    }
    deploymentPolicy = {
      ...deploymentPolicy,
      productionApprovals: body.productionApprovals ?? deploymentPolicy.productionApprovals,
      nonProductionApprovals: body.nonProductionApprovals ?? deploymentPolicy.nonProductionApprovals,
      allowSelfApprovalNonProduction: body.allowSelfApprovalNonProduction ?? deploymentPolicy.allowSelfApprovalNonProduction,
      allowWarningRules: body.allowWarningRules ?? deploymentPolicy.allowWarningRules,
      deploymentsEnabled: body.deploymentsEnabled ?? deploymentPolicy.deploymentsEnabled,
      version: deploymentPolicy.version + 1,
      updatedByUserId: u.id,
      updatedAt: nowIso(),
    };
    res.json(deploymentPolicy);
  });

  router.get('/tenants/:tenantId/organizations/:orgId/deployments', (req, res) => {
    if (!requireAuth(req, res)) return;
    const status = req.query.status ? String(req.query.status) : '';
    const integrationId = req.query.integrationId ? String(req.query.integrationId) : '';
    const items = deployments.filter(
      (d) => d.organizationId === req.params.orgId && (!status || d.status === status) && (!integrationId || d.integrationId === integrationId),
    );
    res.json(paginate(items, req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/organizations/:orgId/deployments', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const { integrationId, repositoryId, ruleId, action } = req.body as {
      integrationId?: string; repositoryId?: string; ruleId?: string; action?: string;
    };
    const integration = integrations.find((i) => i.id === integrationId);
    const rule = rules.find((r) => r.id === ruleId && r.repositoryId === repositoryId);
    if (!integration || !rule) {
      return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Integration or rule not found' });
    }
    const prov = providers.find((p) => p.key === integration.provider);
    if (prov && rule.dialect && !prov.dialects.includes(rule.dialect)) {
      return sendErr(res, {
        status: 422,
        code: 'RULE_NOT_DEPLOYABLE',
        message: `The target accepts ${prov.dialects.join(', ')} rules; convert the rule, commit it and deploy the committed rule`,
      });
    }
    const env = String(integration.environment);
    const requiredApprovals = env === 'PRODUCTION' ? deploymentPolicy.productionApprovals : deploymentPolicy.nonProductionApprovals;
    const allowSelf = env !== 'PRODUCTION' && deploymentPolicy.allowSelfApprovalNonProduction;
    const initialStatus = requiredApprovals === 0 ? 'QUEUED' : 'PENDING_APPROVAL';
    const now = nowIso();
    const dep = {
      id: makeUuid(),
      organizationId: req.params.orgId,
      integrationId: integration.id,
      action: action ?? 'DEPLOY',
      operation: (action ?? 'DEPLOY').toLowerCase(),
      status: initialStatus,
      environment: env,
      executionMode: integration.executionMode,
      rule: {
        repositoryId: rule.repositoryId,
        ruleId: rule.id,
        uid: rule.ruleUid,
        name: rule.name,
        severity: rule.severity,
        commitSha: rule.currentCommitSha ?? '78bce0e60f3119bdc6f6d6b53367e61e56a45b0c',
        blobSha: 'c4da5022c6cf577a062cc197bb1c4389911a614e',
        dialect: rule.dialect ?? rule.queryLanguage,
        query: rule.queryText,
      },
      rollbackOfId: null,
      requiredApprovals,
      allowSelfApproval: allowSelf,
      approvals: [],
      requestedByUserId: u.id,
      externalId: null,
      errorCode: null,
      attempts: 0,
      createdAt: now,
      approvedAt: initialStatus === 'QUEUED' ? now : null,
      startedAt: null,
      completedAt: null,
      _polls: 0,
    };
    deployments.unshift(dep);
    deploymentLogs.unshift({
      id: makeUuid(),
      deploymentId: dep.id,
      level: 'info',
      event: 'deployment.requested',
      message: 'Deployment requested',
      data: { environment: env, requiredApprovals },
      createdAt: now,
    });
    res.status(202).json(dep);
  });

  router.get('/tenants/:tenantId/organizations/:orgId/deployments/:deploymentId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const dep = deployments.find((d) => d.id === req.params.deploymentId && d.organizationId === req.params.orgId) as Record<string, unknown> & { _polls?: number } | undefined;
    if (!dep) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Deployment not found' });
    if (dep.status === 'QUEUED' || dep.status === 'RUNNING') {
      dep._polls = (dep._polls ?? 0) + 1;
      if (dep._polls === 1) {
        dep.status = 'RUNNING';
        dep.startedAt = nowIso();
        dep.attempts = 1;
        deploymentLogs.push({ id: makeUuid(), deploymentId: dep.id, level: 'info', event: 'deployment.started', message: 'Pushing detection rule to SIEM target', data: {}, createdAt: nowIso() });
      } else {
        dep.status = 'SUCCEEDED';
        dep.completedAt = nowIso();
        dep.externalId = `SEP-${String((dep.rule as { ruleId: string }).ruleId).slice(0, 8)}`;
        const targetRule = rules.find((r) => r.id === (dep.rule as { ruleId: string }).ruleId);
        if (targetRule) targetRule.deploymentStatus = dep.action === 'UNDEPLOY' ? 'NOT_DEPLOYED' : 'DEPLOYED';
        deploymentLogs.push({ id: makeUuid(), deploymentId: dep.id, level: 'info', event: 'deployment.succeeded', message: `Saved search ${dep.externalId} active on target`, data: { externalId: dep.externalId }, createdAt: nowIso() });
      }
    }
    res.json(dep);
  });

  router.get('/tenants/:tenantId/organizations/:orgId/deployments/:deploymentId/logs', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(paginate(deploymentLogs.filter((l) => l.deploymentId === req.params.deploymentId), req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/organizations/:orgId/deployments/:deploymentId/approve', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const dep = deployments.find((d) => d.id === req.params.deploymentId && d.organizationId === req.params.orgId);
    if (!dep) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Deployment not found' });
    if (dep.requestedByUserId === u.id && !dep.allowSelfApproval) {
      return sendErr(res, { status: 403, code: 'APPROVAL_NOT_ALLOWED', message: 'The requester cannot approve their own deployment' });
    }
    const { comment } = req.body as { comment?: string };
    const approvals = dep.approvals as Array<Record<string, unknown>>;
    approvals.push({ userId: u.id, username: u.username, decision: 'APPROVE', comment: comment ?? null, createdAt: nowIso() });
    if (approvals.length >= Number(dep.requiredApprovals)) {
      dep.status = 'QUEUED';
      dep.approvedAt = nowIso();
    }
    deploymentLogs.push({ id: makeUuid(), deploymentId: dep.id, level: 'info', event: 'deployment.approved', message: `Approved by ${u.username}`, data: { comment }, createdAt: nowIso() });
    res.json(dep);
  });

  router.post('/tenants/:tenantId/organizations/:orgId/deployments/:deploymentId/reject', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const dep = deployments.find((d) => d.id === req.params.deploymentId && d.organizationId === req.params.orgId);
    if (!dep) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Deployment not found' });
    const { comment } = req.body as { comment?: string };
    dep.status = 'REJECTED';
    dep.completedAt = nowIso();
    (dep.approvals as Array<Record<string, unknown>>).push({ userId: u.id, username: u.username, decision: 'REJECT', comment: comment ?? null, createdAt: nowIso() });
    deploymentLogs.push({ id: makeUuid(), deploymentId: dep.id, level: 'warn', event: 'deployment.rejected', message: `Rejected by ${u.username}`, data: { comment }, createdAt: nowIso() });
    res.json(dep);
  });

  router.post('/tenants/:tenantId/organizations/:orgId/deployments/:deploymentId/cancel', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const dep = deployments.find((d) => d.id === req.params.deploymentId && d.organizationId === req.params.orgId);
    if (!dep) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Deployment not found' });
    dep.status = 'CANCELLED';
    dep.completedAt = nowIso();
    deploymentLogs.push({ id: makeUuid(), deploymentId: dep.id, level: 'info', event: 'deployment.cancelled', message: `Cancelled by ${u.username}`, data: {}, createdAt: nowIso() });
    res.json(dep);
  });

  router.post('/tenants/:tenantId/organizations/:orgId/deployments/:deploymentId/rollback', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    const orig = deployments.find((d) => d.id === req.params.deploymentId && d.organizationId === req.params.orgId);
    if (!orig) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Deployment not found' });
    const now = nowIso();
    const rb = {
      ...orig,
      id: makeUuid(),
      action: 'ROLLBACK',
      operation: 'rollback',
      status: 'QUEUED',
      rollbackOfId: orig.id,
      requestedByUserId: u.id,
      approvals: [],
      createdAt: now,
      approvedAt: now,
      startedAt: null,
      completedAt: null,
      _polls: 0,
    };
    deployments.unshift(rb);
    res.status(202).json(rb);
  });

  // Connectors
  router.get('/tenants/:tenantId/organizations/:orgId/connectors', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(paginate(connectors.filter((c) => c.organizationId === req.params.orgId), req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/organizations/:orgId/connectors', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name?.trim()) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'name is required' });
    const now = nowIso();
    const c = { id: makeUuid(), organizationId: req.params.orgId, name: name.trim(), description: description ?? null, status: 'ACTIVE', health: 'PENDING', lastSeenAt: null, healthChangedAt: null, createdAt: now, updatedAt: now, instances: [] };
    connectors.unshift(c);
    res.status(201).json(c);
  });

  router.get('/tenants/:tenantId/organizations/:orgId/connectors/:connectorId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const c = connectors.find((x) => x.id === req.params.connectorId && x.organizationId === req.params.orgId);
    if (!c) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Connector not found' });
    res.json(c);
  });

  router.delete('/tenants/:tenantId/organizations/:orgId/connectors/:connectorId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const idx = connectors.findIndex((x) => x.id === req.params.connectorId && x.organizationId === req.params.orgId);
    if (idx >= 0) connectors.splice(idx, 1);
    res.status(204).end();
  });

  router.post('/tenants/:tenantId/organizations/:orgId/connectors/:connectorId/enrollment-tokens', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { ttlMinutes } = req.body as { ttlMinutes?: number };
    const token = `sep_cet_${crypto.randomBytes(16).toString('hex')}`;
    res.status(201).json({
      id: makeUuid(),
      token,
      displayPrefix: token.slice(0, 12),
      expiresAt: new Date(Date.now() + (ttlMinutes || 60) * 60000).toISOString(),
      gatewayUrl: 'https://localhost:18443',
    });
  });

  router.post('/tenants/:tenantId/organizations/:orgId/connectors/:connectorId/instances/:instanceId/revoke', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json({ revoked: true });
  });

  router.get('/tenants/:tenantId/organizations/:orgId/connectors/:connectorId/jobs', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json({ items: [], nextCursor: null });
  });

  // Webhooks
  router.get('/tenants/:tenantId/organizations/:orgId/webhooks', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(paginate(webhooks.filter((w) => w.organizationId === req.params.orgId), req.query.limit, req.query.cursor));
  });

  router.post('/tenants/:tenantId/organizations/:orgId/webhooks', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { url, description, events } = req.body as { url?: string; description?: string; events?: string[] };
    if (!url?.trim() || !events?.length) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'url and events are required' });
    const now = nowIso();
    const secret = `whsec_${crypto.randomBytes(16).toString('hex')}`;
    const w = { id: makeUuid(), organizationId: req.params.orgId, url: url.trim(), description: description ?? null, events, status: 'ACTIVE', disabledReason: null, consecutiveFailures: 0, version: 1, createdAt: now, updatedAt: now };
    webhooks.unshift(w);
    res.status(201).json({ ...w, secret });
  });

  router.patch('/tenants/:tenantId/organizations/:orgId/webhooks/:webhookId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const w = webhooks.find((x) => x.id === req.params.webhookId);
    if (!w) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Webhook not found' });
    const { version, status, url, events } = req.body as { version: number; status?: string; url?: string; events?: string[] };
    if (w.version !== version) return sendErr(res, { status: 409, code: 'CONFLICT', message: 'Webhook modified concurrently' });
    if (status) w.status = status;
    if (url) w.url = url;
    if (events) w.events = events;
    w.version = Number(w.version) + 1;
    w.updatedAt = nowIso();
    res.json(w);
  });

  router.delete('/tenants/:tenantId/organizations/:orgId/webhooks/:webhookId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const idx = webhooks.findIndex((x) => x.id === req.params.webhookId);
    if (idx >= 0) webhooks.splice(idx, 1);
    res.status(204).end();
  });

  router.post('/tenants/:tenantId/organizations/:orgId/webhooks/:webhookId/rotate-secret', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json({ secret: `whsec_${crypto.randomBytes(16).toString('hex')}` });
  });

  router.post('/tenants/:tenantId/organizations/:orgId/webhooks/:webhookId/ping', (req, res) => {
    if (!requireAuth(req, res)) return;
    const eventId = makeUuid();
    const now = nowIso();
    webhookDeliveries.unshift({ id: makeUuid(), webhookId: req.params.webhookId, eventId, eventType: 'webhook.ping', status: 'SUCCEEDED', attempts: 1, responseStatus: 200, errorCode: null, createdAt: now, lastAttemptAt: now, deliveredAt: now });
    res.status(202).json({ eventId });
  });

  router.get('/tenants/:tenantId/organizations/:orgId/webhooks/:webhookId/deliveries', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(paginate(webhookDeliveries.filter((d) => d.webhookId === req.params.webhookId), req.query.limit, req.query.cursor));
  });

  // Enterprise identity & service accounts
  router.get('/tenants/:tenantId/service-accounts', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json({ items: serviceAccounts.filter((s) => s.tenantId === req.params.tenantId) });
  });

  router.post('/tenants/:tenantId/service-accounts', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name?.trim()) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'name is required' });
    const now = nowIso();
    const sa = { id: makeUuid(), tenantId: req.params.tenantId, userId: makeUuid(), username: `svc-${crypto.randomBytes(6).toString('hex')}`, name: name.trim(), description: description ?? null, status: 'ACTIVE', createdAt: now, updatedAt: now };
    serviceAccounts.unshift(sa);
    res.status(201).json(sa);
  });

  router.delete('/tenants/:tenantId/service-accounts/:saId', (req, res) => {
    if (!requireAuth(req, res)) return;
    const idx = serviceAccounts.findIndex((s) => s.id === req.params.saId);
    if (idx >= 0) serviceAccounts.splice(idx, 1);
    res.status(204).end();
  });

  router.get('/tenants/:tenantId/service-accounts/:saId/api-keys', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json({ items: apiKeys.filter((k) => k.serviceAccountId === req.params.saId) });
  });

  router.post('/tenants/:tenantId/service-accounts/:saId/api-keys', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { name, expiresInDays } = req.body as { name?: string; expiresInDays?: number };
    if (!name?.trim()) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'name is required' });
    const key = `sep_key_${crypto.randomBytes(18).toString('hex')}`;
    const item = { id: makeUuid(), serviceAccountId: req.params.saId, name: name.trim(), displayPrefix: key.slice(0, 12), status: 'ACTIVE', expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : null, lastUsedAt: null, revokedAt: null, rotatedFromId: null, createdAt: nowIso() };
    apiKeys.unshift(item);
    res.status(201).json({ ...item, key });
  });

  router.post('/tenants/:tenantId/service-accounts/:saId/api-keys/:keyId/rotate', (req, res) => {
    if (!requireAuth(req, res)) return;
    const old = apiKeys.find((k) => k.id === req.params.keyId);
    const key = `sep_key_${crypto.randomBytes(18).toString('hex')}`;
    const item = { id: makeUuid(), serviceAccountId: req.params.saId, name: old ? String(old.name) : 'rotated', displayPrefix: key.slice(0, 12), status: 'ACTIVE', expiresAt: old?.expiresAt ?? null, lastUsedAt: null, revokedAt: null, rotatedFromId: req.params.keyId, createdAt: nowIso() };
    apiKeys.unshift(item);
    res.status(201).json({ ...item, key });
  });

  router.post('/tenants/:tenantId/service-accounts/:saId/api-keys/:keyId/revoke', (req, res) => {
    if (!requireAuth(req, res)) return;
    const k = apiKeys.find((x) => x.id === req.params.keyId);
    if (k) {
      k.status = 'REVOKED';
      k.revokedAt = nowIso();
    }
    res.json(k ?? { revoked: true });
  });

  router.get('/tenants/:tenantId/sso-connection', (req, res) => {
    if (!requireAuth(req, res)) return;
    if (!ssoConnection) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'No SSO connection' });
    res.json(ssoConnection);
  });

  router.put('/tenants/:tenantId/sso-connection', (req, res) => {
    if (!requireAuth(req, res)) return;
    ssoConnection = { ...req.body };
    res.json(ssoConnection);
  });

  router.delete('/tenants/:tenantId/sso-connection', (req, res) => {
    if (!requireAuth(req, res)) return;
    ssoConnection = null;
    res.status(204).end();
  });

  router.get('/tenants/:tenantId/security-policy', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(securityPolicy);
  });

  router.put('/tenants/:tenantId/security-policy', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { requireMfa, acceptedAcr } = req.body as { requireMfa: boolean; acceptedAcr?: string[] };
    securityPolicy = { requireMfa: Boolean(requireMfa), acceptedAcr: acceptedAcr ?? [], version: securityPolicy.version + 1 };
    res.json(securityPolicy);
  });

  router.get('/tenants/:tenantId/scim-tokens', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json({ items: scimTokens });
  });

  router.post('/tenants/:tenantId/scim-tokens', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { name, expiresInDays } = req.body as { name?: string; expiresInDays?: number };
    if (!name?.trim()) return sendErr(res, { status: 400, code: 'VALIDATION_FAILED', message: 'name is required' });
    const token = `sep_scim_${crypto.randomBytes(18).toString('hex')}`;
    const item = { id: makeUuid(), name: name.trim(), displayPrefix: token.slice(0, 12), status: 'ACTIVE', expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : null, lastUsedAt: null, createdAt: nowIso() };
    scimTokens.unshift(item);
    res.status(201).json({ ...item, token });
  });

  router.post('/tenants/:tenantId/scim-tokens/:tokenId/revoke', (req, res) => {
    if (!requireAuth(req, res)) return;
    const tok = scimTokens.find((t) => t.id === req.params.tokenId);
    if (tok) tok.status = 'REVOKED';
    res.json(tok ?? { revoked: true });
  });

  // Subscription & usage
  router.get('/tenants/:tenantId/subscription', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(subscriptionsByTenant.get(req.params.tenantId) ?? subscriptionsByTenant.get(TEAM_TENANT_ID));
  });

  router.get('/tenants/:tenantId/usage', (req, res) => {
    if (!requireAuth(req, res)) return;
    const memberCount = tenantMembers.filter((m) => m.tenantId === req.params.tenantId).length;
    const privateRepos = repositories.filter((r) => r.tenantId === req.params.tenantId && r.visibility === 'PRIVATE').length;
    const sub = (subscriptionsByTenant.get(req.params.tenantId) ?? subscriptionsByTenant.get(TEAM_TENANT_ID)) as { entitlements: Record<string, number> };
    res.json({
      periodStart: '2026-11-01T00:00:00.000Z',
      items: [
        { key: 'seats.max', description: 'Active human members', unit: 'count', limit: sub.entitlements['seats.max'], used: memberCount },
        { key: 'repositories.private.max', description: 'Private repositories', unit: 'count', limit: sub.entitlements['repositories.private.max'], used: privateRepos },
        { key: 'conversions.monthly', description: 'Query conversions this month', unit: 'count', limit: sub.entitlements['conversions.monthly'], used: conversions.length },
        { key: 'integrations.max', description: 'Configured SIEM integrations', unit: 'count', limit: sub.entitlements['integrations.max'], used: integrations.length },
        { key: 'connectors.max', description: 'Registered private connectors', unit: 'count', limit: sub.entitlements['connectors.max'], used: connectors.length },
      ],
    });
  });

  router.post('/tenants/:tenantId/subscription/plan-change', (req, res) => {
    if (!requireAuth(req, res)) return;
    const { planKey } = req.body as { planKey: string };
    const plan = plans.find((p) => p.key === planKey);
    if (!plan) return sendErr(res, { status: 400, code: 'INVALID_PLAN', message: 'Unknown plan key' });
    const sub = subscriptionsByTenant.get(req.params.tenantId) as { subscription: Record<string, unknown>; effectivePlan: Record<string, unknown>; entitlements: Record<string, number> } | undefined;
    if (sub) {
      sub.subscription.plan = { key: plan.key, name: plan.name };
      sub.subscription.requestedPlan = plan.key;
      sub.effectivePlan = { key: plan.key, name: plan.name, fallback: false };
      sub.entitlements = plan.entitlements;
    }
    res.status(202).json({ status: 'APPLIED', requestedPlan: planKey });
  });

  router.post('/tenants/:tenantId/subscription/cancel', (req, res) => {
    if (!requireAuth(req, res)) return;
    const sub = subscriptionsByTenant.get(req.params.tenantId) as { subscription: Record<string, unknown> } | undefined;
    if (sub) sub.subscription.cancelAtPeriodEnd = true;
    res.json(sub);
  });

  router.post('/tenants/:tenantId/subscription/resume', (req, res) => {
    if (!requireAuth(req, res)) return;
    const sub = subscriptionsByTenant.get(req.params.tenantId) as { subscription: Record<string, unknown> } | undefined;
    if (sub) sub.subscription.cancelAtPeriodEnd = false;
    res.json(sub);
  });

  // Platform operator routes (permitted for owner user)
  router.get('/platform/plans', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (u.id !== OWNER_ID) return sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Platform operator access required' });
    res.json({ items: plans });
  });

  router.put('/platform/plans/:planKey/entitlements', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (u.id !== OWNER_ID) return sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
    const plan = plans.find((p) => p.key === req.params.planKey);
    if (!plan) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Plan not found' });
    const { entitlements } = req.body as { entitlements: Record<string, number> };
    plan.entitlements = { ...plan.entitlements, ...entitlements };
    res.json(plan);
  });

  router.get('/platform/tenants', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (u.id !== OWNER_ID) return sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
    const slug = String(req.query.slug ?? '');
    const t = tenants.find((x) => x.slug === slug);
    if (!t) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Tenant not found' });
    res.json(t);
  });

  router.get('/platform/tenants/:tenantId/subscription', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (u.id !== OWNER_ID) return sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
    res.json(subscriptionsByTenant.get(req.params.tenantId) ?? subscriptionsByTenant.get(TEAM_TENANT_ID));
  });

  router.post('/platform/tenants/:tenantId/subscription', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (u.id !== OWNER_ID) return sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
    const { planKey } = req.body as { planKey: string };
    const plan = plans.find((p) => p.key === planKey);
    if (!plan) return sendErr(res, { status: 404, code: 'NOT_FOUND', message: 'Plan not found' });
    const sub = subscriptionsByTenant.get(req.params.tenantId) as { subscription: Record<string, unknown>; effectivePlan: Record<string, unknown>; entitlements: Record<string, number> } | undefined;
    if (sub) {
      sub.subscription.plan = { key: plan.key, name: plan.name };
      sub.effectivePlan = { key: plan.key, name: plan.name, fallback: false };
      sub.entitlements = plan.entitlements;
    }
    res.json(sub);
  });

  router.put('/platform/tenants/:tenantId/entitlement-overrides/:featureKey', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (u.id !== OWNER_ID) return sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
    const sub = subscriptionsByTenant.get(req.params.tenantId) as { overrides: Record<string, unknown>; entitlements: Record<string, number> } | undefined;
    const { value, reason } = req.body as { value: number; reason: string };
    if (sub) {
      sub.overrides[req.params.featureKey] = { value, reason };
      sub.entitlements[req.params.featureKey] = value;
    }
    res.json({ featureKey: req.params.featureKey, value, reason });
  });

  router.delete('/platform/tenants/:tenantId/entitlement-overrides/:featureKey', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (u.id !== OWNER_ID) return sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
    const sub = subscriptionsByTenant.get(req.params.tenantId) as { overrides: Record<string, unknown> } | undefined;
    if (sub) delete sub.overrides[req.params.featureKey];
    res.status(204).end();
  });

  router.get('/platform/git-instances', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (u.id !== OWNER_ID) return sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
    res.json({ items: gitInstances });
  });

  router.post('/platform/git-instances', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (u.id !== OWNER_ID) return sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
    const body = req.body as { name: string; baseUrl: string; sshHost?: string; sshPort?: number; adminUsername: string };
    const inst = { ...body, createdAt: nowIso() };
    gitInstances.push(inst);
    res.status(201).json(inst);
  });

  router.put('/platform/tenants/:tenantId/git-instance', (req, res) => {
    const u = requireAuth(req, res);
    if (!u) return;
    if (u.id !== OWNER_ID) return sendErr(res, { status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
    res.json({ tenantId: req.params.tenantId, instanceName: (req.body as { instanceName: string }).instanceName });
  });

  return router;
}
