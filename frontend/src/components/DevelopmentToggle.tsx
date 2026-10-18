import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LockClosed16Regular, Wrench16Regular } from '@fluentui/react-icons';
import { 
  toggleDevelopmentOverride, 
  isDevelopmentOverrideEnabled 
} from '@/utils/developmentOverride';

interface DevelopmentToggleProps {
  className?: string;
}

const DevelopmentToggle: React.FC<DevelopmentToggleProps> = ({ className = "" }) => {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    setIsEnabled(isDevelopmentOverrideEnabled());
  }, []);

  const handleToggle = () => {
    const newState = toggleDevelopmentOverride();
    setIsEnabled(newState);
    
    // Force page refresh to apply changes immediately
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-body-strong text-text-secondary">
          Dev Override:
        </span>
        <span
          className={
            isEnabled
              ? 'inline-flex h-5 items-center gap-1.5 rounded-full border border-status-warning-border bg-status-warning-subtle px-2 text-caption-strong text-status-warning'
              : 'inline-flex h-5 items-center gap-1.5 rounded-full border border-border-subtle bg-surface-subtle px-2 text-caption-strong text-text-muted'
          }
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${isEnabled ? 'bg-status-warning' : 'bg-presence-offline'}`}
          />
          {isEnabled ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </div>

      <Button
        onClick={handleToggle}
        size="sm"
        variant={isEnabled ? "destructive" : "default"}
        className="gap-1.5"
      >
        {isEnabled ? (
          <LockClosed16Regular className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Wrench16Regular className="h-4 w-4" aria-hidden="true" />
        )}
        {isEnabled ? 'Disable' : 'Enable'}
      </Button>
    </div>
  );
};

export default DevelopmentToggle;
