import * as React from 'react';

interface StatsCardProps {
  title: string;
  stat: string | number;
  description: string;
  icon: React.ReactNode;
}

const StatsCard = ({ title, stat, description, icon }: StatsCardProps) => {
  return (
    <div className="rounded-lg bg-surface-default px-5 py-4 shadow">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-caption text-text-muted">{title}</h3>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{stat}</p>
            <p className="text-caption text-text-muted">{description}</p>
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
