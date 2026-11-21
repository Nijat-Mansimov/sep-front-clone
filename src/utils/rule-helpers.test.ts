import assert from 'node:assert/strict';
import test from 'node:test';
import { SepApiError } from '../api/client';
import { formatApiErrorCopyText, formatBytes, getCoverageIntensity, isConversionTerminal, isDeploymentTerminal, resolveDialectId } from './rule-helpers';

test('getCoverageIntensity maps counts to 0..3 buckets', () => {
  assert.equal(getCoverageIntensity(0), 0);
  assert.equal(getCoverageIntensity(1), 1);
  assert.equal(getCoverageIntensity(2), 2);
  assert.equal(getCoverageIntensity(4), 3);
});

test('terminal status checks behave accurately', () => {
  assert.equal(isConversionTerminal('QUEUED'), false);
  assert.equal(isConversionTerminal('RUNNING'), false);
  assert.equal(isConversionTerminal('SUCCEEDED'), true);
  assert.equal(isConversionTerminal('SUCCEEDED_WITH_WARNINGS'), true);
  assert.equal(isConversionTerminal('FAILED'), true);

  assert.equal(isDeploymentTerminal('PENDING_APPROVAL'), false);
  assert.equal(isDeploymentTerminal('RUNNING'), false);
  assert.equal(isDeploymentTerminal('SUCCEEDED'), true);
  assert.equal(isDeploymentTerminal('REJECTED'), true);
});

test('formatBytes and formatApiErrorCopyText produce structured outputs', () => {
  assert.equal(formatBytes(-1), 'Unlimited');
  assert.equal(formatBytes(1073741824), '1.0 GB');
  const err = new SepApiError({ status: 403, code: 'FORBIDDEN', message: 'Denied', requestId: 'req-9' });
  const text = formatApiErrorCopyText(err);
  assert.ok(text.includes('"requestId": "req-9"'));
  assert.ok(text.includes('"code": "FORBIDDEN"'));
});

test('resolveDialectId matches exact id, language, aliases, and fallback safely', () => {
  const catalog = [
    { id: 'cortex-xsiam:xql', language: 'xql', aliases: ['cortex-xdr:xql'] },
    { id: 'splunk:spl', language: 'spl', aliases: [] },
    { id: 'microsoft-sentinel:kql', language: 'kql', aliases: [] },
  ];
  assert.equal(resolveDialectId(catalog, 'kql'), 'microsoft-sentinel:kql');
  assert.equal(resolveDialectId(catalog, 'spl'), 'splunk:spl');
  assert.equal(resolveDialectId(catalog, 'cortex-xdr:xql'), 'cortex-xsiam:xql');
  assert.equal(resolveDialectId(catalog, 'splunk:spl'), 'splunk:spl');
  assert.equal(resolveDialectId(catalog, 'unknown', 1), 'splunk:spl');
});
