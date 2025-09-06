import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
        <span className="text-sm font-medium text-slate-300">
          Dev Override:
        </span>
        <Badge 
          variant={isEnabled ? "default" : "secondary"}
          className={`${
            isEnabled 
              ? 'bg-orange-500/20 text-orange-300 border-orange-400/30' 
              : 'bg-slate-500/20 text-slate-400 border-slate-400/30'
          }`}
        >
          {isEnabled ? 'ACTIVE' : 'INACTIVE'}
        </Badge>
      </div>
      
      <Button
        onClick={handleToggle}
        size="sm"
        variant={isEnabled ? "destructive" : "default"}
        className={`${
          isEnabled 
            ? 'bg-red-600 hover:bg-red-700 text-white' 
            : 'bg-orange-600 hover:bg-orange-700 text-white'
        }`}
      >
        {isEnabled ? '🔒 Disable' : '🔧 Enable'}
      </Button>
    </div>
  );
};

export default DevelopmentToggle;
