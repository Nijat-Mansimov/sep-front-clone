import React from 'react';
import type { ProviderConfigSchema } from '../../api/types';
import { extractSchemaFields } from '../../utils/schema-form';

export function SchemaConfigForm({
  schema,
  values,
  errors,
  onChange,
}: {
  schema: ProviderConfigSchema | undefined;
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const fields = extractSchemaFields(schema);
  if (fields.length === 0) return null;

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <div key={field.key}>
          <label htmlFor={`schema-field-${field.key}`} className="block text-xs font-medium text-[var(--fg-default)] mb-1">
            {field.label}
            {field.required && <span className="text-[var(--danger)] ml-1">*</span>}
          </label>
          {field.type === 'enum' && field.enumValues ? (
            <select
              id={`schema-field-${field.key}`}
              value={values[field.key] ?? field.defaultValue}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
            >
              {field.enumValues.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea
              id={`schema-field-${field.key}`}
              rows={3}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.defaultValue || `Optional ${field.label}`}
              className="w-full px-3 py-2 text-xs font-mono rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
            />
          ) : (
            <input
              id={`schema-field-${field.key}`}
              type={field.type === 'number' ? 'number' : 'text'}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.defaultValue || (field.format === 'uri' ? 'https://...' : '')}
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
            />
          )}
          {errors[field.key] && (
            <p className="mt-1 text-xs text-[var(--danger)]">{errors[field.key]}</p>
          )}
        </div>
      ))}
    </div>
  );
}
