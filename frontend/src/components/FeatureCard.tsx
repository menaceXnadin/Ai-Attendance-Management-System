import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, className }) => {
  return (
    <Card className={cn("border border-border-subtle bg-surface-default hover:border-border-default transition-colors shadow-2xs", className)}>
      <CardHeader className="space-y-0 pb-3">
        <div className="h-10 w-10 rounded-md bg-surface-canvas border border-border-subtle text-action-primary flex items-center justify-center mb-3">
          {icon}
        </div>
        <CardTitle className="text-base font-semibold text-text-primary">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-text-secondary leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
};

export default FeatureCard;
