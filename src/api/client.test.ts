import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQueryString, createSepClient, SepApiError } from './client';

test('buildQueryString omits empty values and joins arrays', () => {
  const qs = buildQueryString({
    limit: 20,
    cursor: null,
    severity: ['HIGH', 'CRITICAL'],
    q: '',
  });
  assert.equal(qs, '?limit=20&severity=HIGH%2CCRITICAL');
});

test('createSepClient attaches bearer token and parses structured API errors with x-request-id', async () => {
  let capturedAuth = '';
  let unauthorizedCalled = false;
  const mockFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const h = init?.headers as Record<string, string>;
    capturedAuth = h?.Authorization ?? '';
    return new Response(
      JSON.stringify({
        error: {
          code: 'RULE_NOT_DEPLOYABLE',
          message: 'Target accepts splunk:spl rules',
          requestId: 'req-123',
        },
      }),
      {
        status: 422,
        headers: { 'content-type': 'application/json', 'x-request-id': 'req-123' },
      },
    );
  }) as typeof fetch;

  const client = createSepClient({
    baseUrl: '/api/v1',
    getToken: () => 'tok-abc',
    onUnauthorized: () => {
      unauthorizedCalled = true;
    },
    fetchImpl: mockFetch,
  });

  await assert.rejects(
    () => client.createDeployment('t1', 'o1', { integrationId: 'i1', repositoryId: 'r1', ruleId: 'ru1' }),
    (err: unknown) => {
      assert.ok(err instanceof SepApiError);
      assert.equal(err.status, 422);
      assert.equal(err.code, 'RULE_NOT_DEPLOYABLE');
      assert.equal(err.requestId, 'req-123');
      return true;
    },
  );
  assert.equal(capturedAuth, 'Bearer tok-abc');
  assert.equal(unauthorizedCalled, false);
});

test('createSepClient invokes onUnauthorized on 401', async () => {
  let unauthorizedCalled = false;
  const mockFetch = (async () =>
    new Response(
      JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required', requestId: 'req-401' } }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;

  const client = createSepClient({
    baseUrl: '/api/v1',
    getToken: () => null,
    onUnauthorized: () => {
      unauthorizedCalled = true;
    },
    fetchImpl: mockFetch,
  });

  await assert.rejects(() => client.getMe(), SepApiError);
  assert.equal(unauthorizedCalled, true);
});
