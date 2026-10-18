import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

/**
 * Fluent 2 feature card: flat neutral surface with shadow-4 elevation,
 * brand-tinted icon chip, subheading title and body description.
 */
const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, className }) => {
  return (
    <Card
      className={cn(
        'h-full rounded-lg border-transparent bg-surface-default shadow transition-shadow duration-150 ease-fluent-standard hover:shadow-md',
        className
      )}
    >
      <CardHeader className="space-y-0 p-5 pb-2">
        <div
          className="mb-4 grid h-10 w-10 place-items-center rounded-md bg-brand-subtle text-brand-foreground [&_svg]:h-5 [&_svg]:w-5"
          aria-hidden
        >
          {icon}
        </div>
        <CardTitle className="text-subheading text-text-primary">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <p className="text-body text-text-secondary">{description}</p>
      </CardContent>
    </Card>
  );
};

export default FeatureCard;
