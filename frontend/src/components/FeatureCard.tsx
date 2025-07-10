import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

const FeatureCard = ({ icon, title, description, className }: FeatureCardProps) => {
  return (
    <Card className={cn("feature-card border-blue-800 bg-blue-950/80 text-blue-100 shadow-lg hover:border-teal-400 hover:shadow-2xl transition-all", className)}>
      <CardHeader className="space-y-0 pb-2">
        <div className="h-12 w-12 rounded-md bg-blue-900 text-teal-400 flex items-center justify-center mb-4">
          {icon}
        </div>
        <CardTitle className="text-xl text-teal-300">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-blue-100">{description}</p>
      </CardContent>
    </Card>
  );
};

export default FeatureCard;
