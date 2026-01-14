import { type FC } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '~/styles/srOnly.css';

export type UpgradeFrequencyChartData = {
  frequency: number;
  customerCount: number;
  label: string;
}

interface UpgradeFrequencyChartProps {
  data: UpgradeFrequencyChartData[];
  title?: string;
}

const UpgradeFrequencyChart: FC<UpgradeFrequencyChartProps> = ({ 
  data = [],
  title = 'Upgrade Frequency Distribution'
}) => {
  const chartTitle = data.length > 0 
    ? `${title}: ${data.reduce((sum, d) => sum + d.customerCount, 0)} customers`
    : `${title}: No data`;

  return (
    <div role="img" aria-label={chartTitle}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="label" 
            tick={{ fontSize: 12 }}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip 
            formatter={(value: number) => [value, 'Customers']}
            labelFormatter={(label) => `Upgrades: ${label}`}
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
          <Bar 
            dataKey="customerCount" 
            fill="#0088FE" 
            name="Customers"
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="srOnly">
        <h3>{title}</h3>
        <ul>
          {data.map((item, index) => (
            <li key={index}>
              {item.label}: {item.customerCount} customer{item.customerCount !== 1 ? 's' : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default UpgradeFrequencyChart;
