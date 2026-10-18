// Developer preview flag (persisted in localStorage).
//
// This flag is UI-only: it lets developers see a "preview" hint in the student
// schedule. It does NOT bypass check-in rules — the server decides whether a
// check-in window is open (DOMAIN_RULES §13.9) and rejects anything else.

export const DEVELOPMENT_OVERRIDE_KEY = 'dev_override_all_restrictions';

// Check if the developer preview flag is enabled
export const isDevelopmentOverrideEnabled = (): boolean => {
  try {
    return localStorage.getItem(DEVELOPMENT_OVERRIDE_KEY) === 'true';
  } catch {
    return false;
  }
};

// Enable the developer preview flag
export const enableDevelopmentOverride = (): void => {
  try {
    localStorage.setItem(DEVELOPMENT_OVERRIDE_KEY, 'true');
  } catch (error) {
    console.error('Failed to enable developer preview:', error);
  }
};

// Disable the developer preview flag
export const disableDevelopmentOverride = (): void => {
  try {
    localStorage.removeItem(DEVELOPMENT_OVERRIDE_KEY);
  } catch (error) {
    console.error('Failed to disable developer preview:', error);
  }
};

// Toggle the developer preview flag
export const toggleDevelopmentOverride = (): boolean => {
  const isEnabled = isDevelopmentOverrideEnabled();
  if (isEnabled) {
    disableDevelopmentOverride();
    return false;
  }
  enableDevelopmentOverride();
  return true;
};
