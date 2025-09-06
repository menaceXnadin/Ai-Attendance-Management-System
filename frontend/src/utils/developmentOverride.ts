// Development toggle for bypassing all restrictions during development
// This creates a persistent toggle that survives page refreshes

export const DEVELOPMENT_OVERRIDE_KEY = 'dev_override_all_restrictions';

// Check if development override is enabled
export const isDevelopmentOverrideEnabled = (): boolean => {
  try {
    return localStorage.getItem(DEVELOPMENT_OVERRIDE_KEY) === 'true';
  } catch {
    return false;
  }
};

// Enable development override
export const enableDevelopmentOverride = (): void => {
  try {
    localStorage.setItem(DEVELOPMENT_OVERRIDE_KEY, 'true');
    console.log('🔧 Development Override ENABLED - All restrictions bypassed');
  } catch (error) {
    console.error('Failed to enable development override:', error);
  }
};

// Disable development override
export const disableDevelopmentOverride = (): void => {
  try {
    localStorage.removeItem(DEVELOPMENT_OVERRIDE_KEY);
    console.log('🔒 Development Override DISABLED - Normal restrictions apply');
  } catch (error) {
    console.error('Failed to disable development override:', error);
  }
};

// Toggle development override
export const toggleDevelopmentOverride = (): boolean => {
  const isEnabled = isDevelopmentOverrideEnabled();
  if (isEnabled) {
    disableDevelopmentOverride();
    return false;
  } else {
    enableDevelopmentOverride();
    return true;
  }
};
