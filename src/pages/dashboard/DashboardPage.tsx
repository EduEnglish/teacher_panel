import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Layers, ListChecks, NotebookPen, Trophy } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatsCard } from '@/components/feedback/StatsCard'
import { useCollection } from '@/hooks/useCollection'
import { practiceService } from '@/services/firebase'
import { useCurriculumCache } from '@/context/CurriculumCacheContext'
import { useUI } from '@/context/UIContext'
import { formatPercentage } from '@/utils/formatters'

export function DashboardPage() {
  const { setPageTitle } = useUI()
  const { grades, allUnits, allLessons, allSections, allQuizzes, isLoading: cacheLoading } = useCurriculumCache()
  const { data: practices, isLoading: practicesLoading } = useCollection(practiceService.listen)

  useEffect(() => {
    setPageTitle('Teacher Dashboard')
  }, [setPageTitle])

  // Compute counts from cached data
  const counts = useMemo(() => {
    // Calculate average accuracy from practices
    let totalAccuracy = 0
    let accuracyCount = 0
    
    practices.forEach((practice) => {
      if (typeof practice.accuracy === 'number') {
        totalAccuracy += practice.accuracy
        accuracyCount += 1
      } else if (typeof practice.correct === 'number' && typeof practice.attempts === 'number' && practice.attempts > 0) {
        totalAccuracy += (practice.correct / practice.attempts) * 100
        accuracyCount += 1
      }
    })
    
    const averageAccuracy = accuracyCount ? Number((totalAccuracy / accuracyCount).toFixed(2)) : 0

    // Find most practiced unit (unit with most practice attempts)
    let mostPracticedUnitId: string | undefined
    let mostPracticedAttempts = -1
    
    practices.forEach((practice) => {
      if (practice.unitId) {
        const attempts = practice.attempts ?? 0
        if (attempts > mostPracticedAttempts) {
          mostPracticedAttempts = attempts
          mostPracticedUnitId = practice.unitId
        }
      }
    })
    
    let mostPracticedUnit = 'Awaiting data'
    if (mostPracticedUnitId) {
      const unit = allUnits.find((u) => u.id === mostPracticedUnitId)
      mostPracticedUnit = unit ? `Unit ${unit.number}` : 'Awaiting data'
    }

    // Find most challenging lesson (lesson with lowest accuracy)
    let mostChallengingLessonId: string | undefined
    let lowestAccuracy = Number.POSITIVE_INFINITY
    
    practices.forEach((practice) => {
      if (practice.lessonId) {
        const accuracy = practice.accuracy ?? (practice.attempts ? (practice.correct ?? 0) / practice.attempts * 100 : 0)
        if (accuracy < lowestAccuracy) {
          lowestAccuracy = accuracy
          mostChallengingLessonId = practice.lessonId
        }
      }
    })
    
    let mostChallengingLesson = 'Awaiting data'
    if (mostChallengingLessonId) {
      const lesson = allLessons.find((l) => l.id === mostChallengingLessonId)
      mostChallengingLesson = lesson?.title ?? 'Awaiting data'
    }

    return {
      grades: grades.length,
      units: allUnits.length,
      lessons: allLessons.length,
      sections: allSections.length,
      quizzes: allQuizzes.length,
      practices: practices.length,
      averageAccuracy,
      mostPracticedUnit,
      mostChallengingLesson,
    }
  }, [grades, allUnits, allLessons, allSections, allQuizzes, practices])

  const isLoading = cacheLoading || practicesLoading

  const quickLinks = [
    {
      title: 'Manage Curriculum',
      description: 'Create and update the full English learning roadmap.',
      to: '/curriculum/grades',
      icon: <Layers className="h-5 w-5" />,
    },
  ]

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Total Grades"
          value={isLoading ? '—' : counts.grades.toString()}
          description="Complete grade levels configured"
          icon={<GraduationCap className="h-8 w-8" />}
        />
        <StatsCard
          title="Total Units"
          value={isLoading ? '—' : counts.units.toString()}
          description="Structured learning units"
          icon={<Layers className="h-8 w-8" />}
        />
        <StatsCard
          title="Total Lessons"
          value={isLoading ? '—' : counts.lessons.toString()}
          description="Lesson plans ready for students"
          icon={<NotebookPen className="h-8 w-8" />}
        />
        <StatsCard
          title="Quizzes Published"
          value={isLoading ? '—' : counts.quizzes.toString()}
          description="Interactive assessments"
          icon={<ListChecks className="h-8 w-8" />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border-none bg-primary/5 shadow-none">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Student Practice Highlights</CardTitle>
            <CardDescription>Aggregated performance indicators.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start justify-between rounded-xl bg-white/70 p-4 shadow">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Average Accuracy</p>
                <p className="text-2xl font-semibold text-primary">{formatPercentage(counts.averageAccuracy, 1)}</p>
              </div>
              <Trophy className="h-8 w-8 text-primary/80" />
            </div>
            <div className="rounded-xl bg-white/70 p-4 shadow">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Most Practiced Unit</p>
              <p className="mt-1 text-base font-medium text-foreground">{counts.mostPracticedUnit || 'Awaiting data'}</p>
            </div>
            <div className="rounded-xl bg-white/70 p-4 shadow">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Most Challenging Lesson</p>
              <p className="mt-1 text-base font-medium text-foreground">{counts.mostChallengingLesson || 'Awaiting data'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Quick Links</CardTitle>
            <CardDescription>Jump directly into high-impact workflows.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {quickLinks.map((link) => (
              <div key={link.title} className="group flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex items-center gap-3 text-primary">{link.icon}</div>
                <div className="mt-4 space-y-2">
                  <p className="text-base font-semibold text-foreground">{link.title}</p>
                  <p className="text-sm text-muted-foreground">{link.description}</p>
                </div>
                <Button variant="link" className="mt-4 w-fit px-0" asChild>
                  <Link to={link.to}>Open</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}


