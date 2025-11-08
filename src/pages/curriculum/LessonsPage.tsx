import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { where } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { lessonSchema, type LessonFormValues } from '@/utils/schemas'
import { statusOptions, lessonTypeOptions } from '@/utils/constants'
import { gradeService, lessonService, sectionService, unitService } from '@/services/firebase'
import type { Grade, Lesson, Section, Unit } from '@/types/models'
import { useCollection } from '@/hooks/useCollection'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'

type LessonTableRow = Lesson & { gradeName: string; unitTitle: string; sectionCount: number }

export function LessonsPage() {
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()
  const [selectedGradeId, setSelectedGradeId] = useState<string | 'all'>('all')
  const [selectedUnitId, setSelectedUnitId] = useState<string | 'all'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)

  const { data: grades } = useCollection<Grade>(gradeService.listen)
  const unitsConstraints = useMemo(() => (selectedGradeId === 'all' ? undefined : [where('gradeId', '==', selectedGradeId)]), [selectedGradeId])
  const { data: units } = useCollection<Unit>(unitService.listen, unitsConstraints)

  const lessonsConstraints = useMemo(() => {
    const constraints = []
    if (selectedGradeId !== 'all') constraints.push(where('gradeId', '==', selectedGradeId))
    if (selectedUnitId !== 'all') constraints.push(where('unitId', '==', selectedUnitId))
    return constraints.length ? constraints : undefined
  }, [selectedGradeId, selectedUnitId])
  const { data: lessons, isLoading } = useCollection<Lesson>(lessonService.listen, lessonsConstraints)
  const { data: sections } = useCollection<Section>(sectionService.listen)

  const form = useForm<LessonFormValues>({
    resolver: zodResolver(lessonSchema) as any,
    defaultValues: {
      gradeId: '',
      unitId: '',
      title: '',
      type: 'Grammar',
      description: '',
      order: 1,
      status: 'active',
    },
  })

  useEffect(() => {
    setPageTitle('Lesson Management')
  }, [setPageTitle])

  useEffect(() => {
    if (editingLesson) {
      form.reset({
        id: editingLesson.id,
        gradeId: editingLesson.gradeId,
        unitId: editingLesson.unitId,
        title: editingLesson.title,
        type: editingLesson.type,
        description: editingLesson.description ?? '',
        order: editingLesson.order,
        status: editingLesson.status,
      })
    } else {
      form.reset({
        gradeId: selectedGradeId === 'all' ? '' : selectedGradeId,
        unitId: selectedUnitId === 'all' ? '' : selectedUnitId,
        title: '',
        type: 'Grammar',
        description: '',
        order: 1,
        status: 'active',
      })
    }
  }, [editingLesson, selectedGradeId, selectedUnitId, form])

  const rows = useMemo<LessonTableRow[]>(() => {
    const gradeMap = new Map(grades.map((grade) => [grade.id, grade.name]))
    const unitMap = new Map(units.map((unit) => [unit.id, unit.title]))
    const sectionCounts = sections.reduce<Record<string, number>>((acc, section) => {
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
  }, [lessons, grades, units, sections])

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
      await lessonService.remove(lesson.id, user.uid, { title: lesson.title })
      notifySuccess('Lesson deleted successfully')
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
      if (editingLesson) {
        await lessonService.update(
          editingLesson.id,
          {
            gradeId: values.gradeId,
            unitId: values.unitId,
            title: values.title,
            type: values.type,
            description: values.description?.trim() || '',
            order: values.order,
            status: values.status,
          },
          user.uid,
          { title: values.title },
        )
        notifySuccess('Lesson updated successfully')
      } else {
        await lessonService.create(
          {
            gradeId: values.gradeId,
            unitId: values.unitId,
            title: values.title,
            type: values.type,
            description: values.description?.trim() || '',
            order: values.order,
            status: values.status,
          } as Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>,
          user.uid,
          { title: values.title },
        )
        notifySuccess('Lesson created successfully')
      }
      setIsModalOpen(false)
    } catch (error) {
      notifyError('Unable to save lesson', error instanceof Error ? error.message : undefined)
    }
  })

  const columns: Array<DataTableColumn<LessonTableRow>> = [
    { key: 'title', header: 'Lesson Title' },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <Badge variant="secondary">{row.type}</Badge>,
    },
    { key: 'unitTitle', header: 'Unit' },
    { key: 'gradeName', header: 'Grade' },
    {
      key: 'sectionCount',
      header: 'Sections',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.sectionCount}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{row.status}</Badge>,
    },
  ]

  const filteredUnits = selectedGradeId === 'all' ? units : units.filter((unit) => unit.gradeId === selectedGradeId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Lessons</h2>
          <p className="text-sm text-muted-foreground">Curate lesson experiences aligned with the unit narrative.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={selectedGradeId}
            onValueChange={(value: string) => {
              setSelectedGradeId(value as typeof selectedGradeId)
              setSelectedUnitId('all')
            }}
          >
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
          <Select value={selectedUnitId} onValueChange={(value: string) => setSelectedUnitId(value as typeof selectedUnitId)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by unit" />
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
          <Button onClick={handleOpenNew} className="rounded-full px-6">
            Add Lesson
          </Button>
        </div>
      </div>

  <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No lessons yet. Add lessons to build out this unit."
        onEdit={handleEdit}
        onDelete={handleDelete}
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
              name="gradeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grade</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      form.setValue('unitId', '')
                    }}
                  >
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
              name="unitId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {units
                        .filter((unit) => unit.gradeId === form.getValues('gradeId'))
                        .map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
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
                        onChange={(event) => field.onChange(Number(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            </div>
            <FormField
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lesson Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Reading Comprehension Strategies" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lesson Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {lessonTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
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
                    <Input placeholder="Optional learning objective" {...field} />
                  </FormControl>
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


