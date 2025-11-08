import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

const COLORS = ['#2563EB', '#38BDF8', '#6366F1', '#0EA5E9']

type QuizTypePieChartProps = {
  data: Array<{ type: string; count: number }>
  height?: number
}

export function QuizTypePieChart({ data, height = 280 }: QuizTypePieChartProps) {
  const total = data.reduce((acc, item) => acc + item.count, 0)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="type"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={6}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${entry.type}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number, _name, { payload }) => [`${value} attempts`, payload?.type ?? '']} />
        <Legend />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-sm">
          {total} attempts
        </text>
      </PieChart>
    </ResponsiveContainer>
  )
}


