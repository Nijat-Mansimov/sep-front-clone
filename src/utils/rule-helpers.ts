import { SepApiError } from '../api/client';
import type { ConversionStatus, DeploymentStatus, IndexStatusValue, RuleSeverity } from '../api/types';

export const SEVERITY_ORDER: Record<RuleSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFORMATIONAL: 1,
};

export function formatSeverityLabel(sev: RuleSeverity | null | undefined): string {
  if (!sev) return 'Unspecified';
  return sev.charAt(0) + sev.slice(1).toLowerCase();
}

export function getCoverageIntensity(ruleCount: number): 0 | 1 | 2 | 3 {
  if (ruleCount <= 0) return 0;
  if (ruleCount === 1) return 1;
  if (ruleCount <= 3) return 2;
  return 3;
}

export function isConversionTerminal(status: ConversionStatus | undefined): boolean {
  return status === 'SUCCEEDED' || status === 'SUCCEEDED_WITH_WARNINGS' || status === 'FAILED';
}

export function isDeploymentTerminal(status: DeploymentStatus | undefined): boolean {
  return status === 'SUCCEEDED' || status === 'FAILED' || status === 'REJECTED' || status === 'CANCELLED';
}

export function isIndexTerminal(status: IndexStatusValue | undefined): boolean {
  return status === 'INDEXED' || status === 'PARTIAL' || status === 'FAILED' || status === 'NEVER';
}

export function formatApiErrorCopyText(err: unknown): string {
  if (err instanceof SepApiError) {
    return JSON.stringify(
      {
        status: err.status,
        code: err.code,
        message: err.message,
        requestId: err.requestId,
        details: err.details ?? [],
      },
      null,
      2,
    );
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60 && diffSec >= -60) return 'just now';
  if (diffSec < 3600 && diffSec > 0) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400 && diffSec > 0) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 2592000 && diffSec > 0) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toISOString().slice(0, 10);
}

export function formatBytes(bytes: number): string {
  if (bytes < 0) return 'Unlimited';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i += 1;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

export interface DialectLike {
  id: string;
  language?: string;
  aliases?: string[];
}

export function resolveDialectId(
  dialects: DialectLike[],
  preferred: string | null | undefined,
  fallbackIndex = 0,
): string {
  if (dialects.length === 0) return preferred ?? '';
  if (preferred) {
    const normalized = preferred.trim().toLowerCase();
    const exact = dialects.find((d) => d.id.toLowerCase() === normalized);
    if (exact) return exact.id;
    const byAlias = dialects.find((d) =>
      (d.aliases ?? []).some((a) => a.toLowerCase() === normalized),
    );
    if (byAlias) return byAlias.id;
    const byLang = dialects.find(
      (d) =>
        d.language?.toLowerCase() === normalized ||
        d.id.toLowerCase().endsWith(`:${normalized}`),
    );
    if (byLang) return byLang.id;
  }
  const idx = Math.max(0, Math.min(fallbackIndex, dialects.length - 1));
  return dialects[idx].id;
}

