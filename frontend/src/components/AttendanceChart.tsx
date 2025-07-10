import * as React from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { XAxis as RechartsXAxis, YAxis as RechartsYAxis } from 'recharts';

// @ts-ignore: Suppress TypeScript error for XAxis
const XAxis = React.forwardRef<any, any>((props, ref) => <RechartsXAxis {...props} ref={ref} />);

// @ts-ignore: Suppress TypeScript error for YAxis
const YAxis = React.forwardRef<any, any>((props, ref) => <RechartsYAxis {...props} ref={ref} />);

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

const COLORS = ['#38bdf8', '#0ea5e9', '#2563eb'];

const AttendanceChart = ({ data, title, description, type = 'bar' }: AttendanceChartProps) => {
  const renderChart = () => {
    switch (type) {
      case 'pie':
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
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
        
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="present" stroke="#38bdf8" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="absent" stroke="#0ea5e9" />
              <Line type="monotone" dataKey="late" stroke="#2563eb" />
            </LineChart>
          </ResponsiveContainer>
        );
        
      default:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="present" fill="#38bdf8" />
              <Bar dataKey="absent" fill="#0ea5e9" />
              <Bar dataKey="late" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        );
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
