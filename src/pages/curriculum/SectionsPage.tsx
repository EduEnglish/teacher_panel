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
import { sectionSchema, type SectionFormValues } from '@/utils/schemas'
import { statusOptions, quizTypeOptions } from '@/utils/constants'
import { gradeService, lessonService, sectionService, unitService } from '@/services/firebase'
import type { Grade, Lesson, Section, Unit } from '@/types/models'
import { useCollection } from '@/hooks/useCollection'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'

type SectionTableRow = Section & { gradeName: string; unitTitle: string; lessonTitle: string }

export function SectionsPage() {
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()
  const [selectedGradeId, setSelectedGradeId] = useState<string | 'all'>('all')
  const [selectedUnitId, setSelectedUnitId] = useState<string | 'all'>('all')
  const [selectedLessonId, setSelectedLessonId] = useState<string | 'all'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)

  const { data: grades } = useCollection<Grade>(gradeService.listen)
  const unitsConstraints = useMemo(() => (selectedGradeId === 'all' ? undefined : [where('gradeId', '==', selectedGradeId)]), [selectedGradeId])
  const { data: units } = useCollection<Unit>(unitService.listen, unitsConstraints)
  const lessonsConstraints = useMemo(() => {
    const constraints = []
    if (selectedGradeId !== 'all') constraints.push(where('gradeId', '==', selectedGradeId))
    if (selectedUnitId !== 'all') constraints.push(where('unitId', '==', selectedUnitId))
    return constraints.length ? constraints : undefined
  }, [selectedGradeId, selectedUnitId])
  const { data: lessons } = useCollection<Lesson>(lessonService.listen, lessonsConstraints)

  const sectionsConstraints = useMemo(() => {
    const constraints = []
    if (selectedGradeId !== 'all') constraints.push(where('gradeId', '==', selectedGradeId))
    if (selectedUnitId !== 'all') constraints.push(where('unitId', '==', selectedUnitId))
    if (selectedLessonId !== 'all') constraints.push(where('lessonId', '==', selectedLessonId))
    return constraints.length ? constraints : undefined
  }, [selectedGradeId, selectedUnitId, selectedLessonId])
  const { data: sections, isLoading } = useCollection<Section>(sectionService.listen, sectionsConstraints)

  const form = useForm<SectionFormValues>({
    resolver: zodResolver(sectionSchema) as any,
    defaultValues: {
      gradeId: '',
      unitId: '',
      lessonId: '',
      title: '',
      quizType: 'fill-in',
      description: '',
      status: 'active',
    },
  })

  useEffect(() => {
    setPageTitle('Section Management')
  }, [setPageTitle])

  useEffect(() => {
    if (editingSection) {
      form.reset({
        id: editingSection.id,
        gradeId: editingSection.gradeId,
        unitId: editingSection.unitId,
        lessonId: editingSection.lessonId,
        title: editingSection.title,
        quizType: editingSection.quizType,
        description: editingSection.description ?? '',
        status: editingSection.status,
      })
    } else {
      form.reset({
        gradeId: selectedGradeId === 'all' ? '' : selectedGradeId,
        unitId: selectedUnitId === 'all' ? '' : selectedUnitId,
        lessonId: selectedLessonId === 'all' ? '' : selectedLessonId,
        title: '',
        quizType: 'fill-in',
        description: '',
        status: 'active',
      })
    }
  }, [editingSection, selectedGradeId, selectedUnitId, selectedLessonId, form])

  const rows = useMemo<SectionTableRow[]>(() => {
    const gradeMap = new Map(grades.map((grade) => [grade.id, grade.name]))
    const unitMap = new Map(units.map((unit) => [unit.id, unit.title]))
    const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson.title]))
    return sections
      .map((section) => ({
        ...section,
        gradeName: gradeMap.get(section.gradeId) ?? '—',
        unitTitle: unitMap.get(section.unitId) ?? '—',
        lessonTitle: lessonMap.get(section.lessonId) ?? '—',
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [sections, grades, units, lessons])

  const handleOpenNew = () => {
    setEditingSection(null)
    setIsModalOpen(true)
  }

  const handleEdit = (section: Section) => {
    setEditingSection(section)
    setIsModalOpen(true)
  }

  const handleDelete = async (section: Section) => {
    const confirmed = await confirmAction({
      title: 'Delete section?',
      description: `Are you sure you want to delete "${section.title}"?`,
      confirmLabel: 'Delete',
    })
    if (!confirmed) return
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      await sectionService.remove(section.id, user.uid, { title: section.title })
      notifySuccess('Section deleted successfully')
    } catch (error) {
      notifyError('Unable to delete section', error instanceof Error ? error.message : undefined)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      if (editingSection) {
        await sectionService.update(
          editingSection.id,
          {
            gradeId: values.gradeId,
            unitId: values.unitId,
            lessonId: values.lessonId,
            title: values.title,
            quizType: values.quizType,
            description: values.description?.trim() || '',
            status: values.status,
          },
          user.uid,
          { title: values.title },
        )
        notifySuccess('Section updated successfully')
      } else {
        await sectionService.create(
          {
            gradeId: values.gradeId,
            unitId: values.unitId,
            lessonId: values.lessonId,
            title: values.title,
            quizType: values.quizType,
            description: values.description?.trim() || '',
            status: values.status,
          } as Omit<Section, 'id' | 'createdAt' | 'updatedAt'>,
          user.uid,
          { title: values.title },
        )
        notifySuccess('Section created successfully')
      }
      setIsModalOpen(false)
    } catch (error) {
      notifyError('Unable to save section', error instanceof Error ? error.message : undefined)
    }
  })

  const columns: Array<DataTableColumn<SectionTableRow>> = [
    { key: 'title', header: 'Section Title' },
    { key: 'quizType', header: 'Quiz Type', render: (row) => <Badge variant="secondary">{row.quizType}</Badge> },
    { key: 'lessonTitle', header: 'Lesson' },
    { key: 'unitTitle', header: 'Unit' },
    { key: 'gradeName', header: 'Grade' },
    { key: 'status', header: 'Status', render: (row) => <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{row.status}</Badge> },
  ]

  const filteredUnits = selectedGradeId === 'all' ? units : units.filter((unit) => unit.gradeId === selectedGradeId)
  const filteredLessons = lessons.filter((lesson) => {
    const gradeMatch = selectedGradeId === 'all' || lesson.gradeId === selectedGradeId
    const unitMatch = selectedUnitId === 'all' || lesson.unitId === selectedUnitId
    return gradeMatch && unitMatch
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Sections</h2>
          <p className="text-sm text-muted-foreground">Sections organize quiz experiences within each lesson.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={selectedGradeId}
            onValueChange={(value: string) => {
              setSelectedGradeId(value as typeof selectedGradeId)
              setSelectedUnitId('all')
              setSelectedLessonId('all')
            }}
          >
            <SelectTrigger className="w-[180px]">
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
          <Select
            value={selectedUnitId}
            onValueChange={(value: string) => {
              setSelectedUnitId(value as typeof selectedUnitId)
              setSelectedLessonId('all')
            }}
          >
            <SelectTrigger className="w-[180px]">
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
          <Select value={selectedLessonId} onValueChange={(value: string) => setSelectedLessonId(value as typeof selectedLessonId)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by lesson" />
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
          <Button onClick={handleOpenNew} className="rounded-full px-6">
            Add Section
          </Button>
        </div>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No sections yet. Create a section to add quizzes for this lesson."
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <FormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSection ? 'Edit Section' : 'Add Section'}
        description="Sections define the quiz experience inside a lesson."
        onSubmit={onSubmit}
        submitLabel={editingSection ? 'Update Section' : 'Create Section'}
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
                    onValueChange={(value: string) => {
                      field.onChange(value)
                      form.setValue('unitId', '')
                      form.setValue('lessonId', '')
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
                  <Select
                    value={field.value}
                    onValueChange={(value: string) => {
                      field.onChange(value)
                      form.setValue('lessonId', '')
                    }}
                  >
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
            <FormField
              name="lessonId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lesson</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select lesson" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {lessons
                        .filter((lesson) => lesson.unitId === form.getValues('unitId'))
                        .map((lesson) => (
                          <SelectItem key={lesson.id} value={lesson.id}>
                            {lesson.title}
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
                  <FormLabel>Section Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Vocabulary Drill" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="quizType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quiz Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select quiz type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {quizTypeOptions.map((option) => (
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
                    <Input placeholder="Optional support details" {...field} />
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


