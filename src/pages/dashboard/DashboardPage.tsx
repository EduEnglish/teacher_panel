import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Layers, ListChecks, NotebookPen, Trophy } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatsCard } from '@/components/feedback/StatsCard'
import { computeDashboardCounts } from '@/services/firebase'
import { useUI } from '@/context/UIContext'
import { formatPercentage } from '@/utils/formatters'

export function DashboardPage() {
  const { setPageTitle, notifyError } = useUI()
  const [isLoading, setIsLoading] = useState(true)
  const [counts, setCounts] = useState({
    grades: 0,
    units: 0,
    lessons: 0,
    sections: 0,
    quizzes: 0,
    practices: 0,
    averageAccuracy: 0,
    mostPracticedUnit: 'Awaiting data',
    mostChallengingLesson: 'Awaiting data',
  })
  useEffect(() => {
    setPageTitle('Teacher Dashboard')
  }, [setPageTitle])

  useEffect(() => {
    async function loadDashboard() {
      try {
        setIsLoading(true)
        const countsResponse = await computeDashboardCounts()
        setCounts({
          grades: countsResponse.grades,
          units: countsResponse.units,
          lessons: countsResponse.lessons,
          sections: countsResponse.sections,
          quizzes: countsResponse.quizzes,
          practices: countsResponse.practices,
          averageAccuracy: countsResponse.averageAccuracy,
          mostPracticedUnit: countsResponse.mostPracticedUnit ?? 'Awaiting data',
          mostChallengingLesson: countsResponse.mostChallengingLesson ?? 'Awaiting data',
        })
      } catch (error) {
        notifyError('Unable to load dashboard data', error instanceof Error ? error.message : undefined)
      } finally {
        setIsLoading(false)
      }
    }
    loadDashboard()
  }, [notifyError])

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


