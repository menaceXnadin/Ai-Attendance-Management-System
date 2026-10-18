import React from 'react';
import { PersonCircle20Regular, SignOut20Regular } from '@fluentui/react-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ShellAvatar } from '@/components/layout/ShellAccountMenu';

interface ProfileDropdownProps {
  name: string;
  onViewProfile: () => void;
  onSignOut: () => void;
}

const itemClass =
  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-body text-text-primary outline-none transition-colors duration-150 focus:bg-surface-hover focus:text-text-primary data-[highlighted]:bg-surface-hover';

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ name, onViewProfile, onSignOut }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-opacity duration-150 hover:opacity-90"
          aria-label="Open profile menu"
        >
          <span className="sr-only">Open profile menu</span>
          <ShellAvatar name={name} size="md" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-56 rounded-lg border-border-subtle bg-surface-raised p-1 text-text-primary shadow-lg"
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <ShellAvatar name={name} size="md" />
          <div className="min-w-0">
            <span className="block text-caption text-text-muted">Welcome back,</span>
            <span className="block truncate text-body-strong text-text-primary">{name}</span>
          </div>
        </div>
        <DropdownMenuSeparator className="mx-0 my-1 bg-border-subtle" />
        <DropdownMenuItem
          className={itemClass}
          onSelect={() => { setOpen(false); onViewProfile(); }}
        >
          <PersonCircle20Regular className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" />
          View Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-0 my-1 bg-border-subtle" />
        <DropdownMenuItem
          className={itemClass}
          onSelect={() => { setOpen(false); onSignOut(); }}
        >
          <SignOut20Regular className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropdown;
