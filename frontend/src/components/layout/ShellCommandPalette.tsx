import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import {
  Search20Regular,
  SignOut20Regular,
  WeatherMoon20Regular,
  WeatherSunny20Regular,
} from '@fluentui/react-icons';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import type { NavGroup, NavItem } from './shell-types';

/* ------------------------------------------------------------------------- */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------- */

const detectMac = () =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');

const useIsMac = () => React.useMemo(detectMac, []);

/**
 * Score items by their label (first keyword): prefix > word-prefix > substring,
 * with a weak fallback on the group label. Returning 0 hides the item.
 */
const scoreItem = (value: string, search: string, keywords?: string[]) => {
  const q = search.trim().toLowerCase();
  if (!q) return 1;
  const label = (keywords?.[0] ?? value).toLowerCase();
  if (label.startsWith(q)) return 1;
  if (label.split(/\s+/).some((word) => word.startsWith(q))) return 0.85;
  if (label.includes(q)) return 0.7;
  const extra = (keywords ?? []).slice(1).join(' ').toLowerCase();
  if (extra && extra.includes(q)) return 0.3;
  return 0;
};

const Kbd: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <kbd
    className={cn(
      'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border-subtle bg-surface-default px-1 font-sans text-overline text-text-muted',
      className
    )}
  >
    {children}
  </kbd>
);

/* ------------------------------------------------------------------------- */
/* Title bar search box (trigger)                                            */
/* ------------------------------------------------------------------------- */

export interface ShellSearchBoxProps {
  onOpen: () => void;
  className?: string;
}

/** Teams-style search field in the title bar. Opens the quick-navigation palette. */
export const ShellSearchBox: React.FC<ShellSearchBoxProps> = ({ onOpen, className }) => {
  const isMac = useIsMac();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
      aria-label={`Search (${isMac ? '⌘' : 'Ctrl'}+K)`}
      className={cn(
        'group flex h-8 w-full min-w-0 items-center gap-2 rounded-md border border-transparent bg-surface-default px-2.5 text-left text-body text-text-muted shadow-xs',
        'transition-colors duration-150 ease-fluent-standard hover:border-border-default hover:text-text-secondary',
        className
      )}
    >
      <Search20Regular className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">Search</span>
      <span className="hidden shrink-0 items-center gap-0.5 md:flex" aria-hidden="true">
        <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
};

/* ------------------------------------------------------------------------- */
/* Command palette                                                           */
/* ------------------------------------------------------------------------- */

export interface ShellCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navGroups: NavGroup[];
  onSignOut: () => void;
}

const groupClass =
  'p-1 text-text-primary [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-overline [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-text-muted';

const itemClass =
  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-body text-text-primary data-[selected=true]:bg-surface-hover data-[selected=true]:text-text-primary';

export const ShellCommandPalette: React.FC<ShellCommandPaletteProps> = ({
  open,
  onOpenChange,
  navGroups,
  onSignOut,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const isCurrent = (item: NavItem) =>
    !!matchPath({ path: item.to, end: item.end ?? false }, location.pathname);

  const isDark = resolvedTheme === 'dark';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-2 z-50 w-[calc(100vw-16px)] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-lg border border-border-subtle bg-surface-raised text-text-primary shadow-xl outline-none',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
          )}
        >
          <DialogPrimitive.Title className="sr-only">Search AttendAI</DialogPrimitive.Title>
          <Command
            loop
            filter={scoreItem}
            className="rounded-none bg-transparent text-text-primary [&_[cmdk-input-wrapper]]:border-border-subtle [&_[cmdk-input-wrapper]]:px-3 [&_[cmdk-input-wrapper]_svg]:text-text-secondary [&_[cmdk-input-wrapper]_svg]:opacity-100"
          >
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search pages and actions"
              className="h-12 text-body text-text-primary placeholder:text-text-muted"
            />
            <CommandList className="max-h-[min(420px,60vh)] py-1">
              <CommandEmpty className="px-4 py-10 text-center">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-muted">
                  <Search20Regular className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="block text-body-strong text-text-primary">No results found</span>
                <span className="mt-1 block text-caption text-text-muted">
                  Nothing matches &ldquo;{search}&rdquo;. Try a different page name.
                </span>
              </CommandEmpty>

              {navGroups.map((group, gIdx) => (
                <CommandGroup
                  key={group.groupLabel ?? gIdx}
                  heading={group.groupLabel ?? 'Pages'}
                  className={groupClass}
                >
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const current = isCurrent(item);
                    return (
                      <CommandItem
                        key={item.to}
                        value={`nav:${item.to}`}
                        keywords={[item.label, group.groupLabel ?? '']}
                        onSelect={() => run(() => navigate(item.to))}
                        className={itemClass}
                      >
                        <Icon
                          className={cn('h-5 w-5 shrink-0', current ? 'text-brand-foreground' : 'text-text-secondary')}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.isNew && (
                          <span className="rounded-full bg-brand-subtle px-1.5 text-overline text-brand-foreground">
                            New
                          </span>
                        )}
                        {current && <span className="text-caption text-text-muted">Current page</span>}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}

              <CommandSeparator className="mx-0 my-1 bg-border-subtle" />

              <CommandGroup heading="Actions" className={groupClass}>
                <CommandItem
                  value="action:theme"
                  keywords={[
                    isDark ? 'Switch to light theme' : 'Switch to dark theme',
                    'theme appearance dark light mode',
                  ]}
                  onSelect={() => run(() => setTheme(isDark ? 'light' : 'dark'))}
                  className={itemClass}
                >
                  {isDark ? (
                    <WeatherSunny20Regular className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" />
                  ) : (
                    <WeatherMoon20Regular className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                  </span>
                </CommandItem>
                <CommandItem
                  value="action:sign-out"
                  keywords={['Sign out', 'log out logout account']}
                  onSelect={() => run(onSignOut)}
                  className={itemClass}
                >
                  <SignOut20Regular className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">Sign out</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>

            <div className="hidden items-center gap-4 border-t border-border-subtle bg-surface-subtle px-3 py-2 text-caption text-text-muted sm:flex">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <span className="ml-0.5">to move</span>
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Enter</Kbd>
                <span className="ml-0.5">to open</span>
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Esc</Kbd>
                <span className="ml-0.5">to close</span>
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};

export default ShellCommandPalette;
