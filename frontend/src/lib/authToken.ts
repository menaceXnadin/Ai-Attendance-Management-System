/**
 * Single place to read/write the JWT. Login stores it in localStorage ("remember me")
 * or sessionStorage (this tab only); every reader must check both.
 */
const KEY = 'authToken';

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback; // storage can throw in private mode / restricted contexts
  }
};

export const getAuthToken = (): string | null =>
  safe(() => {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    return raw ? raw.trim() : null;
  }, null);

/** Replace the token in whichever storage currently holds it (localStorage by default). */
export const setAuthToken = (token: string): void =>
  safe(() => {
    const store = sessionStorage.getItem(KEY) !== null && localStorage.getItem(KEY) === null
      ? sessionStorage
      : localStorage;
    store.setItem(KEY, token);
  }, undefined);

export const clearAuthToken = (): void =>
  safe(() => {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  }, undefined);
