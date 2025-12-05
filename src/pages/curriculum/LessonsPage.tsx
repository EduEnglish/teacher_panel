import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { PageLoader } from '@/components/feedback/PageLoader'
import { lessonSchema, type LessonFormValues } from '@/utils/schemas'
import { lessonTitleOptions } from '@/utils/constants'
import { hierarchicalLessonService } from '@/services/hierarchicalServices'
import { useCurriculumCache } from '@/context/CurriculumCacheContext'
import type { Lesson } from '@/types/models'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'

type LessonTableRow = Lesson & { gradeName: string; unitTitle: string; sectionCount: number }

export function LessonsPage() {
  const { gradeId, unitId } = useParams<{ gradeId: string; unitId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)

  const { grades, allUnits: cachedAllUnits, allSections: cachedAllSections, isLoading: cacheLoading, refreshLessons } = useCurriculumCache()
  
  // Get the current grade and unit
  const currentGrade = grades.find((g) => g.id === gradeId)
  const currentUnit = cachedAllUnits.find((u) => u.id === unitId && u.gradeId === gradeId)
  
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Redirect if gradeId or unitId is missing
  useEffect(() => {
    if (!gradeId) {
      navigate('/curriculum/grades')
      return
    }
    if (!unitId) {
      navigate(`/curriculum/${gradeId}/units`)
      return
    }
  }, [gradeId, unitId, navigate])

  // Load lessons for the unit from URL (hierarchical)
  useEffect(() => {
    if (!gradeId || !unitId) {
      setIsLoading(false)
      setLessons([])
      return
    }

    setIsLoading(true)
    const unsubscribe = hierarchicalLessonService.listen(gradeId, unitId, (data) => {
      // Ensure all lessons have required fields
      const validLessons = data.filter((lesson) => lesson.gradeId && lesson.unitId)
      setLessons(validLessons)
      setIsLoading(false)
    })

    return unsubscribe
  }, [gradeId, unitId])

  // Use cached sections from context
  const allSections = cachedAllSections

  const form = useForm<LessonFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(lessonSchema) as any,
    defaultValues: {
      gradeId: '',
      unitId: '',
      title: 'Grammar',
      order: 1,
    },
  })

  // Auto-calculate order when title changes for new lessons
  useEffect(() => {
    if (editingLesson || !gradeId || !unitId) return // Don't auto-calculate for editing or if missing params

    const title = form.getValues('title')

    if (title) {
      // Get existing lessons for this unit to calculate next order
      hierarchicalLessonService
        .getAll(gradeId, unitId)
        .then((existingLessons) => {
          const maxOrder = existingLessons.length > 0 
            ? Math.max(...existingLessons.map((l) => l.order ?? 0))
            : 0
          form.setValue('order', maxOrder + 1)
        })
        .catch(() => {
          // If error, default to 1
          form.setValue('order', 1)
        })
    } else {
      form.setValue('order', 1)
    }
  }, [form.watch('title'), editingLesson, gradeId, unitId])

  useEffect(() => {
    setPageTitle('Lessons')
  }, [setPageTitle])

  useEffect(() => {
    if (editingLesson) {
      form.reset({
        id: editingLesson.id,
        gradeId: editingLesson.gradeId,
        unitId: editingLesson.unitId,
        title: editingLesson.title as LessonFormValues['title'],
        order: editingLesson.order,
      })
    } else {
      form.reset({
        gradeId: gradeId || '',
        unitId: unitId || '',
        title: 'Grammar',
        order: 1, // Will be auto-calculated when title is selected
      })
    }
  }, [editingLesson, gradeId, unitId, form])

  const rows = useMemo<LessonTableRow[]>(() => {
    const gradeMap = new Map(grades.map((grade) => [grade.id, grade.name]))
    const unitMap = new Map(cachedAllUnits.map((unit) => [unit.id, `Unit ${unit.number}`]))
    const sectionCounts = allSections.reduce<Record<string, number>>((acc, section) => {
      acc[section.lessonId] = (acc[section.lessonId] ?? 0) + 1
      return acc
    }, {})

    return lessons
      .map((lesson) => ({
        ...lesson,
        gradeName: gradeMap.get(lesson.gradeId) ?? '—',
        unitTitle: unitMap.get(lesson.unitId) ?? '—',
        sectionCount: sectionCounts[lesson.id] ?? 0,
      }))
      .sort((a, b) => a.order - b.order)
  }, [lessons, grades, cachedAllUnits, allSections])

  const handleOpenNew = () => {
    setEditingLesson(null)
    setIsModalOpen(true)
  }

  const handleEdit = (lesson: Lesson) => {
    setEditingLesson(lesson)
    setIsModalOpen(true)
  }


  const handleDelete = async (lesson: Lesson) => {
    const confirmed = await confirmAction({
      title: 'Delete lesson?',
      description: `Are you sure you want to delete "${lesson.title}"?`,
      confirmLabel: 'Delete',
    })
    if (!confirmed) return
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      if (!lesson.gradeId || !lesson.unitId) {
        notifyError('Invalid lesson', 'Lesson missing gradeId or unitId')
        return
      }
      await hierarchicalLessonService.remove(lesson.gradeId, lesson.unitId, lesson.id)
      notifySuccess('Lesson deleted successfully')
      refreshLessons() // Refresh cache
    } catch (error) {
      notifyError('Unable to delete lesson', error instanceof Error ? error.message : undefined)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      if (!values.gradeId || !values.unitId) {
        notifyError('Grade and Unit required', 'Please select both grade and unit')
        return
      }

      // Check for duplicate lesson title in the same grade + unit
      const duplicateLesson = lessons.find(
        (l) =>
          l.title.toLowerCase().trim() === values.title.toLowerCase().trim() &&
          l.gradeId === gradeId &&
          l.unitId === unitId &&
          l.id !== editingLesson?.id,
      )
      if (duplicateLesson) {
        notifyError('Duplicate lesson', `A lesson with the title "${values.title}" already exists for this unit.`)
        return
      }

      if (editingLesson) {
        if (!editingLesson.gradeId || !editingLesson.unitId) {
          notifyError('Invalid lesson', 'Lesson missing gradeId or unitId')
          return
        }
        await hierarchicalLessonService.update(
          editingLesson.gradeId,
          editingLesson.unitId,
          editingLesson.id,
          {
            title: values.title,
            order: values.order,
          },
        )
        notifySuccess('Lesson updated successfully')
        refreshLessons() // Refresh cache
      } else {
        await hierarchicalLessonService.create(values.gradeId, values.unitId, {
          gradeId: values.gradeId,
          unitId: values.unitId,
          title: values.title,
          order: values.order,
        })
        notifySuccess('Lesson created successfully')
        refreshLessons() // Refresh cache
      }
      setIsModalOpen(false)
    } catch (error) {
      notifyError('Unable to save lesson', error instanceof Error ? error.message : undefined)
    }
  })

  const columns: Array<DataTableColumn<LessonTableRow>> = [
    { 
      key: 'title', 
      header: 'Lesson Title',
      render: (row) => (
        <div className="whitespace-normal break-words" title={row.title}>
          {row.title}
        </div>
      ),
    },
    {
      key: 'sectionCount',
      header: 'Sections',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.sectionCount}</span>,
    },
  ]

  // Show loader while data is loading
  if (cacheLoading || isLoading) {
    return <PageLoader />
  }

  // Show error only after loading is complete
  if (!gradeId || !unitId || !currentGrade || !currentUnit) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Grade or Unit not found</p>
          <Button asChild variant="link" className="mt-2">
            <Link to="/curriculum/grades">Back to Grades</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-medium text-foreground flex items-center gap-1.5 flex-wrap">
            <Link to="/curriculum" className="hover:text-primary transition-colors">
              {currentGrade.name}
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Link to={`/curriculum/${gradeId}/units`} className="hover:text-primary transition-colors">
              Unit {currentUnit.number}
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">Lessons</span>
          </h2>
          <p className="text-sm text-muted-foreground">Curate lesson experiences aligned with the unit narrative.</p>
        </div>
        <Button onClick={handleOpenNew} className="rounded-full px-6">
          Add Lesson
        </Button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No lessons yet. Add lessons to build out this unit."
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRowClick={(lesson) => navigate(`/curriculum/${gradeId}/${unitId}/${lesson.id}/sections`)}
      />

      <FormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLesson ? 'Edit Lesson' : 'Add Lesson'}
        description="Lessons deliver the core instruction experience."
        onSubmit={onSubmit}
        submitLabel={editingLesson ? 'Update Lesson' : 'Create Lesson'}
        isSubmitting={form.formState.isSubmitting}
      >
        <Form {...form}>
          <form className="space-y-4">
            <FormField
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lesson Title</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select lesson title" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {lessonTitleOptions.map((title) => (
                        <SelectItem key={title} value={title}>
                          {title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lesson Order</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      value={field.value ?? 1}
                      readOnly
                      className="bg-muted cursor-not-allowed"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Order is automatically calculated based on existing lessons in this unit.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </FormModal>
    </div>
  )
}


