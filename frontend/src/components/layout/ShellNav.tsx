import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { hasBadge, type NavGroup, type NavItem } from './shell-types';

/* ------------------------------------------------------------------------- */
/* Small pieces                                                              */
/* ------------------------------------------------------------------------- */

const isNumericBadge = (value: string | number) =>
  typeof value === 'number' || /^\d+\+?$/.test(String(value).trim());

/** Fluent small counter badge (numeric) or subtle brand pill (text). */
export const NavCounterBadge: React.FC<{ value: string | number; className?: string }> = ({
  value,
  className,
}) => {
  const numeric = isNumericBadge(value);
  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full text-overline tabular-nums',
        numeric ? 'bg-brand px-1 text-brand-on' : 'bg-brand-subtle px-1.5 text-brand-foreground',
        className
      )}
    >
      {value}
    </span>
  );
};

/** Discreet "new" marker: a small brand dot with an accessible label. */
const NewMarker: React.FC<{ className?: string }> = ({ className }) => (
  <>
    <span
      aria-hidden="true"
      title="New"
      className={cn('h-1.5 w-1.5 shrink-0 rounded-full bg-brand-stroke', className)}
    />
    <span className="sr-only">(new)</span>
  </>
);

/** 3px x 16px brand pill shown at the left edge of the selected item. */
const ActiveIndicator: React.FC<{ className?: string }> = ({ className }) => (
  <span
    aria-hidden="true"
    className={cn(
      'pointer-events-none absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-brand-foreground',
      className
    )}
  />
);

/* ------------------------------------------------------------------------- */
/* Items                                                                     */
/* ------------------------------------------------------------------------- */

interface ItemProps {
  item: NavItem;
  onNavigate?: () => void;
}

/** Fluent NavDrawer item (expanded navigation, 240px). */
const DrawerItem: React.FC<ItemProps> = ({ item, onNavigate }) => (
  <NavLink
    to={item.to}
    end={item.end}
    onClick={onNavigate}
    className={({ isActive }) =>
      cn(
        'group relative flex h-9 items-center gap-3 rounded-md px-3 text-body transition-colors duration-150 ease-fluent-standard',
        isActive
          ? 'bg-nav-active font-semibold text-text-primary'
          : 'text-nav-text hover:bg-nav-hover hover:text-text-primary active:bg-surface-pressed'
      )
    }
  >
    {({ isActive }) => {
      const Icon = isActive ? item.activeIcon ?? item.icon : item.icon;
      return (
        <>
          {isActive && <ActiveIndicator className="left-0" />}
          <Icon
            className={cn('h-5 w-5 shrink-0', isActive ? 'text-brand-foreground' : 'text-current')}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {hasBadge(item.badge) && <NavCounterBadge value={item.badge} />}
          {item.isNew && <NewMarker />}
        </>
      );
    }}
  </NavLink>
);

/** Teams app-bar item (collapsed 68px rail): icon stacked above a 10px label. */
const RailItem: React.FC<ItemProps> = ({ item, onNavigate }) => (
  <NavLink
    to={item.to}
    end={item.end}
    onClick={onNavigate}
    title={item.label}
    className={({ isActive }) =>
      cn(
        'group relative flex h-12 w-[60px] flex-col items-center justify-center gap-0.5 rounded-md px-1 transition-colors duration-150 ease-fluent-standard',
        isActive
          ? 'text-brand-foreground'
          : 'text-nav-text hover:bg-nav-hover hover:text-text-primary active:bg-surface-pressed'
      )
    }
  >
    {({ isActive }) => {
      const Icon = isActive ? item.activeIcon ?? item.icon : item.icon;
      return (
        <>
          {isActive && <ActiveIndicator className="-left-1" />}
          <span className="relative">
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {hasBadge(item.badge) &&
              (isNumericBadge(item.badge) ? (
                <NavCounterBadge
                  value={item.badge}
                  className="absolute -top-1.5 left-3 ring-2 ring-nav-surface"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-brand ring-2 ring-nav-surface"
                />
              ))}
          </span>
          <span
            className={cn(
              'block w-full truncate text-center text-[10px] leading-[14px]',
              isActive ? 'font-semibold' : 'font-normal'
            )}
          >
            {item.label}
          </span>
          {item.isNew && <span className="sr-only">(new)</span>}
          {hasBadge(item.badge) && <span className="sr-only">({item.badge})</span>}
        </>
      );
    }}
  </NavLink>
);

/* ------------------------------------------------------------------------- */
/* Navigation list                                                           */
/* ------------------------------------------------------------------------- */

export interface ShellNavProps {
  navGroups: NavGroup[];
  /** `drawer` = expanded NavDrawer (240px), `rail` = collapsed Teams app bar (68px). */
  variant: 'drawer' | 'rail';
  onNavigate?: () => void;
  className?: string;
}

export const ShellNav: React.FC<ShellNavProps> = ({ navGroups, variant, onNavigate, className }) => {
  const baseId = React.useId();

  if (variant === 'rail') {
    return (
      <nav
        aria-label="Main navigation"
        className={cn('flex-1 overflow-y-auto overflow-x-hidden py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
      >
        {navGroups.map((group, gIdx) => (
          <div key={group.groupLabel ?? gIdx} role="group" aria-label={group.groupLabel}>
            {gIdx > 0 && <div aria-hidden="true" className="mx-4 my-1.5 h-px bg-border-subtle" />}
            <ul className="flex flex-col items-center gap-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <RailItem item={item} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Main navigation"
      className={cn('flex-1 overflow-y-auto overflow-x-hidden px-2 py-2', className)}
    >
      {navGroups.map((group, gIdx) => {
        const labelId = `${baseId}-group-${gIdx}`;
        return (
          <div
            key={group.groupLabel ?? gIdx}
            role="group"
            aria-labelledby={group.groupLabel ? labelId : undefined}
            className={cn(gIdx > 0 && 'mt-4')}
          >
            {group.groupLabel && (
              <div
                id={labelId}
                className="truncate px-3 pb-1.5 pt-1 text-overline uppercase text-text-muted"
              >
                {group.groupLabel}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <DrawerItem item={item} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
};

export default ShellNav;
