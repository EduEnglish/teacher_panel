import { useEffect, useMemo, useState } from 'react'
import { Users, TrendingUp, Target, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { StatsCard } from '@/components/feedback/StatsCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { gradeService, fetchStudentPerformance } from '@/services/firebase'
import type { Grade, StudentPerformance } from '@/types/models'
import { useCollection } from '@/hooks/useCollection'
import { useUI } from '@/context/UIContext'
import { formatPercentage, formatDate, getInitials } from '@/utils/formatters'

type StudentTableRow = StudentPerformance & {
  student: { id: string; name: string; email?: string; photoURL?: string }
}

export function StudentsPage() {
  const { setPageTitle, notifyError } = useUI()
  const [selectedGradeId, setSelectedGradeId] = useState<string | 'all'>('all')
  const [performanceData, setPerformanceData] = useState<StudentPerformance[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const { data: grades } = useCollection<Grade>(gradeService.listen)

  useEffect(() => {
    setPageTitle('Students Management')
  }, [setPageTitle])

  useEffect(() => {
    async function loadStudentPerformance() {
      try {
        setIsLoading(true)
        const data = await fetchStudentPerformance(selectedGradeId === 'all' ? undefined : selectedGradeId)
        setPerformanceData(data)
      } catch (error) {
        notifyError('Unable to load student data', error instanceof Error ? error.message : undefined)
      } finally {
        setIsLoading(false)
      }
    }
    loadStudentPerformance()
  }, [selectedGradeId, notifyError])

  const rows = useMemo<StudentTableRow[]>(() => {
    return performanceData.map((perf) => ({
      ...perf,
      student: {
        id: perf.studentId,
        name: perf.studentName,
        email: undefined,
        photoURL: undefined,
      },
    }))
  }, [performanceData])

  const summary = useMemo(() => {
    const total = performanceData.length
    const totalAttempts = performanceData.reduce((sum, p) => sum + p.totalAttempts, 0)
    const avgAccuracy =
      performanceData.length > 0
        ? performanceData.reduce((sum, p) => sum + p.averageAccuracy, 0) / performanceData.length
        : 0
    const activeStudents = performanceData.filter((p) => p.lastActivityAt).length

    return { total, totalAttempts, avgAccuracy, activeStudents }
  }, [performanceData])

  const columns: Array<DataTableColumn<StudentTableRow>> = [
    {
      key: 'student',
      header: 'Student',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={row.student.photoURL} alt={row.studentName} />
            <AvatarFallback>{getInitials(row.studentName)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">{row.studentName}</p>
            {row.gradeName && <p className="text-xs text-muted-foreground">{row.gradeName}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'averageAccuracy',
      header: 'Accuracy',
      align: 'center',
      render: (row) => (
        <Badge
          variant={row.averageAccuracy >= 80 ? 'default' : row.averageAccuracy >= 60 ? 'secondary' : 'destructive'}
          className="font-semibold"
        >
          {formatPercentage(row.averageAccuracy, 1)}
        </Badge>
      ),
    },
    {
      key: 'totalAttempts',
      header: 'Attempts',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.totalAttempts}</span>,
    },
    {
      key: 'totalCorrect',
      header: 'Correct',
      align: 'center',
      render: (row) => <span className="font-medium text-muted-foreground">{row.totalCorrect}</span>,
    },
    {
      key: 'quizzesCompleted',
      header: 'Quizzes',
      align: 'center',
      render: (row) => <span className="font-medium text-muted-foreground">{row.quizzesCompleted}</span>,
    },
    {
      key: 'lastActivityAt',
      header: 'Last Activity',
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.lastActivityAt ? formatDate(row.lastActivityAt) : 'Never'}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Students</h2>
          <p className="text-sm text-muted-foreground">View student performance and results by grade level.</p>
        </div>
        <Select value={selectedGradeId} onValueChange={(value: string) => setSelectedGradeId(value as typeof selectedGradeId)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All grades</SelectItem>
            {grades.map((grade) => (
              <SelectItem key={grade.id} value={grade.id}>
                {grade.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Total Students"
          value={isLoading ? '—' : summary.total.toString()}
          description="Students in selected grade"
          icon={<Users className="h-8 w-8" />}
        />
        <StatsCard
          title="Total Attempts"
          value={isLoading ? '—' : summary.totalAttempts.toString()}
          description="Practice exercises completed"
          icon={<Target className="h-8 w-8" />}
        />
        <StatsCard
          title="Average Accuracy"
          value={isLoading ? '—' : formatPercentage(summary.avgAccuracy, 1)}
          description="Overall performance"
          icon={<TrendingUp className="h-8 w-8" />}
        />
        <StatsCard
          title="Active Students"
          value={isLoading ? '—' : summary.activeStudents.toString()}
          description="Recently engaged"
          icon={<Clock className="h-8 w-8" />}
        />
      </section>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Student Performance</CardTitle>
          <CardDescription>
            {selectedGradeId === 'all'
              ? 'View all students and their learning progress across all grades.'
              : `Students enrolled in ${grades.find((g) => g.id === selectedGradeId)?.name ?? 'selected grade'}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={rows}
            columns={columns}
            isLoading={isLoading}
            emptyMessage={
              selectedGradeId === 'all'
                ? 'No students found. Students will appear here once they start practicing.'
                : 'No students found for the selected grade. Try selecting a different grade or check if students are enrolled.'
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}

