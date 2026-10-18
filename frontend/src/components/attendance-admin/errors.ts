import { getErrorDetailField, type ApiEntryError, type ApiErrorInfo } from '@/integrations/api/client';

/**
 * Reads a field from a structured error. Supports both shapes the backend may
 * send: `{detail: {code, errors, students_without_record}}` (contract v1) and
 * `{detail: {code, message, details: {...}}}` (`DomainError.to_dict()`).
 */
export const errorField = <T = unknown>(info: ApiErrorInfo, key: string): T | undefined => {
  const direct = getErrorDetailField<T>(info, key);
  if (direct !== undefined) return direct;
  const nested = getErrorDetailField<Record<string, unknown>>(info, 'details');
  if (nested && typeof nested === 'object' && key in nested) return nested[key] as T;
  return undefined;
};

/** Per-entry errors (`invalid_entries` / `validation_failed`). */
export const entryErrors = (info: ApiErrorInfo): ApiEntryError[] => {
  if (info.errors?.length) return info.errors;
  const nested = errorField<unknown>(info, 'errors');
  return Array.isArray(nested) ? (nested as ApiEntryError[]) : [];
};

export const isEntryValidationError = (info: ApiErrorInfo): boolean =>
  info.code === 'invalid_entries' || info.code === 'validation_failed' || entryErrors(info).length > 0;

/** A legacy HTTP-200 `{success: false, code, message}` body, normalised like a thrown error. */
export const legacyFailure = (body: unknown): ApiErrorInfo | null => {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.success !== false) return null;
  return {
    status: 200,
    code: typeof b.code === 'string' ? b.code : undefined,
    message: typeof b.message === 'string' && b.message ? b.message : 'The request was rejected',
    detail: b,
    errors: Array.isArray(b.errors) ? (b.errors as ApiEntryError[]) : undefined,
  };
};
