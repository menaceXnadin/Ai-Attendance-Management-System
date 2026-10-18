/** Classroom check-in code helpers (docs/system/face-verification.md §9). UX only; the server verifies. */
export const PRESENCE_CODE_LENGTH = 6;

/** Keeps digits only, at most 6 (e.g. from `?code=` or a paste). */
export const normalizePresenceCode = (value: string | null | undefined): string =>
  (value ?? '').replace(/\D/g, '').slice(0, PRESENCE_CODE_LENGTH);

export const isCompletePresenceCode = (value: string): boolean => /^\d{6}$/.test(value);
