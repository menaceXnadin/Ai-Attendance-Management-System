import type * as React from 'react';

/**
 * Icon component accepted by the app shell navigation.
 *
 * Any icon component that accepts `className` works: @fluentui/react-icons
 * (preferred — e.g. `Home20Regular`), @carbon/icons-react and lucide-react.
 * Icons are rendered at 20px via `className`, so no `size` prop is required.
 */
export type NavIcon = React.ElementType;

export interface NavItem {
  label: string;
  to: string;
  /** Idle icon (Fluent `*20Regular` recommended). */
  icon: NavIcon;
  /** Optional icon shown when the item is active (Fluent `*20Filled`). Falls back to `icon`. */
  activeIcon?: NavIcon;
  badge?: string | number;
  isNew?: boolean;
  end?: boolean;
}

export interface NavGroup {
  groupLabel?: string;
  items: NavItem[];
}

export interface ShellUser {
  name?: string;
  email?: string;
  role?: string;
}

/** Up to two initials for the avatar ("Jane Doe" -> "JD"). */
export const getInitials = (name?: string, fallback = 'U'): string => {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
};

export const hasBadge = (badge: NavItem['badge']): badge is string | number =>
  badge !== undefined && badge !== null && badge !== '';
