import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { where } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { specialLessonSchema, type SpecialLessonFormValues } from '@/utils/schemas'
import { gradeService, quizService, specialLessonService, unitService } from '@/services/firebase'
import type { Grade, Quiz, SpecialLesson, Unit } from '@/types/models'
import { useCollection } from '@/hooks/useCollection'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'
import { specialLessonTypeOptions, statusOptions } from '@/utils/constants'
import { formatDate } from '@/utils/formatters'

type SpecialLessonRow = SpecialLesson & {
  gradeName: string
  unitTitles: string[]
  quizTitles: string[]
}

export function SpecialLessonsPage() {
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()

  const [selectedGradeId, setSelectedGradeId] = useState<string | 'all'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLesson, setEditingLesson] = useState<SpecialLesson | null>(null)

  const { data: grades } = useCollection<Grade>(gradeService.listen)
  const unitConstraints = useMemo(() => (selectedGradeId === 'all' ? undefined : [where('gradeId', '==', selectedGradeId)]), [selectedGradeId])
  const { data: units } = useCollection<Unit>(unitService.listen, unitConstraints)
  const { data: quizzes } = useCollection<Quiz>(quizService.listen)
  const { data: specialLessons, isLoading } = useCollection<SpecialLesson>(specialLessonService.listen)

  useEffect(() => {
    setPageTitle('Special Lessons')
  }, [setPageTitle])

  const form = useForm<SpecialLessonFormValues>({
    resolver: zodResolver(specialLessonSchema) as any,
    defaultValues: {
      gradeId: '',
      lessonType: 'Revision',
      title: '',
      sourceUnitIds: [],
      linkedQuizIds: [],
      description: '',
      status: 'active',
    },
  })

  useEffect(() => {
    if (editingLesson) {
      form.reset({
        id: editingLesson.id,
        gradeId: editingLesson.gradeId,
        lessonType: editingLesson.lessonType,
        title: editingLesson.title,
        sourceUnitIds: editingLesson.sourceUnitIds,
        linkedQuizIds: editingLesson.linkedQuizIds,
        description: editingLesson.description ?? '',
        status: editingLesson.status,
      })
    } else {
      form.reset({
        gradeId: selectedGradeId === 'all' ? '' : selectedGradeId,
        lessonType: 'Revision',
        title: '',
        sourceUnitIds: [],
        linkedQuizIds: [],
        description: '',
        status: 'active',
      })
    }
  }, [editingLesson, selectedGradeId, form])

  const rows: SpecialLessonRow[] = specialLessons
    .map((lesson) => ({
      ...lesson,
      gradeName: grades.find((grade) => grade.id === lesson.gradeId)?.name ?? '—',
      unitTitles: lesson.sourceUnitIds
        .map((unitId) => units.find((unit) => unit.id === unitId)?.title ?? unitId)
        .filter(Boolean),
      quizTitles: lesson.linkedQuizIds
        .map((quizId) => quizzes.find((quiz) => quiz.id === quizId)?.title ?? quizId)
        .filter(Boolean),
    }))
    .sort((a, b) => a.title.localeCompare(b.title))

  const columns: Array<DataTableColumn<SpecialLessonRow>> = [
    { key: 'title', header: 'Lesson Title' },
    {
      key: 'lessonType',
      header: 'Type',
      render: (row) => <Badge variant="secondary">{row.lessonType}</Badge>,
    },
    { key: 'gradeName', header: 'Grade' },
    {
      key: 'unitTitles',
      header: 'Source Units',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.unitTitles.map((title) => (
            <Badge key={title} variant="outline">
              {title}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{row.status}</Badge>,
    },
  ]

  const handleOpenNew = () => {
    setEditingLesson(null)
    setIsModalOpen(true)
  }

  const handleEdit = (lesson: SpecialLesson) => {
    setEditingLesson(lesson)
    setIsModalOpen(true)
  }

  const handleDelete = async (lesson: SpecialLesson) => {
    const confirmed = await confirmAction({
      title: 'Delete special lesson?',
      description: `Are you sure you want to delete "${lesson.title}"?`,
      confirmLabel: 'Delete',
    })
    if (!confirmed) return
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      await specialLessonService.remove(lesson.id, user.uid, { title: lesson.title })
      notifySuccess('Special lesson deleted')
    } catch (error) {
      notifyError('Unable to delete special lesson', error instanceof Error ? error.message : undefined)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      if (editingLesson) {
        await specialLessonService.update(
          editingLesson.id,
          {
            gradeId: values.gradeId,
            lessonType: values.lessonType,
            title: values.title,
            sourceUnitIds: values.sourceUnitIds,
            linkedQuizIds: values.linkedQuizIds,
            description: values.description?.trim() || '',
            status: values.status,
          },
          user.uid,
          { title: values.title },
        )
        notifySuccess('Special lesson updated')
      } else {
        await specialLessonService.create(
          {
            gradeId: values.gradeId,
            lessonType: values.lessonType,
            title: values.title,
            sourceUnitIds: values.sourceUnitIds,
            linkedQuizIds: values.linkedQuizIds,
            description: values.description?.trim() || '',
            status: values.status,
          } as Omit<SpecialLesson, 'id' | 'createdAt' | 'updatedAt'>,
          user.uid,
          { title: values.title },
        )
        notifySuccess('Special lesson created')
      }
      setIsModalOpen(false)
    } catch (error) {
      notifyError('Unable to save special lesson', error instanceof Error ? error.message : undefined)
    }
  })

  const toggleSelection = (current: string[], value: string, setValue: (val: string[]) => void) => {
    if (current.includes(value)) {
      setValue(current.filter((item) => item !== value))
    } else {
      setValue([...current, value])
    }
  }

  const selectedUnits = form.watch('sourceUnitIds')
  const selectedQuizzes = form.watch('linkedQuizIds')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Special Lessons</h2>
          <p className="text-sm text-muted-foreground">
            Build cross-unit revision pathways and curated practice sessions.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selectedGradeId} onValueChange={(value: string) => setSelectedGradeId(value as typeof selectedGradeId)}>
            <SelectTrigger className="w-[200px]">
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
          <Button onClick={handleOpenNew} className="rounded-full px-6">
            Create Special Lesson
          </Button>
        </div>
      </div>

      <DataTable
        data={rows.filter((row) => selectedGradeId === 'all' || row.gradeId === selectedGradeId)}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No special lessons yet. Craft a revision path to get started."
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <FormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLesson ? 'Edit Special Lesson' : 'Create Special Lesson'}
        description="Blend questions from multiple units to scaffold deeper mastery."
        onSubmit={onSubmit}
        submitLabel={editingLesson ? 'Update Lesson' : 'Create Lesson'}
        isSubmitting={form.formState.isSubmitting}
      >
        <Form {...form}>
          <form className="space-y-4">
            <FormField
              name="gradeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grade</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {grades.map((grade) => (
                        <SelectItem key={grade.id} value={grade.id}>
                          {grade.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="lessonType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Lesson Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {specialLessonTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lesson Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Grammar Mastery Workshop" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border border-dashed border-border/70">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Select Source Units</CardTitle>
                  <CardDescription>Pick the units that will contribute questions to this lesson.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <div className="space-y-3">
                      {units
                        .filter((unit) => !form.getValues('gradeId') || unit.gradeId === form.getValues('gradeId'))
                        .map((unit) => (
                          <label key={unit.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{unit.title}</p>
                              <p className="text-xs text-muted-foreground">Unit {unit.number}</p>
                            </div>
                            <Checkbox
                              checked={selectedUnits.includes(unit.id)}
                              onCheckedChange={() =>
                                toggleSelection(selectedUnits, unit.id, (value) => form.setValue('sourceUnitIds', value, { shouldValidate: true }))
                              }
                            />
                          </label>
                        ))}
                    </div>
                  </ScrollArea>
                  <FormMessage>{form.formState.errors.sourceUnitIds?.message}</FormMessage>
                </CardContent>
              </Card>

              <Card className="border border-dashed border-border/70">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Link Quizzes</CardTitle>
                  <CardDescription>Select published quizzes that feed this revision lesson.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <div className="space-y-3">
                      {quizzes
                        .filter((quiz) => !form.getValues('gradeId') || quiz.gradeId === form.getValues('gradeId'))
                        .map((quiz) => (
                          <label key={quiz.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{quiz.title}</p>
                              <p className="text-xs text-muted-foreground">{quiz.quizType}</p>
                            </div>
                            <Checkbox
                              checked={selectedQuizzes.includes(quiz.id)}
                              onCheckedChange={() =>
                                toggleSelection(selectedQuizzes, quiz.id, (value) => form.setValue('linkedQuizIds', value, { shouldValidate: true }))
                              }
                            />
                          </label>
                        ))}
                    </div>
                  </ScrollArea>
                  <FormMessage>{form.formState.errors.linkedQuizIds?.message}</FormMessage>
                </CardContent>
              </Card>
            </div>
            <FormField
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional facilitator notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </FormModal>

      {rows.length > 0 && (
        <Card className="border-none bg-gradient-to-br from-primary/5 via-white to-slate-50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Revision Pipeline Overview</CardTitle>
            <CardDescription>Track the freshness and coverage of your special lessons.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Special Lessons</p>
              <p className="mt-2 text-2xl font-semibold text-primary">{rows.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Unique Units Covered</p>
              <p className="mt-2 text-2xl font-semibold text-primary">
                {new Set(rows.flatMap((row) => row.sourceUnitIds)).size}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Linked Quizzes</p>
              <p className="mt-2 text-2xl font-semibold text-primary">
                {new Set(rows.flatMap((row) => row.linkedQuizIds)).size}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Most Recent Update</p>
              <p className="mt-2 text-sm font-semibold text-primary">
                {rows.length ? formatDate(rows[0]?.updatedAt) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


