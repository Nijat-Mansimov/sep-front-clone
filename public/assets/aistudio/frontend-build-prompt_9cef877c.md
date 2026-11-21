# Prompt: build the frontend for the Security Engineering Platform

> Give this whole document to the AI that builds the frontend, together with:
>
> 1. `docs/api/openapi.json` — the API contract (request bodies, parameters, enums);
> 2. `docs/api/response-examples.json` — **real** responses for 100+ operations
>    (the contract for response shapes where OpenAPI has no schema);
> 3. screenshots of the github.com landing page (visual reference only);
> 4. optionally `docs/detection/sep-detection-v1.schema.json` (rule format).

---

## 1. Your task

Build a production-quality **web frontend** for the _Security Engineering
Platform_ (SEP) — a GitHub-style, multi-tenant SaaS for **detection
engineering**. The backend is finished and is the single source of truth. You
build only the frontend, as a **separate project** that talks to the backend's
REST API.

Hard rules:

1. **Every screen and action must map to a real backend endpoint** listed in
   this prompt / `openapi.json`. Never invent endpoints, fields, statuses or
   features. If something is not in the API, it does not exist in the UI —
   no placeholders, no "coming soon" pages, no fake data in production code.
2. **Visual design follows the github.com landing page and GitHub's product
   UI** from the screenshots you receive: layout, typography scale, spacing,
   density, component shapes (header, buttons, inputs, tabs, underline nav,
   cards, tables/lists, labels/badges, avatars, dropdown menus, dialogs,
   toasts, blankslates, progress bars, timelines, counters, breadcrumbs). You
   may use **every UI component pattern** you see there — but **replace the
   colours with the SEP palette in §6**. No GitHub logos, Octocat, product
   names, or copied marketing text/illustrations. Use our own name, logo
   placeholder (a simple shield mark) and copy.
3. **Do not design GitHub features that SEP does not have** (list in §7), not
   even as disabled items.
4. Accessibility (WCAG 2.2 AA), keyboard navigation, light **and** dark theme,
   responsive down to 360 px.
5. Security: tokens only in memory (refresh via the OIDC library), never in
   `localStorage`; render all user/repository content as text (it is
   untrusted input — no `dangerouslySetInnerHTML`; Markdown only through a
   sanitising renderer); show one-time secrets once with a copy button and a
   clear warning; never log tokens.

## 2. Recommended stack

React 19 + TypeScript (strict) + Vite, React Router, TanStack Query (server
state, polling), `openapi-typescript` (generate types from `openapi.json`) +
a thin typed `fetch` client, `oidc-client-ts` (Authorization Code + PKCE),
a headless component library (Radix UI or React Aria) styled with CSS
variables / Tailwind using the tokens in §6, Monaco or CodeMirror (read-only
query/YAML viewers, query editor for conversions), Vitest + Testing Library,
Playwright for end-to-end tests against the local backend. Use exact
versions that are at least two weeks old.

## 3. How the backend works (what you need to know)

**Architecture.** A NestJS REST API (`/api/v1`) in front of PostgreSQL (with
row-level security per tenant), Redis (job queues), OpenSearch (rule search),
Forgejo (internal Git hosting — users never see it), a Python query converter
and a background worker. Long operations (query conversion, rule indexing,
deployments, webhook delivery) are **asynchronous**: the API returns
`201/202` with a `status`, the frontend **polls** the resource until it
reaches a final status.

**Identity.** The platform stores no passwords. Users log in at an external
OIDC identity provider (Keycloak in development). The frontend obtains an
access token (Authorization Code + PKCE) and sends
`Authorization: Bearer <token>` on every request. On the first request the
backend provisions the user and a **personal workspace** automatically.

Local development values:

| Setting            | Value                                             |
| ------------------ | ------------------------------------------------- |
| Issuer / authority | `http://localhost:18080/realms/sep`               |
| Client id          | `sep-web` (public, PKCE S256)                     |
| Redirect URI       | `http://localhost:5173/*` (run Vite on port 5173) |
| Audience in token  | `sep-api` (added by the client's mapper)          |
| API base           | `http://localhost:13000/api/v1`                   |

The API sends **no CORS headers** by design: serve the frontend on the same
origin. In development configure the Vite dev server proxy
`/api → http://localhost:13000`; in production the reverse proxy / load
balancer routes `/api` and `/git` to the backend and everything else to the
frontend. Make issuer, client id and API base configurable via environment
variables.

**Tenancy model.**

- **Tenant = workspace** (`kind`: `INDIVIDUAL` personal, `TEAM`, `ENTERPRISE`).
  `GET /users/me` returns the user and their `memberships` (tenant + roles).
- Each team workspace has an **organization** (the URL namespace
  `/{owner}/{repo}`, like a GitHub org). Repositories, teams, integrations,
  connectors, deployments, webhooks, conversions and field mappings belong to
  an organization. `POST /organizations` creates a team workspace together
  with its organization.
- Routes are tenant-scoped: `/tenants/{tenantId}/...` and
  `/tenants/{tenantId}/organizations/{organizationId}/...`. Keep the selected
  workspace in the URL (e.g. `/:owner/...`) and resolve ids from it.
  `GET /repositories/by-path/{owner}/{name}` resolves a repository from a
  GitHub-style path.

**Authorization.** Roles (`GET /roles` returns the catalogue with
permissions and scope) are assigned at tenant, organization, team or
repository scope. The backend decides; the UI hides or disables controls the
user cannot use (derive from the user's roles and the role catalogue) and
must still handle `403` gracefully. A resource in another workspace returns
`404` (existence is not revealed).

**Conventions.**

| Topic                  | Rule                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lists                  | Cursor pagination: `?limit=&cursor=` → `{ "items": [...], "nextCursor": string \| null }` ("Load more" / infinite list)                                                                                                              |
| Errors                 | `{ "error": { "code", "message", "requestId", "details?" } }` — show `message`, map `details` to form fields, show `requestId` in a "Copy error details" affordance                                                                  |
| Status codes           | 400 validation · 401 re-authenticate · 403 no permission · 404 not found/hidden · 409 conflict (duplicate, stale `version`) · 422 domain rule (show `code`-specific text) · 429 limit/quota (show plan/usage link) · 503 retry later |
| Optimistic concurrency | Some resources carry `version`; send it back on update; on `409` reload and show a "changed by someone else" notice                                                                                                                  |
| One-time secrets       | API keys (`sep_key_…`), Git tokens (`sep_git_…`), webhook secrets (`whsec_…`), connector enrollment tokens (`sep_cet_…`), SCIM tokens: only in the create/rotate response                                                            |
| Request id             | Every response has `x-request-id`                                                                                                                                                                                                    |

**Important limitations — design around them, do not fake them:**

- There is **no file browser / blob / raw-file API**. Repository code is
  managed with Git (clone/push over HTTPS `/git/{owner}/{repo}.git` with a Git
  token, or SSH). The repository page shows: clone URLs + instructions,
  detection rules (from the rule index, default branch), branches, commits,
  pull requests, issues, releases, tags, wiki, settings.
- Pull request "files" returns **file names with status and +/- counts, no
  diff hunks**. Show a file list (like GitHub's "Files changed" header list),
  not a line diff. Rule content is available for the default branch via the
  rule detail endpoint.
- Conversion supports `strict` and `assisted` modes as returned by
  `GET /conversions/dialects` (use that list; do not hard-code modes or dialects).
- Deployments target Splunk and Cortex XSIAM only (`GET /integrations/providers`).
  A rule can be deployed only to a provider that accepts its dialect (else
  `422 RULE_NOT_DEPLOYABLE` — explain "convert the rule, commit it, then deploy").

## 4. Information architecture

Global header (GitHub-style): logo, workspace switcher, global rule search,
"+" create menu (new repository, new workspace, new conversion), notifications
bell with unread count, avatar menu (profile/settings, Git tokens, SSH keys,
sessions, theme, sign out).

Public (unauthenticated) pages:

- **Landing page** in the style of github.com's landing page (hero, feature
  sections, stats/cards, CTA, footer) describing **only real SEP features**:
  detections as code with Git + pull requests, automatic validation and
  MITRE ATT&CK coverage, query conversion XQL/SPL/KQL, approval-gated
  deployments to Splunk/XSIAM, connector agent for private networks, SSO/SCIM
  and audit for enterprises, plans (Community / Team / Enterprise from
  `GET /plans` after login, or static copy matching it). CTA "Sign in"
  starts the OIDC flow. No sign-up form (the IdP owns registration).
- OIDC callback and signed-out pages.

Authenticated app:

1. **Dashboard** — workspaces (memberships), recent repositories, recent
   conversions, deployments awaiting my approval, notifications.
2. **Workspace / organization overview** (`/:owner`) — tabs: Repositories,
   Rules (search), Coverage, Conversions, Deployments, Integrations,
   Connectors, Teams, People, Settings.
3. **Repository** (`/:owner/:repo`) — tabs: Code (clone URLs, default branch,
   latest commits, README-free overview with rule stats), Rules, Pull
   requests, Issues, Releases, Wiki, Settings; header with star/watch/fork
   counters and buttons.
4. **Rule detail** — metadata, query (read-only code viewer), MITRE mapping,
   validation issues, versions timeline, deploy button, "convert this rule".
5. **Conversion workspace** — two-pane editor (source dialect → target
   dialect), mode selector, field-mapping set selector, result with warnings,
   unsupported constructs, field mappings, method and confidence.
6. **Deployments** — list with status filter, detail with approval panel,
   logs timeline, cancel/rollback.
7. **Settings** (workspace) — General, Members, Teams, Roles, Service
   accounts & API keys, Security policy (MFA), SSO, SCIM, Webhooks, Billing &
   usage, Audit log.
8. **User settings** — Profile (read-only from IdP), Git tokens, SSH keys,
   Sessions, Notifications.
9. **Operator console** (`/_platform`) — only if `GET /platform/plans`
   succeeds (platform operators); otherwise never shown.

## 5. Features → endpoints (complete list)

All paths are relative to `/api/v1`. `{t}` = tenantId, `{o}` = organizationId,
`{r}` = repositoryId. Use `response-examples.json` for exact shapes.

### 5.1 Session, user, workspaces

| Feature                                | Endpoints                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current user + memberships             | `GET /users/me`                                                                                                                                        |
| Sessions list, sign out everywhere     | `GET /users/me/sessions`, `POST /users/me/sessions/revoke`                                                                                             |
| Workspaces list / detail / rename      | `GET /tenants`, `GET /tenants/{t}`, `PATCH /tenants/{t}`                                                                                               |
| Create team workspace (+ organization) | `POST /organizations`                                                                                                                                  |
| Organizations of a workspace           | `GET /tenants/{t}/organizations`, `GET/PATCH /tenants/{t}/organizations/{o}`                                                                           |
| Rename URL namespace                   | `POST /tenants/{t}/organizations/{o}/rename`                                                                                                           |
| Members                                | `GET/POST /tenants/{t}/members`, `DELETE /tenants/{t}/members/{userId}`                                                                                |
| Teams + team members                   | `GET/POST /tenants/{t}/organizations/{o}/teams`, `GET/DELETE .../teams/{teamId}`, `GET/POST .../teams/{teamId}/members`, `DELETE .../members/{userId}` |
| Roles catalogue                        | `GET /roles`                                                                                                                                           |
| Role assignments                       | `GET/POST /tenants/{t}/role-assignments`, `DELETE /tenants/{t}/role-assignments/{assignmentId}`                                                        |
| Audit log (filterable list)            | `GET /tenants/{t}/audit-logs`                                                                                                                          |
| Notifications                          | `GET /users/me/notifications`, `PATCH /users/me/notifications/{id}`, `POST /users/me/notifications/mark-all-read`                                      |

### 5.2 Git credentials

| Feature                                                          | Endpoints                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Personal Git tokens (scopes `git:read`, `git:write`; shown once) | `GET/POST /users/me/git-tokens`, `DELETE /users/me/git-tokens/{tokenId}` |
| SSH keys                                                         | `GET/POST /users/me/ssh-keys`, `DELETE /users/me/ssh-keys/{keyId}`       |

### 5.3 Repositories and collaboration

| Feature                                                           | Endpoints                                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Create / list repositories (visibility PRIVATE/PUBLIC)            | `POST/GET /tenants/{t}/organizations/{o}/repositories`                                                          |
| Resolve by path                                                   | `GET /repositories/by-path/{owner}/{name}`                                                                      |
| Detail, edit, delete                                              | `GET/PATCH/DELETE /tenants/{t}/repositories/{r}`                                                                |
| Archive / unarchive                                               | `POST .../{r}/archive`, `POST .../{r}/unarchive`                                                                |
| Fork, transfer                                                    | `POST .../{r}/forks`, `POST .../{r}/transfer`                                                                   |
| Branches (create, delete; default protected)                      | `GET/POST/DELETE .../{r}/branches`                                                                              |
| Commits                                                           | `GET .../{r}/commits`                                                                                           |
| Branch protection rules                                           | `GET/PUT/DELETE .../{r}/branch-protections`                                                                     |
| Pull requests: list, open, view, edit/close, merge                | `GET/POST .../{r}/pulls`, `GET/PATCH .../pulls/{number}`, `POST .../pulls/{number}/merge`                       |
| PR changed files (names + counts)                                 | `GET .../pulls/{number}/files`                                                                                  |
| PR reviews (approve / request changes / comment, inline comments) | `GET/POST .../pulls/{number}/reviews`                                                                           |
| Issues + comments                                                 | `GET/POST .../{r}/issues`, `GET/PATCH .../issues/{number}`, `GET/POST .../issues/{number}/comments`             |
| Labels, set issue labels                                          | `GET/POST .../{r}/labels`, `PATCH/DELETE .../labels/{labelId}`, `PUT .../issues/{number}/labels`                |
| Milestones, set issue milestone                                   | `GET/POST .../{r}/milestones`, `PATCH/DELETE .../milestones/{milestoneId}`, `PUT .../issues/{number}/milestone` |
| Tags, releases                                                    | `GET/POST/DELETE .../{r}/tags`, `GET/POST .../{r}/releases`, `GET/PATCH/DELETE .../releases/{releaseId}`        |
| Wiki (pages list, view, create, edit, delete; Markdown)           | `GET/POST .../{r}/wiki/pages`, `GET/PUT/DELETE .../{r}/wiki/page?page=<name>`                                   |
| Star, stargazers                                                  | `GET/PUT/DELETE .../{r}/star`, `GET .../{r}/stargazers`                                                         |
| Watch, watchers                                                   | `GET/PUT/DELETE .../{r}/subscription`, `GET .../{r}/watchers`                                                   |

Repository "Code" tab must show HTTPS and SSH clone URLs from the repository
object (`cloneUrls`) with copy buttons and a short "create a Git token" hint.

### 5.4 Detection rules, search, MITRE ATT&CK

| Feature                                                                          | Endpoints                                     |
| -------------------------------------------------------------------------------- | --------------------------------------------- |
| Rules of a repository (filters: severity, status, validation, technique, text)   | `GET .../{r}/rules`                           |
| Rule detail (metadata, `queryText`, MITRE, validation issues, deployment status) | `GET .../{r}/rules/{ruleId}`                  |
| Rule versions (per commit)                                                       | `GET .../{r}/rules/{ruleId}/versions`         |
| Index status (NEVER/INDEXING/INDEXED/PARTIAL/FAILED; poll while INDEXING)        | `GET .../{r}/rules/index-status`              |
| Validation report                                                                | `GET .../{r}/rules/validation`                |
| Validate a rule without saving (paste YAML → issues)                             | `POST .../{r}/rules/validate`                 |
| Re-index                                                                         | `POST .../{r}/rules/reindex`                  |
| Workspace rule search                                                            | `GET /tenants/{t}/rules/search`               |
| Public rule search (public repositories)                                         | `GET /rules/search`                           |
| ATT&CK coverage matrix (tactic columns × technique cells, counts)                | `GET /tenants/{t}/rules/coverage`             |
| ATT&CK catalogue                                                                 | `GET /mitre/tactics`, `GET /mitre/techniques` |

Severity values: CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL (see examples);
rule status EXPERIMENTAL/TEST/STABLE/DEPRECATED; validation VALID/WARNING/INVALID.
The coverage page is a heat-map grid in the style of the ATT&CK Navigator,
built with our palette.

### 5.5 Query conversion

| Feature                                                             | Endpoints                                                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Dialects and modes                                                  | `GET /conversions/dialects`                                                             |
| Start conversion (query or rule) → poll                             | `POST /tenants/{t}/organizations/{o}/conversions`, `GET .../conversions/{conversionId}` |
| History                                                             | `GET .../conversions`                                                                   |
| Syntax check                                                        | `POST .../conversions/validate-query`                                                   |
| Field-mapping sets (CRUD, table editor source field → target field) | `GET/POST .../field-mappings`, `GET/PUT/DELETE .../field-mappings/{mappingId}`          |

Statuses: QUEUED, RUNNING, SUCCEEDED, SUCCEEDED_WITH_WARNINGS, FAILED. Show
`result.query`, `result.warnings`, `result.unsupported`, `result.fieldMappings`,
`result.method` (deterministic / AI-assisted) and `errorCode` for failures.
Never present an AI-assisted result as verified: label it "requires review".

### 5.6 Integrations, deployments, connectors, webhooks

| Feature                                                                                    | Endpoints                                                                                                                      |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Provider catalogue (capabilities, dialects, credential kinds, JSON config schema)          | `GET /integrations/providers`                                                                                                  |
| Integrations CRUD (environment PRODUCTION/STAGING/DEVELOPMENT, execution DIRECT/CONNECTOR) | `GET/POST .../integrations`, `GET/PATCH/DELETE .../integrations/{id}`                                                          |
| Credential (write-only form; show only kind/updated time)                                  | `PUT/DELETE .../integrations/{id}/credential`                                                                                  |
| Health check, events timeline                                                              | `POST .../integrations/{id}/health-check`, `GET .../integrations/{id}/events`                                                  |
| Deployment policy (approvals required for production / non-production)                     | `GET/PUT .../deployment-policy`                                                                                                |
| Request deployment (integration + repository + rule, action DEPLOY/UNDEPLOY/ROLLBACK)      | `POST .../deployments`                                                                                                         |
| Deployments list / detail / logs                                                           | `GET .../deployments`, `GET .../deployments/{id}`, `GET .../deployments/{id}/logs`                                             |
| Approve / reject / cancel / rollback                                                       | `POST .../deployments/{id}/approve`, `/reject`, `/cancel`, `/rollback`                                                         |
| Connectors CRUD                                                                            | `GET/POST .../connectors`, `GET/PATCH/DELETE .../connectors/{id}`                                                              |
| Enrollment token (shown once, with install instructions)                                   | `POST .../connectors/{id}/enrollment-tokens`                                                                                   |
| Revoke an agent instance, job history                                                      | `POST .../connectors/{id}/instances/{instanceId}/revoke`, `GET .../connectors/{id}/jobs`                                       |
| Webhooks CRUD, rotate secret, ping, deliveries                                             | `GET/POST .../webhooks`, `GET/PATCH/DELETE .../webhooks/{id}`, `POST .../rotate-secret`, `POST .../ping`, `GET .../deliveries` |

Render the integration config form **from the provider's `configSchema`**
(JSON Schema). Deployment statuses: PENDING_APPROVAL, QUEUED, RUNNING,
SUCCEEDED, FAILED, REJECTED, CANCELLED — show a status timeline; poll while
not final. Authors cannot approve their own deployment (the API answers with
an error — show it). Connector health: PENDING, ONLINE, DEGRADED, OFFLINE.
Webhook events: `deployment.requested|approved|rejected|succeeded|failed`,
`connector.online|offline`, `conversion.completed`, `webhook.ping`.

### 5.7 Enterprise identity and access

| Feature                                                                | Endpoints                                                                                                             |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Service accounts CRUD                                                  | `GET/POST /tenants/{t}/service-accounts`, `GET/PATCH/DELETE .../service-accounts/{id}`                                |
| API keys (create shown once, rotate with grace, revoke, last used)     | `GET/POST .../service-accounts/{id}/api-keys`, `POST .../api-keys/{keyId}/rotate`, `POST .../api-keys/{keyId}/revoke` |
| SAML SSO connection (configure, enforce, remove; 404 = not configured) | `GET/PUT/DELETE /tenants/{t}/sso-connection`                                                                          |
| Security policy (MFA requirement)                                      | `GET/PUT /tenants/{t}/security-policy`                                                                                |
| SCIM tokens (create shown once, revoke) + display the SCIM base URL    | `GET/POST /tenants/{t}/scim-tokens`, `POST .../scim-tokens/{tokenId}/revoke`                                          |

### 5.8 Plans, subscription, usage

| Feature                                                                                    | Endpoints                                                          |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Plan comparison table                                                                      | `GET /plans`                                                       |
| Current subscription (status TRIALING/ACTIVE/PAST_DUE/CANCELED/EXPIRED, trial end, period) | `GET /tenants/{t}/subscription`                                    |
| Usage meters (used vs limit per feature key, progress bars)                                | `GET /tenants/{t}/usage`                                           |
| Change plan / cancel / resume                                                              | `POST /tenants/{t}/subscription/plan-change`, `/cancel`, `/resume` |

When the API returns a quota/limit error (`429`/`402`/`403` with an
entitlement code), show an inline banner linking to Billing & usage. There is
no card-payment form; if a plan change response contains a checkout URL,
redirect to it, otherwise show the pending request.

### 5.9 Operator console (platform operators only)

`GET /platform/plans`, `PUT /platform/plans/{planKey}/entitlements`,
`GET /platform/tenants`, `GET/POST /platform/tenants/{t}/subscription`,
`PUT/DELETE /platform/tenants/{t}/entitlement-overrides/{featureKey}`,
`GET/POST /platform/git-instances`, `PUT /platform/tenants/{t}/git-instance`.

### 5.10 Not for the frontend

`/health/*`, `/system/diagnostics/*`, `/billing/webhooks/*`, `/scim/v2/*`
(called by identity providers), `/internal/*`, `/git/*` (Git clients only).

## 6. SEP colour palette (replace GitHub's colours)

Keep GitHub's neutral, high-density feel but with our own identity: a deep
ink/graphite base, **teal** as the primary brand/action colour, **amber** as
the accent, and dedicated severity colours. Define everything as CSS custom
properties; components must never use raw hex values.

| Token                                       | Light     | Dark      |
| ------------------------------------------- | --------- | --------- |
| `--bg-canvas`                               | `#F7F9FB` | `#0A0F17` |
| `--bg-surface`                              | `#FFFFFF` | `#111823` |
| `--bg-subtle`                               | `#EEF2F6` | `#18212F` |
| `--border-default`                          | `#D5DDE5` | `#263243` |
| `--border-muted`                            | `#E4E9EF` | `#1C2634` |
| `--fg-default`                              | `#0F1A26` | `#E6EDF5` |
| `--fg-muted`                                | `#506176` | `#93A4B8` |
| `--fg-on-emphasis`                          | `#FFFFFF` | `#04110F` |
| `--brand-primary` (buttons, links, focus)   | `#0F8C7E` | `#2CC5B3` |
| `--brand-primary-hover`                     | `#0B7166` | `#4FD6C6` |
| `--brand-primary-subtle`                    | `#E1F5F2` | `#0E2E2B` |
| `--accent` (highlights, hero gradient stop) | `#D98A1C` | `#F2A93B` |
| `--success`                                 | `#1E8E4E` | `#3FCB7B` |
| `--warning`                                 | `#B7791F` | `#E3B341` |
| `--danger`                                  | `#C93C3C` | `#F26B6B` |
| `--info`                                    | `#2F6FD6` | `#6EA8FF` |
| `--sev-critical`                            | `#8E1B3A` | `#FF5C8A` |
| `--sev-high`                                | `#C93C3C` | `#F26B6B` |
| `--sev-medium`                              | `#D98A1C` | `#F2A93B` |
| `--sev-low`                                 | `#2F6FD6` | `#6EA8FF` |
| `--sev-info`                                | `#506176` | `#93A4B8` |

Landing-page hero: dark canvas with a teal → amber gradient glow (instead of
GitHub's purple/green), product screenshots of _our_ UI. Coverage heat map:
scale from `--bg-subtle` (0 rules) through `--brand-primary-subtle` to
`--brand-primary` (many rules). Status badges: success/warning/danger/info
tokens. Check contrast ≥ 4.5:1 for text in both themes.

## 7. GitHub features you must NOT design (the backend has no API for them)

Actions/CI workflows, Copilot or any AI chat, Codespaces, Packages/registry,
Projects boards, Discussions, Sponsors, Marketplace, Gists, Pages, Security
tab (code scanning, Dependabot, secret scanning alerts), Insights/graphs
(contributors, traffic, pulse), file browser / code view / blame / web file
editor / "Add file", commit diff pages, line-by-line PR diff, code search,
public user profiles with contribution graphs, followers/following, Explore /
Trending, organization directory, sign-up / password / 2FA forms (handled by
the identity provider), email settings, card payment forms, merge queue,
environments/secrets settings of Actions, repository templates, CODEOWNERS
UI.

## 8. Quality bar and deliverables

- Typed API client generated from `openapi.json`; response types for
  operations without schemas written from `response-examples.json`.
- Central error handling (401 → re-login, 403/404/409/422/429 messages),
  loading skeletons, empty states (blankslates), optimistic updates only where
  safe (stars, notifications), polling with back-off for async statuses.
- Permission-aware UI from `GET /roles` + memberships; never rely on hiding
  alone.
- Unit tests for components and the API client; Playwright end-to-end tests
  against the local stack (sign in via the dev realm, create a workspace and
  repository, push a rule with the shown Git commands, watch it get indexed,
  convert a query, request and approve a deployment with a second user).
- `README` with setup (`npm install`, env variables, `npm run dev` on port
  5173 with the `/api` proxy), build, test and lint commands; Dockerfile
  (non-root, static files behind nginx-unprivileged) and an nginx config that
  proxies `/api` and `/git` to the backend.
- No secrets in the repository; no analytics or third-party trackers.
