import * as React from 'react';

interface StatsCardProps {
  title: string;
  stat: string | number;
  description: string;
  icon: React.ReactNode;
}

const StatsCard = ({ title, stat, description, icon }: StatsCardProps) => {
  return (
    <div className="bg-card rounded-lg shadow-sm px-6 py-5 border border-border">
      <div className="flex items-center">
        <div className="flex-shrink-0 h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
          {icon}
        </div>
        <div className="ml-4">
          <h3 className="text-sm font-medium text-card-foreground">{title}</h3>
          <div className="flex items-baseline">
            <p className="text-2xl font-semibold text-card-foreground">{stat}</p>
            <p className="ml-2 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface HeaderStatsProps {
  stats: {
    title: string;
    stat: string | number;
    description: string;
    icon: React.ReactNode;
  }[];
}

const HeaderStats = ({ stats }: HeaderStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <StatsCard
          key={index}
          title={stat.title}
          stat={stat.stat}
          description={stat.description}
          icon={stat.icon}
        />
      ))}
    </div>
  );
};

export default HeaderStats;
