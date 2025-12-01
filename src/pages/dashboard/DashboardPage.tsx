import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Layers, ListChecks, NotebookPen } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatsCard } from '@/components/feedback/StatsCard'
import { useCurriculumCache } from '@/context/CurriculumCacheContext'
import { useUI } from '@/context/UIContext'

export function DashboardPage() {
  const { setPageTitle } = useUI()
  const { grades, allUnits, allLessons, allSections, allQuizzes, isLoading: cacheLoading } = useCurriculumCache()

  useEffect(() => {
    setPageTitle('Teacher Dashboard')
  }, [setPageTitle])

  // Compute counts from cached data
  const counts = useMemo(() => {
    return {
      grades: grades.length,
      units: allUnits.length,
      lessons: allLessons.length,
      sections: allSections.length,
      quizzes: allQuizzes.length,
    }
  }, [grades, allUnits, allLessons, allSections, allQuizzes])

  const isLoading = cacheLoading

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

      <section>
        <Card className="border-none shadow-sm">
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


