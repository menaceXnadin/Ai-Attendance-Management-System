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
        className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white focus:outline-none"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open profile menu"
      >
        <span className="sr-only">Open profile menu</span>
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" fill="#fff" fillOpacity="0.7" />
          <circle cx="12" cy="17" r="6" fill="#fff" fillOpacity="0.3" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-lg z-50">
          <div className="px-4 py-3 border-b border-slate-700">
            <span className="block text-sm text-slate-300">Welcome back,</span>
            <span className="block font-semibold text-white">{name}</span>
          </div>
          <button
            className="w-full text-left px-4 py-2 hover:bg-slate-800 text-slate-200"
            onClick={() => { setOpen(false); onViewProfile(); }}
          >
            View Profile
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-slate-800 text-red-400 border-t border-slate-700"
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
