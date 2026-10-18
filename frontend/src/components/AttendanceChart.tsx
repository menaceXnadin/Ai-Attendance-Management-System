import * as React from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface AttendanceData {
  name: string;
  present: number;
  absent: number;
  late: number;
}

interface AttendanceChartProps {
  data: AttendanceData[];
  title: string;
  description?: string;
  type?: 'bar' | 'pie' | 'line';
}

// Theme-aware semantic series colors (present / absent / late)
const colorSet = ['var(--status-success)', 'var(--status-error)', 'var(--status-warning)'];

const gridColor = 'var(--border-subtle)';
const axisTick = { fill: 'var(--text-muted)', fontSize: 12 };
const tooltipStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  boxShadow: 'var(--shadow-16)',
  color: 'var(--text-primary)',
  fontSize: 12,
};
const tooltipLabelStyle: React.CSSProperties = { color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 };
const tooltipItemStyle: React.CSSProperties = { color: 'var(--text-secondary)' };
const legendFormatter = (value: string) => (
  <span style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'capitalize' }}>{value}</span>
);

const AttendanceChart = ({ data, title, description, type = 'bar' }: AttendanceChartProps) => {
  const renderChart = () => {
    switch (type) {
      case 'pie': {
        const pieData = [
          { name: 'Present', value: data.reduce((acc, curr) => acc + curr.present, 0) },
          { name: 'Absent', value: data.reduce((acc, curr) => acc + curr.absent, 0) },
          { name: 'Late', value: data.reduce((acc, curr) => acc + curr.late, 0) }
        ];

        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                innerRadius={64}
                outerRadius={100}
                paddingAngle={2}
                stroke="var(--surface-default)"
                strokeWidth={2}
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colorSet[index % colorSet.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend iconType="circle" iconSize={8} formatter={legendFormatter} />
            </PieChart>
          </ResponsiveContainer>
        );
      }

      case 'line': {
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: gridColor }} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} cursor={{ stroke: gridColor }} />
              <Legend iconType="circle" iconSize={8} formatter={legendFormatter} />
              <Line type="monotone" dataKey="present" stroke={colorSet[0]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="absent" stroke={colorSet[1]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="late" stroke={colorSet[2]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      }

      default: {
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: gridColor }} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} cursor={{ fill: 'var(--surface-hover)' }} />
              <Legend iconType="circle" iconSize={8} formatter={legendFormatter} />
              <Bar dataKey="present" fill={colorSet[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="absent" fill={colorSet[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="late" fill={colorSet[2]} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        );
      }
    }
  };

  return (
    <Card className="border-0 bg-surface-default shadow">
      <CardHeader className="space-y-0.5 px-5 py-4">
        <CardTitle className="text-subheading text-text-primary">{title}</CardTitle>
        {description && <CardDescription className="text-caption text-text-muted">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {renderChart()}
      </CardContent>
    </Card>
  );
};

export default AttendanceChart;
