import * as React from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTheme } from '@/hooks/useTheme';

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

const AttendanceChart = ({ data, title, description, type = 'bar' }: AttendanceChartProps) => {
  const { theme } = useTheme();
  
  // Define colors based on theme - using clear, contrasting colors
  // Present = Green, Absent = Red, Late = Orange/Yellow
  const COLORS = {
    light: ['#22c55e', '#ef4444', '#f59e0b'],  // green-500, red-500, amber-500
    dark: ['#22c55e', '#ef4444', '#f59e0b'],   // green-500, red-500, amber-500
  };
  
  // Choose color set based on theme
  const colorSet = theme === 'dark' ? COLORS.dark : COLORS.light;
  
  // Grid and text colors
  const gridColor = theme === 'dark' ? '#374151' : '#e5e7eb';
  const textColor = theme === 'dark' ? '#f9fafb' : '#1f2937';
  
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
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colorSet[index % colorSet.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', borderColor: gridColor }} />
              <Legend formatter={(value) => <span style={{ color: textColor }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        );
      }
        
      case 'line': {
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke={textColor} />
              <YAxis stroke={textColor} />
              <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', borderColor: gridColor }} />
              <Legend formatter={(value) => <span style={{ color: textColor }}>{value}</span>} />
              <Line type="monotone" dataKey="present" stroke={colorSet[0]} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="absent" stroke={colorSet[1]} />
              <Line type="monotone" dataKey="late" stroke={colorSet[2]} />
            </LineChart>
          </ResponsiveContainer>
        );
      }
        
      default: {
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke={textColor} />
              <YAxis stroke={textColor} />
              <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', borderColor: gridColor }} />
              <Legend formatter={(value) => <span style={{ color: textColor }}>{value}</span>} />
              <Bar dataKey="present" fill={colorSet[0]} />
              <Bar dataKey="absent" fill={colorSet[1]} />
              <Bar dataKey="late" fill={colorSet[2]} />
            </BarChart>
          </ResponsiveContainer>
        );
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
};

export default AttendanceChart;
