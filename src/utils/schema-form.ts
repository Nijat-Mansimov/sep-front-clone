import type { JsonSchemaProperty, ProviderConfigSchema } from '../api/types';

export interface SchemaFieldDescriptor {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'textarea' | 'enum';
  required: boolean;
  defaultValue: string;
  pattern?: string;
  maxLength?: number;
  format?: string;
  enumValues?: string[];
  description?: string;
}

export function humanizeSchemaKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

export function extractSchemaFields(schema: ProviderConfigSchema | undefined): SchemaFieldDescriptor[] {
  if (!schema || !schema.properties) return [];
  const requiredSet = new Set(schema.required ?? []);
  return Object.entries(schema.properties).map(([key, prop]: [string, JsonSchemaProperty]) => {
    let type: SchemaFieldDescriptor['type'] = 'string';
    if (prop.enum && prop.enum.length > 0) {
      type = 'enum';
    } else if (prop.type === 'number' || prop.type === 'integer') {
      type = 'number';
    } else if (prop.type === 'boolean') {
      type = 'boolean';
    } else if (key.toLowerCase().includes('certificate') || (prop.maxLength && prop.maxLength > 4096)) {
      type = 'textarea';
    }
    return {
      key,
      label: humanizeSchemaKey(key),
      type,
      required: requiredSet.has(key),
      defaultValue: prop.default !== undefined && prop.default !== null ? String(prop.default) : '',
      pattern: prop.pattern,
      maxLength: prop.maxLength,
      format: prop.format,
      enumValues: prop.enum,
      description: prop.description,
    };
  });
}

export function buildDefaultConfig(schema: ProviderConfigSchema | undefined): Record<string, string> {
  const fields = extractSchemaFields(schema);
  const out: Record<string, string> = {};
  for (const f of fields) {
    out[f.key] = f.defaultValue;
  }
  return out;
}

export function validateSchemaConfig(
  schema: ProviderConfigSchema | undefined,
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const fields = extractSchemaFields(schema);
  for (const f of fields) {
    const val = (values[f.key] ?? '').trim();
    if (f.required && !val) {
      errors[f.key] = `${f.label} is required`;
      continue;
    }
    if (!val) continue;
    if (f.format === 'uri') {
      try {
        const u = new URL(val);
        if (!u.protocol.startsWith('http')) {
          errors[f.key] = `${f.label} must be an http or https URL`;
        }
      } catch {
        errors[f.key] = `${f.label} must be a valid URL`;
      }
    }
    if (f.pattern) {
      try {
        const re = new RegExp(f.pattern);
        if (!re.test(val)) {
          errors[f.key] = `${f.label} does not match expected format`;
        }
      } catch {
        // ignore invalid regex from schema
      }
    }
    if (f.maxLength && val.length > f.maxLength) {
      errors[f.key] = `${f.label} exceeds ${f.maxLength} characters`;
    }
  }
  return errors;
}
