import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProviderConfigSchema } from '../api/types';
import { buildDefaultConfig, extractSchemaFields, validateSchemaConfig } from './schema-form';

const splunkSchema: ProviderConfigSchema = {
  type: 'object',
  properties: {
    baseUrl: { type: 'string', format: 'uri', maxLength: 2048 },
    app: { type: 'string', default: 'search', pattern: '^[A-Za-z0-9_.-]{1,80}$' },
    caCertificate: { type: 'string', maxLength: 16384 },
  },
  required: ['baseUrl'],
};

test('extractSchemaFields builds defaults and identifies textarea for certificates', () => {
  const fields = extractSchemaFields(splunkSchema);
  assert.equal(fields.length, 3);
  assert.equal(fields[0].required, true);
  assert.equal(fields[2].type, 'textarea');
  const defaults = buildDefaultConfig(splunkSchema);
  assert.equal(defaults.app, 'search');
  assert.equal(defaults.baseUrl, '');
});

test('validateSchemaConfig enforces required, URI format, and regex pattern', () => {
  const missingErr = validateSchemaConfig(splunkSchema, { baseUrl: '', app: 'search' });
  assert.ok(missingErr.baseUrl);

  const badUrl = validateSchemaConfig(splunkSchema, { baseUrl: 'not-a-url', app: 'bad app!' });
  assert.ok(badUrl.baseUrl);
  assert.ok(badUrl.app);

  const valid = validateSchemaConfig(splunkSchema, { baseUrl: 'https://splunk.internal:8089', app: 'search' });
  assert.deepEqual(valid, {});
});
