import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import {
  PersonCircle20Regular,
  SignOut20Regular,
  WeatherMoon20Regular,
} from '@fluentui/react-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { getInitials, type ShellUser } from './shell-types';

/* ------------------------------------------------------------------------- */
/* Avatar                                                                    */
/* ------------------------------------------------------------------------- */

const avatarSizes = {
  sm: 'h-7 w-7 text-overline',
  md: 'h-8 w-8 text-caption-strong',
  lg: 'h-12 w-12 text-body-strong',
} as const;

const presenceSizes = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
} as const;

export interface ShellAvatarProps {
  name?: string;
  size?: keyof typeof avatarSizes;
  /** Show the green "available" presence dot. */
  presence?: boolean;
  /** Ring colour class that cuts the presence dot out of the surface behind it. */
  presenceRingClassName?: string;
  className?: string;
}

/** Teams-style circular avatar with initials and optional presence badge. */
export const ShellAvatar: React.FC<ShellAvatarProps> = ({
  name,
  size = 'md',
  presence = false,
  presenceRingClassName = 'ring-surface-raised',
  className,
}) => (
  <span className={cn('relative inline-flex shrink-0', className)}>
    <span
      aria-hidden="true"
      className={cn(
        'flex items-center justify-center rounded-full bg-brand-subtle font-semibold text-brand-foreground select-none',
        avatarSizes[size]
      )}
    >
      {getInitials(name)}
    </span>
    {presence && (
      <span
        aria-hidden="true"
        className={cn(
          'absolute bottom-0 right-0 rounded-full bg-presence-available ring-2',
          presenceSizes[size],
          presenceRingClassName
        )}
      />
    )}
  </span>
);

/* ------------------------------------------------------------------------- */
/* Account menu                                                              */
/* ------------------------------------------------------------------------- */

export interface ShellAccountMenuProps {
  user?: ShellUser | null;
  roleLabel: string;
  onSignOut: () => void;
  onViewProfile?: () => void;
}

const menuItemClass =
  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-body text-text-primary outline-none transition-colors duration-150 focus:bg-surface-hover focus:text-text-primary data-[highlighted]:bg-surface-hover';

/** Title bar avatar button + Teams account manager flyout. */
export const ShellAccountMenu: React.FC<ShellAccountMenuProps> = ({
  user,
  roleLabel,
  onSignOut,
  onViewProfile,
}) => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const displayName = user?.name || 'User';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account manager for ${displayName}`}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity duration-150 hover:opacity-90"
        >
          <ShellAvatar name={user?.name} size="md" presence presenceRingClassName="ring-titlebar" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-[min(320px,calc(100vw-16px))] rounded-lg border-border-subtle bg-surface-raised p-0 text-text-primary shadow-lg"
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <span className="text-caption-strong text-text-secondary">AttendAI</span>
          <span className="truncate text-caption text-text-muted">{roleLabel}</span>
        </div>

        <div className="flex items-center gap-3 px-4 pb-4 pt-3">
          <ShellAvatar name={user?.name} size="lg" presence />
          <div className="min-w-0">
            <p className="truncate text-body-strong text-text-primary">{displayName}</p>
            {user?.email && <p className="truncate text-caption text-text-muted">{user.email}</p>}
            <p className="mt-0.5 flex items-center gap-1.5 text-caption text-text-secondary">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-presence-available" />
              {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : roleLabel}
            </p>
          </div>
        </div>

        <DropdownMenuSeparator className="mx-0 my-0 bg-border-subtle" />

        <div className="p-1">
          {onViewProfile && (
            <DropdownMenuItem onSelect={onViewProfile} className={menuItemClass}>
              <PersonCircle20Regular className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" />
              View profile
            </DropdownMenuItem>
          )}

          <DropdownMenuPrimitive.CheckboxItem
            checked={isDark}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            onSelect={(event) => event.preventDefault()}
            className={menuItemClass}
          >
            <WeatherMoon20Regular className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" />
            <span className="flex-1">Dark theme</span>
            {/* Fluent switch (visual only — the menu item carries the checked state) */}
            <span
              aria-hidden="true"
              className={cn(
                'relative inline-flex h-5 w-10 shrink-0 items-center rounded-full border transition-colors duration-150',
                isDark ? 'border-transparent bg-brand' : 'border-border-strong bg-transparent'
              )}
            >
              <span
                className={cn(
                  'absolute h-3.5 w-3.5 rounded-full transition-transform duration-150 ease-fluent-standard',
                  isDark ? 'translate-x-[21px] bg-brand-on' : 'translate-x-[2px] bg-text-secondary'
                )}
              />
            </span>
          </DropdownMenuPrimitive.CheckboxItem>

          <DropdownMenuSeparator className="mx-2 my-1 bg-border-subtle" />

          <DropdownMenuItem onSelect={onSignOut} className={menuItemClass}>
            <SignOut20Regular className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ShellAccountMenu;
