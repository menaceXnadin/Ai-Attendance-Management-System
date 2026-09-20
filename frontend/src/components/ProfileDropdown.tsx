import React from 'react';

interface ProfileDropdownProps {
  name: string;
  onViewProfile: () => void;
  onSignOut: () => void;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ name, onViewProfile, onSignOut }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        className="flex items-center justify-center w-8 h-8 rounded-full bg-action-primary text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-action-primary focus:ring-offset-2"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open profile menu"
      >
        <span className="sr-only">Open profile menu</span>
        {name ? name.charAt(0).toUpperCase() : 'U'}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-surface-default border border-border-default rounded-md shadow-lg z-50 py-1">
          <div className="px-3.5 py-2.5 border-b border-border-subtle">
            <span className="block text-[11px] text-text-muted">Welcome back,</span>
            <span className="block text-xs font-semibold text-text-primary truncate">{name}</span>
          </div>
          <button
            className="w-full text-left px-3.5 py-2 text-xs text-text-primary hover:bg-surface-subtle transition-colors"
            onClick={() => { setOpen(false); onViewProfile(); }}
          >
            View Profile
          </button>
          <div className="border-t border-border-subtle my-1" />
          <button
            className="w-full text-left px-3.5 py-2 text-xs text-status-error hover:bg-status-error-subtle transition-colors"
            onClick={() => { setOpen(false); onSignOut(); }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
