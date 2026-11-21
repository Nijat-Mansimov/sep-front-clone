import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Database,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { FieldEntryDto, FieldMappingSetDto, SourceEntryDto } from '../api/types';
import { StatusBadge } from '../components/ui/Badge';
import { Blankslate } from '../components/ui/Blankslate';
import { Button } from '../components/ui/Button';
import { CodeViewer } from '../components/ui/CodeViewer';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { SkeletonRows } from '../components/ui/Skeleton';
import { formatRelativeTime, isConversionTerminal, resolveDialectId } from '../utils/rule-helpers';

export function ConversionsView({
  tenantId,
  tenantSlug,
  orgId,
}: {
  tenantId: string;
  tenantSlug: string;
  orgId: string;
}) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const initialRepoId = searchParams.get('repositoryId') ?? '';
  const initialRuleId = searchParams.get('ruleId') ?? '';

  const [subTab, setSubTab] = useState<'converter' | 'mappings'>('converter');

  // Converter state
  const [inputMode, setInputMode] = useState<'query' | 'rule'>(
    initialRepoId && initialRuleId ? 'rule' : 'query',
  );
  const [sourceDialect, setSourceDialect] = useState('kql');
  const [targetDialect, setTargetDialect] = useState('spl');
  const [mode, setMode] = useState('strict');
  const [fieldMappingSetId, setFieldMappingSetId] = useState('');
  const [xqlCaseSensitive, setXqlCaseSensitive] = useState(false);
  const [queryText, setQueryText] = useState(
    'DeviceProcessEvents\n| where FileName =~ "powershell.exe" and ProcessCommandLine has "-EncodedCommand"',
  );
  const [selectedRuleRepoId, setSelectedRuleRepoId] = useState(initialRepoId);
  const [selectedRuleId, setSelectedRuleId] = useState(initialRuleId);
  const [activeConversionId, setActiveConversionId] = useState<string | null>(null);
  const [syntaxValidation, setSyntaxValidation] = useState<{
    dialect: string;
    valid: boolean;
    diagnostics: Array<{ message: string; severity?: string; line?: number; column?: number }>;
  } | null>(null);

  const { data: catalog } = useQuery({
    queryKey: ['conversion-dialects'],
    queryFn: () => api.getConversionDialects(),
  });

  const { data: mappingsPage } = useQuery({
    queryKey: ['field-mappings', tenantId, orgId],
    queryFn: () => api.listFieldMappings(tenantId, orgId, { limit: 50 }),
  });

  const { data: conversionsPage, isLoading: listLoading } = useQuery({
    queryKey: ['conversions', tenantId, orgId],
    queryFn: () => api.listConversions(tenantId, orgId, { limit: 25 }),
  });

  const { data: prefilledRule } = useQuery({
    queryKey: ['prefilled-rule', tenantId, selectedRuleRepoId, selectedRuleId],
    queryFn: () => api.getRule(tenantId, selectedRuleRepoId, selectedRuleId),
    enabled: Boolean(selectedRuleRepoId && selectedRuleId),
  });

  const dialects = catalog?.dialects ?? [];
  const sourceDialects = dialects.filter((d) => d.source);
  const targetDialects = dialects.filter((d) => d.target);

  useEffect(() => {
    if (sourceDialects.length > 0 && !sourceDialects.some((d) => d.id === sourceDialect)) {
      setSourceDialect(resolveDialectId(sourceDialects, sourceDialect || 'kql'));
    }
    if (targetDialects.length > 0 && !targetDialects.some((d) => d.id === targetDialect)) {
      setTargetDialect(resolveDialectId(targetDialects, targetDialect || 'spl', 1));
    }
  }, [catalog]);

  useEffect(() => {
    if (prefilledRule) {
      setQueryText(prefilledRule.queryText);
      const preferred = prefilledRule.dialect ?? prefilledRule.queryLanguage;
      if (preferred) {
        setSourceDialect(
          sourceDialects.length > 0
            ? resolveDialectId(sourceDialects, preferred)
            : preferred,
        );
      }
    }
  }, [prefilledRule, catalog]);

  const { data: activeConversion } = useQuery({
    queryKey: ['conversion-detail', tenantId, orgId, activeConversionId],
    queryFn: () => api.getConversion(tenantId, orgId, activeConversionId!),
    enabled: Boolean(activeConversionId),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return isConversionTerminal(status) ? false : 1500;
    },
  });

  useEffect(() => {
    if (activeConversion && isConversionTerminal(activeConversion.status)) {
      queryClient.invalidateQueries({ queryKey: ['conversions', tenantId, orgId] });
    }
  }, [activeConversion, queryClient, tenantId, orgId]);

  const isXqlDialect = (id: string) =>
    id === 'xql' ||
    id.toLowerCase().endsWith(':xql') ||
    dialects.find((d) => d.id === id)?.language?.toLowerCase() === 'xql';

  const validateSyntaxMutation = useMutation({
    mutationFn: () =>
      api.validateQuerySyntax(tenantId, orgId, {
        dialect: sourceDialect,
        query: queryText,
        options: isXqlDialect(sourceDialect) ? { xqlCaseSensitive } : undefined,
      }),
    onSuccess: (res) => setSyntaxValidation(res),
  });

  const convertMutation = useMutation({
    mutationFn: () =>
      api.createConversion(
        tenantId,
        orgId,
        inputMode === 'rule' && selectedRuleRepoId && selectedRuleId
          ? {
              rule: { repositoryId: selectedRuleRepoId, ruleId: selectedRuleId },
              targetDialect,
              mode,
              fieldMappingSetId: fieldMappingSetId || undefined,
              options:
                isXqlDialect(targetDialect) || isXqlDialect(sourceDialect)
                  ? { xqlCaseSensitive }
                  : undefined,
            }
          : {
              sourceDialect,
              targetDialect,
              query: queryText,
              mode,
              fieldMappingSetId: fieldMappingSetId || undefined,
              options:
                isXqlDialect(targetDialect) || isXqlDialect(sourceDialect)
                  ? { xqlCaseSensitive }
                  : undefined,
            },
      ),
    onSuccess: (created) => {
      setActiveConversionId(created.id);
      queryClient.invalidateQueries({ queryKey: ['conversions', tenantId, orgId] });
    },
  });

  const modes = catalog?.modes ?? ['strict', 'assisted'];
  const mappings = mappingsPage?.items ?? [];
  const conversions = conversionsPage?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--fg-default)]">
            Query Conversion &amp; Field Mapping Sets
          </h2>
          <p className="text-xs text-[var(--fg-muted)] mt-0.5">
            Translate detection queries across SIEM dialects with canonical field mappings and syntax verification.
          </p>
        </div>

        <div className="inline-flex rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-0.5 self-start">
          <button
            type="button"
            onClick={() => setSubTab('converter')}
            className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer whitespace-nowrap ${
              subTab === 'converter'
                ? 'bg-[var(--brand-primary)] text-[var(--fg-on-emphasis)]'
                : 'text-[var(--fg-muted)] hover:text-[var(--fg-default)]'
            }`}
          >
            Converter
          </button>
          <button
            type="button"
            onClick={() => setSubTab('mappings')}
            className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer whitespace-nowrap ${
              subTab === 'mappings'
                ? 'bg-[var(--brand-primary)] text-[var(--fg-on-emphasis)]'
                : 'text-[var(--fg-muted)] hover:text-[var(--fg-default)]'
            }`}
          >
            Field Mapping Sets ({mappings.length})
          </button>
        </div>
      </div>

      {subTab === 'mappings' ? (
        <FieldMappingsEditor
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          orgId={orgId}
          mappings={mappings}
          dialects={dialects.map((d) => d.id)}
        />
      ) : (
        <div className="space-y-6">
          {(convertMutation.error || validateSyntaxMutation.error) && (
            <ErrorBanner
              error={convertMutation.error || validateSyntaxMutation.error}
              tenantSlug={tenantSlug}
            />
          )}

          {/* Controls strip */}
          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label htmlFor="conv-source-dialect" className="block text-xs font-medium text-[var(--fg-default)] mb-1">
                Source dialect
              </label>
              <select
                id="conv-source-dialect"
                value={sourceDialect}
                disabled={inputMode === 'rule' && Boolean(prefilledRule)}
                onChange={(e) => setSourceDialect(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
              >
                {sourceDialects.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="conv-target-dialect" className="block text-xs font-medium text-[var(--fg-default)] mb-1">
                Target dialect
              </label>
              <select
                id="conv-target-dialect"
                value={targetDialect}
                onChange={(e) => setTargetDialect(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
              >
                {targetDialects.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="conv-mode" className="block text-xs font-medium text-[var(--fg-default)] mb-1">
                Mode
              </label>
              <select
                id="conv-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
              >
                {modes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="conv-mapping" className="block text-xs font-medium text-[var(--fg-default)] mb-1">
                Field mapping set
              </label>
              <select
                id="conv-mapping"
                value={fieldMappingSetId}
                onChange={(e) => setFieldMappingSetId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
              >
                <option value="">Default canonical mapping</option>
                {mappings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (v{m.version})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={validateSyntaxMutation.isPending || !queryText.trim()}
                onClick={() => validateSyntaxMutation.mutate()}
              >
                Validate syntax
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={convertMutation.isPending || (inputMode === 'query' && !queryText.trim())}
                onClick={() => convertMutation.mutate()}
              >
                <Play className="w-3.5 h-3.5" />
                <span>{convertMutation.isPending ? 'Converting…' : 'Convert'}</span>
              </Button>
            </div>
          </div>

          {(isXqlDialect(sourceDialect) || isXqlDialect(targetDialect)) && (
            <label className="inline-flex items-center gap-2 text-xs text-[var(--fg-default)] cursor-pointer">
              <input
                type="checkbox"
                checked={xqlCaseSensitive}
                onChange={(e) => setXqlCaseSensitive(e.target.checked)}
              />
              <span>Enforce case-sensitive string matching in Cortex XQL (`xqlCaseSensitive`)</span>
            </label>
          )}

          {prefilledRule && inputMode === 'rule' && (
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-2.5 flex items-center justify-between text-xs">
              <span>
                Converting indexed rule <strong className="text-[var(--fg-default)]">{prefilledRule.name}</strong> ({prefilledRule.ruleUid})
              </span>
              <button
                type="button"
                onClick={() => {
                  setInputMode('query');
                  setSelectedRuleRepoId('');
                  setSelectedRuleId('');
                }}
                className="text-[var(--brand-primary)] hover:underline cursor-pointer"
              >
                Switch to raw query
              </button>
            </div>
          )}

          {syntaxValidation && (
            <div
              className={`rounded-md border p-3 text-xs flex items-start gap-2.5 ${
                syntaxValidation.valid
                  ? 'border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[var(--success-subtle)]'
                  : 'border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-subtle)]'
              }`}
            >
              {syntaxValidation.valid ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-semibold text-[var(--fg-default)]">
                  {syntaxValidation.dialect.toUpperCase()} syntax check:{' '}
                  {syntaxValidation.valid ? 'Valid' : 'Invalid'}
                </div>
                {syntaxValidation.diagnostics.length > 0 && (
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-[var(--fg-muted)]">
                    {syntaxValidation.diagnostics.map((d, idx) => (
                      <li key={idx}>{d.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Two-pane Editor & Result */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden flex flex-col">
              <div className="px-3.5 py-2.5 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)] flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-[var(--fg-default)]">
                  Source Query ({sourceDialect.toUpperCase()})
                </span>
                <span className="text-[var(--fg-muted)]">{inputMode === 'rule' ? 'From Rule' : 'Raw Query'}</span>
              </div>
              <textarea
                aria-label="Source detection query"
                rows={11}
                readOnly={inputMode === 'rule'}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                className="w-full flex-1 p-3.5 text-xs font-mono bg-[var(--bg-surface)] text-[var(--fg-default)] focus:outline-none resize-y"
              />
            </div>

            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden flex flex-col">
              <div className="px-3.5 py-2.5 border-b border-[var(--border-muted)] bg-[var(--bg-subtle)] flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-[var(--fg-default)]">
                  Converted Output ({activeConversion ? activeConversion.targetDialect.toUpperCase() : targetDialect.toUpperCase()})
                </span>
                {activeConversion && <StatusBadge status={activeConversion.status} />}
              </div>

              {!activeConversion ? (
                <div className="p-8 flex-1 flex flex-col items-center justify-center text-center text-xs text-[var(--fg-muted)]">
                  <ArrowLeftRight className="w-7 h-7 mb-2 opacity-60" />
                  <p>Run a conversion or select an entry from history below to inspect output and diagnostics.</p>
                </div>
              ) : !isConversionTerminal(activeConversion.status) ? (
                <div className="p-8 flex-1 flex flex-col items-center justify-center text-center text-xs text-[var(--fg-muted)] gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[var(--brand-primary)]" />
                  <span>Conversion {activeConversion.status.toLowerCase()}…</span>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {(activeConversion.result?.reviewRequired || activeConversion.mode === 'assisted') && (
                    <div className="rounded border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[var(--warning-subtle)] p-2.5 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0 mt-0.5" />
                      <span>
                        <strong>Human review required:</strong> Review generated predicates and field names before committing or deploying this query.
                      </span>
                    </div>
                  )}

                  {activeConversion.result?.query ? (
                    <CodeViewer
                      code={activeConversion.result.query}
                      language={activeConversion.targetDialect}
                      title={`Method: ${activeConversion.result.method}`}
                    />
                  ) : (
                    <div className="p-3 rounded border border-[var(--border-default)] bg-[var(--danger-subtle)] text-xs text-[var(--danger)]">
                      {activeConversion.result?.error?.message ?? 'Conversion did not produce an output query.'}
                    </div>
                  )}

                  {/* Warnings & Unsupported */}
                  {activeConversion.result &&
                    (activeConversion.result.warnings.length > 0 ||
                      activeConversion.result.unsupported.length > 0) && (
                      <div className="space-y-2 text-xs">
                        {activeConversion.result.warnings.map((w, i) => (
                          <div key={i} className="p-2 rounded border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[var(--warning-subtle)] text-[var(--fg-default)]">
                            Warning: {typeof w === 'string' ? w : w.message}
                          </div>
                        ))}
                        {activeConversion.result.unsupported.map((u, i) => (
                          <div key={i} className="p-2 rounded border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-subtle)] text-[var(--fg-default)]">
                            Unsupported: {typeof u === 'string' ? u : u.message}
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Field mappings applied */}
                  {activeConversion.result && activeConversion.result.fieldMappings.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--fg-default)] mb-1.5">
                        Field Mappings Applied
                      </h4>
                      <div className="border border-[var(--border-muted)] rounded overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-[var(--bg-subtle)] text-[var(--fg-muted)]">
                            <tr>
                              <th className="text-left px-2.5 py-1.5 font-medium">Source</th>
                              <th className="text-left px-2.5 py-1.5 font-medium">Canonical</th>
                              <th className="text-left px-2.5 py-1.5 font-medium">Target</th>
                              <th className="text-left px-2.5 py-1.5 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-muted)] font-mono">
                            {activeConversion.result.fieldMappings.map((fm, i) => (
                              <tr key={i}>
                                <td className="px-2.5 py-1.5">{fm.sourceField}</td>
                                <td className="px-2.5 py-1.5 text-[var(--fg-muted)]">{fm.canonicalField ?? '—'}</td>
                                <td className="px-2.5 py-1.5">{fm.targetField ?? '—'}</td>
                                <td className="px-2.5 py-1.5">{fm.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Conversion History */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--fg-default)]">Conversion History</h3>
            {listLoading ? (
              <SkeletonRows rows={3} />
            ) : conversions.length === 0 ? (
              <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-xs text-[var(--fg-muted)]">
                No conversion jobs recorded in this organization yet.
              </div>
            ) : (
              <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
                {conversions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setActiveConversionId(c.id);
                      setSourceDialect(c.sourceDialect);
                      setTargetDialect(c.targetDialect);
                      setQueryText(c.sourceQuery);
                    }}
                    className={`w-full text-left p-3.5 flex items-center justify-between gap-3 hover:bg-[var(--bg-subtle)] cursor-pointer ${
                      activeConversionId === c.id ? 'bg-[var(--brand-primary-subtle)]' : ''
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="font-semibold text-[var(--fg-default)]">
                          {c.sourceDialect.toUpperCase()} → {c.targetDialect.toUpperCase()}
                        </span>
                        <span className="text-[var(--fg-muted)]">({c.mode})</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="text-xs font-mono text-[var(--fg-muted)] truncate">{c.sourceQuery}</div>
                    </div>
                    <span className="text-xs text-[var(--fg-muted)] shrink-0">
                      {formatRelativeTime(c.createdAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldMappingsEditor({
  tenantId,
  tenantSlug,
  orgId,
  mappings,
  dialects,
}: {
  tenantId: string;
  tenantSlug: string;
  orgId: string;
  mappings: FieldMappingSetDto[];
  dialects: string[];
}) {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<FieldMappingSetDto | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldEntryDto[]>([]);
  const [sources, setSources] = useState<SourceEntryDto[]>([]);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setName('');
    setDescription('');
    setFields([
      { dialect: dialects[0] || 'kql', source: 'process', canonical: 'process.command_line', native: 'ProcessCommandLine' },
    ]);
    setSources([]);
  };

  const openEdit = (m: FieldMappingSetDto) => {
    setCreating(false);
    setEditing(m);
    setName(m.name);
    setDescription(m.description ?? '');
    setFields(m.fields);
    setSources(m.sources);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editing) {
        return api.updateFieldMapping(tenantId, orgId, editing.id, {
          name: name.trim(),
          description: description.trim() || null,
          fields,
          sources,
          version: editing.version,
        });
      }
      return api.createFieldMapping(tenantId, orgId, {
        name: name.trim(),
        description: description.trim() || null,
        fields,
        sources,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-mappings', tenantId, orgId] });
      setEditing(null);
      setCreating(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFieldMapping(tenantId, orgId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-mappings', tenantId, orgId] });
    },
  });

  return (
    <div className="space-y-4">
      {(saveMutation.error || deleteMutation.error) && (
        <ErrorBanner error={saveMutation.error || deleteMutation.error} tenantSlug={tenantSlug} />
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--fg-muted)]">
          Define organization field and event-source mappings for strict and assisted query conversions.
        </p>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus className="w-3.5 h-3.5" />
          <span>New mapping set</span>
        </Button>
      </div>

      {(creating || editing) && (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-[var(--fg-default)]">
            {editing ? `Edit Mapping Set: ${editing.name} (v${editing.version})` : 'Create Field Mapping Set'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="CrowdStrike Endpoint Mapping"
                className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--fg-default)] mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Canonical process and network fields"
                className="w-full px-3 py-1.5 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--fg-default)]">Field Entries</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setFields((prev) => [
                    ...prev,
                    { dialect: dialects[0] || 'kql', source: 'process', canonical: '', native: '' },
                  ])
                }
              >
                + Add field
              </Button>
            </div>
            <div className="space-y-2">
              {fields.map((f, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                  <input
                    type="text"
                    value={f.dialect}
                    onChange={(e) =>
                      setFields((prev) => prev.map((x, i) => (i === idx ? { ...x, dialect: e.target.value } : x)))
                    }
                    placeholder="dialect (kql)"
                    className="px-2.5 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
                  />
                  <input
                    type="text"
                    value={f.source}
                    onChange={(e) =>
                      setFields((prev) => prev.map((x, i) => (i === idx ? { ...x, source: e.target.value } : x)))
                    }
                    placeholder="source (process)"
                    className="px-2.5 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
                  />
                  <input
                    type="text"
                    value={f.canonical}
                    onChange={(e) =>
                      setFields((prev) => prev.map((x, i) => (i === idx ? { ...x, canonical: e.target.value } : x)))
                    }
                    placeholder="canonical (process.name)"
                    className="px-2.5 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
                  />
                  <input
                    type="text"
                    value={f.native}
                    onChange={(e) =>
                      setFields((prev) => prev.map((x, i) => (i === idx ? { ...x, native: e.target.value } : x)))
                    }
                    placeholder="native (FileName)"
                    className="px-2.5 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
                  />
                  <button
                    type="button"
                    onClick={() => setFields((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove field entry"
                    className="p-1.5 text-[var(--danger)] hover:bg-[var(--danger-subtle)] rounded cursor-pointer justify-self-start"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={saveMutation.isPending || !name.trim()}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save mapping set'}
            </Button>
          </div>
        </div>
      )}

      {mappings.length === 0 ? (
        <Blankslate
          icon={<Database className="w-8 h-8" />}
          title="No custom field mapping sets"
          description="Create a field mapping set to customize how canonical telemetry fields map to your SIEM tables."
          action={
            <Button variant="primary" size="sm" onClick={openCreate}>
              Create mapping set
            </Button>
          }
        />
      ) : (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-muted)]">
          {mappings.map((m) => (
            <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[var(--fg-default)]">{m.name}</span>
                  <span className="text-xs font-mono text-[var(--fg-muted)]">v{m.version}</span>
                </div>
                {m.description && <p className="text-xs text-[var(--fg-muted)]">{m.description}</p>}
                <div className="text-xs text-[var(--fg-muted)] tabular-nums">
                  {m.fields.length} field entries · {m.sources.length} source bindings · updated{' '}
                  {formatRelativeTime(m.updatedAt)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEdit(m)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(m.id)}
                  className="text-[var(--danger)]"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
