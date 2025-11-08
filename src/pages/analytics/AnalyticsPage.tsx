import { useEffect, useMemo, useState } from 'react'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AccuracyBarChart } from '@/components/charts/AccuracyBarChart'
import { QuizTypePieChart } from '@/components/charts/QuizTypePieChart'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { gradeService, lessonService, unitService, fetchAccuracyByUnit, fetchPracticeTable, fetchQuizTypeDistribution } from '@/services/firebase'
import type { Grade, Lesson, PracticeAggregate, Unit } from '@/types/models'
import { useCollection } from '@/hooks/useCollection'
import { useUI } from '@/context/UIContext'
import { formatPercentage } from '@/utils/formatters'

type LessonAnalyticsRow = {
  lessonId: string
  lessonTitle: string
  attempts: number
  accuracy: number
  quizType?: string
}

export function AnalyticsPage() {
  const { setPageTitle, notifyError, notifySuccess } = useUI()
  const [selectedGradeId, setSelectedGradeId] = useState<string | 'all'>('all')
  const [selectedUnitId, setSelectedUnitId] = useState<string | 'all'>('all')
  const [selectedLessonId, setSelectedLessonId] = useState<string | 'all'>('all')

  const { data: grades } = useCollection<Grade>(gradeService.listen)
  const { data: units } = useCollection<Unit>(unitService.listen)
  const { data: lessons } = useCollection<Lesson>(lessonService.listen)

  const [accuracyData, setAccuracyData] = useState<Array<{ unitId: string; unitTitle: string; accuracy: number }>>([])
  const [quizDistribution, setQuizDistribution] = useState<Array<{ type: string; count: number }>>([])
  const [practiceRecords, setPracticeRecords] = useState<PracticeAggregate[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setPageTitle('Student Practice Analytics')
  }, [setPageTitle])

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setIsLoading(true)
        const [accuracy, distribution, practice] = await Promise.all([
          fetchAccuracyByUnit(),
          fetchQuizTypeDistribution(),
          fetchPracticeTable({
            gradeId: selectedGradeId === 'all' ? undefined : selectedGradeId,
            unitId: selectedUnitId === 'all' ? undefined : selectedUnitId,
            lessonId: selectedLessonId === 'all' ? undefined : selectedLessonId,
          }),
        ])
        setAccuracyData(accuracy)
        setQuizDistribution(Object.entries(distribution).map(([type, count]) => ({ type, count })))
        setPracticeRecords(practice)
      } catch (error) {
        notifyError('Unable to load analytics', error instanceof Error ? error.message : undefined)
      } finally {
        setIsLoading(false)
      }
    }
    loadAnalytics()
  }, [selectedGradeId, selectedUnitId, selectedLessonId, notifyError])

  const filteredUnits = useMemo(
    () => (selectedGradeId === 'all' ? units : units.filter((unit) => unit.gradeId === selectedGradeId)),
    [units, selectedGradeId],
  )

  const filteredLessons = useMemo(
    () =>
      lessons.filter((lesson) => {
        if (selectedGradeId !== 'all' && lesson.gradeId !== selectedGradeId) return false
        if (selectedUnitId !== 'all' && lesson.unitId !== selectedUnitId) return false
        return true
      }),
    [lessons, selectedGradeId, selectedUnitId],
  )

  const metrics = useMemo(() => {
    const totalAttempts = practiceRecords.reduce((sum, record) => sum + (record.attempts ?? 0), 0)
    const totalCorrect = practiceRecords.reduce((sum, record) => sum + (record.correct ?? 0), 0)
    const averageAccuracy = totalAttempts ? Number(((totalCorrect / totalAttempts) * 100).toFixed(2)) : 0

    const unitAttempts = new Map<string, number>()
    const lessonAccuracy = new Map<string, { accuracy: number; attempts: number }>()

    practiceRecords.forEach((record) => {
      if (record.unitId) {
        unitAttempts.set(record.unitId, (unitAttempts.get(record.unitId) ?? 0) + (record.attempts ?? 0))
      }
      if (record.lessonId) {
        const accuracy = record.accuracy ?? (record.attempts ? (record.correct ?? 0) / record.attempts : 0)
        lessonAccuracy.set(record.lessonId, {
          accuracy,
          attempts: (record.attempts ?? 0) + (lessonAccuracy.get(record.lessonId)?.attempts ?? 0),
        })
      }
    })

    const mostPracticedUnitId = Array.from(unitAttempts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
    const mostChallengingLessonId = Array.from(lessonAccuracy.entries()).sort(
      (a, b) => (a[1].accuracy ?? 0) - (b[1].accuracy ?? 0),
    )[0]?.[0]

    const totalTimeSeconds = practiceRecords.reduce((sum, record) => sum + (record.totalTimeSeconds ?? 0), 0)

    return {
      totalAttempts,
      totalCorrect,
      averageAccuracy,
      totalTimeSeconds,
      mostPracticedUnit: units.find((unit) => unit.id === mostPracticedUnitId)?.title ?? '—',
      mostChallengingLesson: lessons.find((lesson) => lesson.id === mostChallengingLessonId)?.title ?? '—',
    }
  }, [practiceRecords, lessons, units])

  const lessonRows: LessonAnalyticsRow[] = useMemo(() => {
    const grouped = practiceRecords.reduce<Map<string, LessonAnalyticsRow>>((acc, record) => {
      if (!record.lessonId) return acc
      const existing = acc.get(record.lessonId) ?? {
        lessonId: record.lessonId,
        lessonTitle: lessons.find((lesson) => lesson.id === record.lessonId)?.title ?? 'Unknown Lesson',
        attempts: 0,
        accuracy: 0,
        quizType: record.quizType,
      }
      const attempts = existing.attempts + (record.attempts ?? 0)
      const accuracy =
        attempts > 0
          ? ((existing.accuracy * existing.attempts + (record.accuracy ?? 0) * (record.attempts ?? 0)) / attempts)
          : existing.accuracy
      acc.set(record.lessonId, {
        ...existing,
        attempts,
        accuracy,
      })
      return acc
    }, new Map())

    return Array.from(grouped.values()).map((row) => ({
      ...row,
      accuracy: Number((row.accuracy * 100).toFixed(2)),
    }))
  }, [practiceRecords, lessons])

  const columns: Array<DataTableColumn<LessonAnalyticsRow>> = [
    { key: 'lessonTitle', header: 'Lesson' },
    {
      key: 'attempts',
      header: 'Attempts',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.attempts}</span>,
    },
    {
      key: 'accuracy',
      header: 'Accuracy',
      render: (row) => <Badge variant="secondary">{formatPercentage(row.accuracy, 1)}</Badge>,
    },
    {
      key: 'quizType',
      header: 'Quiz Type',
      render: (row) => (row.quizType ? <Badge variant="outline">{row.quizType}</Badge> : '—'),
    },
  ]

  const handleExportCSV = () => {
    if (!lessonRows.length) {
      notifyError('No data to export')
      return
    }
    const headers = ['Lesson', 'Attempts', 'Accuracy', 'Quiz Type']
    const rows = lessonRows.map((row) => [
      `"${row.lessonTitle}"`,
      row.attempts,
      `${row.accuracy.toFixed(2)}%`,
      row.quizType ?? '',
    ])
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, 'eduenglish-analytics.csv')
    notifySuccess('Analytics exported as CSV')
  }

  const handleExportPDF = () => {
    if (!lessonRows.length) {
      notifyError('No data to export')
      return
    }
    const doc = new jsPDF()
    doc.text('EduEnglish Analytics Report', 14, 16)
    autoTable(doc, {
      startY: 22,
      head: [['Lesson', 'Attempts', 'Accuracy', 'Quiz Type']],
      body: lessonRows.map((row) => [
        row.lessonTitle,
        row.attempts.toString(),
        `${row.accuracy.toFixed(2)}%`,
        row.quizType ?? '',
      ]),
    })
    doc.save('eduenglish-analytics.pdf')
    notifySuccess('Analytics exported as PDF')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Analytics Overview</h2>
          <p className="text-sm text-muted-foreground">
            Track engagement and mastery trends across grades, units, and lessons.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="outline" onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button onClick={handleExportPDF}>Export PDF</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardDescription>Total Exercises Attempted</CardDescription>
            <CardTitle className="text-3xl font-semibold text-primary">{metrics.totalAttempts}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardDescription>Average Accuracy</CardDescription>
            <CardTitle className="text-3xl font-semibold text-primary">
              {formatPercentage(metrics.averageAccuracy, 1)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardDescription>Most Practiced Unit</CardDescription>
            <CardTitle className="text-base font-semibold text-foreground">{metrics.mostPracticedUnit}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardDescription>Most Challenging Lesson</CardDescription>
            <CardTitle className="text-base font-semibold text-foreground">{metrics.mostChallengingLesson}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <Select
            value={selectedGradeId}
            onValueChange={(value: string) => {
              setSelectedGradeId(value as typeof selectedGradeId)
              setSelectedUnitId('all')
              setSelectedLessonId('all')
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Grade" />
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
          <Select
            value={selectedUnitId}
            onValueChange={(value: string) => {
              setSelectedUnitId(value as typeof selectedUnitId)
              setSelectedLessonId('all')
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All units</SelectItem>
              {filteredUnits.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedLessonId} onValueChange={(value: string) => setSelectedLessonId(value as typeof selectedLessonId)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Lesson" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lessons</SelectItem>
              {filteredLessons.map((lesson) => (
                <SelectItem key={lesson.id} value={lesson.id}>
                  {lesson.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs text-muted-foreground">
          Filtered records: {practiceRecords.length}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Accuracy by Unit</CardTitle>
            <CardDescription>Identify strengths and opportunities across the curriculum.</CardDescription>
          </CardHeader>
          <CardContent>
            {accuracyData.length ? (
              <AccuracyBarChart data={accuracyData} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No practice data yet for the selected filters.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Quiz Type Distribution</CardTitle>
            <CardDescription>See where learners spend their practice time.</CardDescription>
          </CardHeader>
          <CardContent>
            {quizDistribution.length ? (
              <QuizTypePieChart data={quizDistribution} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No quiz attempts available for the selected filters.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Lesson Attempts & Accuracy</CardTitle>
          <CardDescription>Aggregate performance metrics without exposing identifiable data.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={lessonRows}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No practice records yet. Encourage students to engage with lessons to populate this view."
          />
        </CardContent>
      </Card>
    </div>
  )
}


