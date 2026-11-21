# Security Engineering Platform (SEP)

A GitHub-inspired, multi-tenant detection engineering control plane built with React, TypeScript, Tailwind CSS, TanStack Query, and Express.

## Features

- **Landing & OIDC Authentication**: Product showcase, live plan cards, PKCE OAuth2/OIDC via `oidc-client-ts` (with in-memory token storage) and standalone sandbox identity switching (`Owner` vs `Deployment Approver`) when `VITE_OIDC_AUTHORITY` is unset.
- **Workspaces & Multi-Tenant Governance**: Personal and team tenants, organizations, members, teams, RBAC role catalogue & assignments, service accounts & API keys, SAML 2.0 SSO, security policy (MFA), SCIM 2.0 provisioning tokens, webhooks with HMAC signing & delivery logs, billing/usage meters, and audit logs.
- **Repositories & Collaboration**: HTTPS/SSH clone URLs, branch management, commit history, pull requests with changed-file summaries and inline review comments, merge methods (`merge`, `squash`, `rebase`), issues with labels and milestones, tags, releases, repository wiki, branch protection rules, star/watch/fork/archive/transfer/delete.
- **Detection Rules & ATT&CK Coverage**: Automatic rule indexing status polling, dry-run YAML validation, validation reports, workspace-wide rule search, rule detail view with version timeline, and 14-tactic MITRE ATT&CK Navigator heat map.
- **Query Dialect Conversion**: Two-pane conversion workspace across KQL, Splunk SPL, Cortex XQL, and Sigma with syntax validation, field mapping sets CRUD, and human-review notices.
- **SIEM Integrations, Connectors & Deployments**: Dynamic JSON-Schema provider configuration, write-only credentials, health checks, private-network connector enrollment tokens, deployment policy with optimistic concurrency, and separation-of-duties approval/reject/cancel/rollback workflows.
- **Gemini AI Tools**: Multi-turn Detection Engineering AI Assistant (`/ai-assistant`) and 1K/2K/4K Architecture Visual Studio (`/ai-studio` via `gemini-3-pro-image-preview`), proxied server-side through `@google/genai`.

## Environment Variables

See `.env.example`:

- `GEMINI_API_KEY`: Server-side Gemini API key (configured via Secrets).
- `SEP_BACKEND_URL`: Optional upstream SEP NestJS backend (e.g. `http://localhost:13000`). When omitted, `server.ts` mounts an in-memory contract server seeded from the OpenAPI specification.
- `VITE_OIDC_AUTHORITY`: Optional Keycloak / OIDC issuer URL (e.g. `http://localhost:18080/realms/sep`).
- `VITE_OIDC_CLIENT_ID`: OIDC client ID (defaults to `sep-web`).
- `VITE_API_BASE`: API prefix (defaults to `/api/v1`).

## Commands

```bash
# Development server (port 3000)
npm run dev

# Unit tests
npm test

# Lint & TypeScript check
npm run lint

# Production build
npm run build

# Start production server
npm start
```
