import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const CHART_CONFIGS = {
  heart_rate: {
    label: 'Heart Rate',
    unit: 'bpm',
    color: '#FF3B3B',
    normalMin: 60,
    normalMax: 100,
    domain: ['dataMin - 10', 'dataMax + 10'],
  },
  spo2: {
    label: 'SpO₂',
    unit: '%',
    color: '#00D4FF',
    normalMin: 95,
    normalMax: 100,
    domain: [85, 101],
  },
  hrv: {
    label: 'HRV',
    unit: 'ms',
    color: '#00FF9D',
    normalMin: 20,
    normalMax: 70,
    domain: ['dataMin - 5', 'dataMax + 5'],
  },
  respiratory_rate: {
    label: 'Resp. Rate',
    unit: 'brpm',
    color: '#FF9500',
    normalMin: 12,
    normalMax: 20,
    domain: ['dataMin - 2', 'dataMax + 2'],
  },
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-bg-elevated border border-bg-border rounded-lg p-2 text-xs font-mono">
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value} {entry.unit}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function VitalsChart({ data, metrics = ['heart_rate', 'spo2'], title, height = 90 }) {
  if (!data || data.length === 0) return null

  const chartData = data.slice(-60).map((d, i) => ({
    index: i,
    ...metrics.reduce((acc, m) => ({ ...acc, [m]: d[m] }), {}),
  }))

  const cfg0 = CHART_CONFIGS[metrics[0]]

  return (
    <div className="bg-bg-surface border border-bg-border rounded-xl p-2 flex flex-col gap-1">
      <div className="flex items-baseline justify-between px-1">
        <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
          {title || metrics.map(m => CHART_CONFIGS[m]?.label || m).join(' + ')}
        </span>
        {cfg0 && (
          <span className="text-xs font-mono" style={{ color: cfg0.color }}>
            {chartData.at(-1)?.[metrics[0]]?.toFixed(0)} {cfg0.unit}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" vertical={false} />
          <XAxis dataKey="index" hide />
          <YAxis
            tick={{ fill: '#4A5F80', fontSize: 9, fontFamily: 'DM Mono' }}
            tickLine={false}
            axisLine={false}
            tickCount={3}
          />
          <Tooltip content={<CustomTooltip />} />

          {metrics.map(m => {
            const cfg = CHART_CONFIGS[m]
            if (!cfg) return null
            return [
              cfg.normalMin && (
                <ReferenceLine key={`min-${m}`} y={cfg.normalMin} stroke={cfg.color} strokeDasharray="4 4" strokeOpacity={0.3} />
              ),
              cfg.normalMax && (
                <ReferenceLine key={`max-${m}`} y={cfg.normalMax} stroke={cfg.color} strokeDasharray="4 4" strokeOpacity={0.3} />
              ),
              <Line
                key={m}
                type="monotone"
                dataKey={m}
                name={cfg.label}
                unit={cfg.unit}
                stroke={cfg.color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: cfg.color }}
                isAnimationActive={false}
              />
            ]
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
