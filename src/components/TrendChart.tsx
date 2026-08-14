import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface TrendPoint {
  label: string;
  value: number;
}

/**
 * A small line chart for e1RM / volume / weight over time. Accepts an explicit
 * `width` for deterministic (test) rendering; otherwise fills its container
 * responsively.
 */
export function TrendChart({
  data,
  color = '#8FE81E',
  height = 200,
  width,
  unit = '',
}: {
  data: TrendPoint[];
  color?: string;
  height?: number;
  width?: number;
  unit?: string;
}) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center  border border-slate-800 text-sm text-slate-500"
        style={{ height }}
      >
        Not enough data yet
      </div>
    );
  }

  const inner = (
    <>
      <CartesianGrid stroke="#1e293b" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fill: '#64748b', fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        minTickGap={20}
      />
      <YAxis
        tick={{ fill: '#64748b', fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        width={40}
        domain={['dataMin - 5', 'dataMax + 5']}
      />
      <Tooltip
        contentStyle={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 12,
          color: '#e2e8f0',
        }}
        formatter={(value: number | string) => [`${value}${unit ? ` ${unit}` : ''}`, '']}
        labelStyle={{ color: '#94a3b8' }}
      />
      <Line
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={2}
        dot={{ r: 2, fill: color }}
        activeDot={{ r: 4 }}
        isAnimationActive={false}
      />
    </>
  );

  if (width) {
    return (
      <LineChart data={data} width={width} height={height} margin={{ top: 8, right: 8, left: -12 }}>
        {inner}
      </LineChart>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12 }}>
        {inner}
      </LineChart>
    </ResponsiveContainer>
  );
}
