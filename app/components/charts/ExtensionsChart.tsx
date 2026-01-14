import { type FC } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '~/styles/srOnly.css';

export type ExtensionsChartData = {
  date: string;
  count: number;
}

interface ExtensionsChartProps {
  data: ExtensionsChartData[];
  title?: string;
}

const ExtensionsChart: FC<ExtensionsChartProps> = ({ 
  data = [],
  title = 'Extensions Over Time'
}) => {
  const chartTitle = data.length > 0 
    ? `${title}: ${data.reduce((sum, d) => sum + d.count, 0)} total extensions`
    : `${title}: No data`;

  return (
    <div role="img" aria-label={chartTitle}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip 
            labelFormatter={(value) => `Date: ${value}`}
            formatter={(value: number) => [value, 'Extensions']}
            contentStyle={{
              backgroundColor: 'var(--p-color-bg-surface-secondary, #1f1f1f)',
              border: '1px solid var(--p-color-border-secondary, #3f3f3f)',
              borderRadius: '4px',
              color: 'var(--p-color-text, #ffffff)',
            }}
            labelStyle={{
              color: 'var(--p-color-text, #ffffff)',
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="count" 
            stroke="#00C49F" 
            strokeWidth={2}
            name="Extensions"
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="srOnly">
        <h3>{title}</h3>
        <ul>
          {data.map((item, index) => (
            <li key={index}>
              {item.date}: {item.count} extension{item.count !== 1 ? 's' : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ExtensionsChart;
