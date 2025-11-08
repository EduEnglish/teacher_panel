import type { ResponsiveContainerProps } from 'recharts'
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts'

type AccuracyBarChartProps = {
  data: Array<{ unitTitle: string; accuracy: number }>
  height?: number
  responsiveProps?: ResponsiveContainerProps
}

export function AccuracyBarChart({ data, height = 280, responsiveProps }: AccuracyBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height} {...responsiveProps}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
        <XAxis dataKey="unitTitle" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} domain={[0, 100]} />
        <Tooltip cursor={{ fill: '#EEF2FF' }} formatter={(value: number) => [`${value}%`, 'Accuracy']} labelStyle={{ fontWeight: 600 }} />
        <Bar dataKey="accuracy" radius={[12, 12, 12, 12]} fill="var(--chart-primary, #2563EB)" />
      </BarChart>
    </ResponsiveContainer>
  )
}


