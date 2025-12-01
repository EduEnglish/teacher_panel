import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { lessonSchema, type LessonFormValues } from '@/utils/schemas'
import { lessonTitleOptions } from '@/utils/constants'
import { hierarchicalUnitService, hierarchicalLessonService } from '@/services/hierarchicalServices'
import { useCurriculumCache } from '@/context/CurriculumCacheContext'
import type { Lesson, Unit } from '@/types/models'
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

  const { grades, allUnits: cachedAllUnits, allLessons: cachedAllLessons, allSections: cachedAllSections, isLoading: cacheLoading, refreshLessons } = useCurriculumCache()
  
  // Auto-select first grade and unit if only one exists
  useEffect(() => {
    if (grades.length === 1 && selectedGradeId === 'all') {
      setSelectedGradeId(grades[0].id)
    }
  }, [grades, selectedGradeId])
  
  const [units, setUnits] = useState<Unit[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load units for selected grade (hierarchical) - for table filtering
  useEffect(() => {
    if (selectedGradeId === 'all' || !selectedGradeId) {
      // If 'all', use cached units
      setUnits(cachedAllUnits)
      return
    }

    const unsubscribe = hierarchicalUnitService.listen(selectedGradeId, (data) => {
      setUnits(data)
    })

    return unsubscribe
  }, [selectedGradeId, cachedAllUnits])


  // Use cached sections from context
  const allSections = cachedAllSections

  // Auto-select first unit if only one exists for selected grade
  useEffect(() => {
    if (selectedGradeId !== 'all' && units.length === 1 && selectedUnitId === 'all') {
      setSelectedUnitId(units[0].id)
    }
  }, [selectedGradeId, units, selectedUnitId])

  // Load lessons for selected unit (hierarchical)
  useEffect(() => {
    if (selectedGradeId === 'all' || !selectedGradeId || selectedUnitId === 'all' || !selectedUnitId) {
      // If 'all' is selected, filter cached lessons
      setIsLoading(cacheLoading)
      
      // Filter cached lessons based on selected filters
      let filteredLessons = cachedAllLessons
      
      if (selectedGradeId !== 'all') {
        filteredLessons = filteredLessons.filter((lesson) => lesson.gradeId === selectedGradeId)
      }
      
      if (selectedUnitId !== 'all') {
        filteredLessons = filteredLessons.filter((lesson) => lesson.unitId === selectedUnitId)
      }
      
      setLessons(filteredLessons)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const unsubscribe = hierarchicalLessonService.listen(selectedGradeId, selectedUnitId, (data) => {
      // Ensure all lessons have required fields
      const validLessons = data.filter((lesson) => lesson.gradeId && lesson.unitId)
      setLessons(validLessons)
      setIsLoading(false)
    })

    return unsubscribe
  }, [selectedGradeId, selectedUnitId, cachedAllLessons, cacheLoading])

  const form = useForm<LessonFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(lessonSchema) as any,
    defaultValues: {
      gradeId: '',
      unitId: '',
      title: 'Grammar',
      order: 1,
      isPublished: false,
    },
  })

  // Auto-calculate order when grade/unit/title changes for new lessons
  useEffect(() => {
    if (editingLesson) return // Don't auto-calculate for editing

    const gradeId = form.getValues('gradeId')
    const unitId = form.getValues('unitId')
    const title = form.getValues('title')

    if (gradeId && unitId && title) {
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
  }, [form.watch('gradeId'), form.watch('unitId'), form.watch('title'), editingLesson])

  useEffect(() => {
    setPageTitle('Lesson Management')
  }, [setPageTitle])

  useEffect(() => {
    if (editingLesson) {
      form.reset({
        id: editingLesson.id,
        gradeId: editingLesson.gradeId,
        unitId: editingLesson.unitId,
        title: editingLesson.title as LessonFormValues['title'],
        order: editingLesson.order,
        isPublished: editingLesson.isPublished ?? false,
      })
    } else {
      form.reset({
        gradeId: selectedGradeId === 'all' ? '' : selectedGradeId,
        unitId: selectedUnitId === 'all' ? '' : selectedUnitId,
        title: 'Grammar',
        order: 1, // Will be auto-calculated when grade/unit is selected
        isPublished: false,
      })
    }
  }, [editingLesson, selectedGradeId, selectedUnitId, form])

  const rows = useMemo<LessonTableRow[]>(() => {
    const gradeMap = new Map(grades.map((grade) => [grade.id, grade.name]))
    const unitMap = new Map(units.map((unit) => [unit.id, `Unit ${unit.number}`]))
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
      .sort((a, b) => {
        // First sort by grade name
        const gradeCompare = (a.gradeName || '').localeCompare(b.gradeName || '')
        if (gradeCompare !== 0) return gradeCompare
        // Then sort by unit title
        const unitCompare = (a.unitTitle || '').localeCompare(b.unitTitle || '')
        if (unitCompare !== 0) return unitCompare
        // Finally sort by order within the same unit
        return a.order - b.order
      })
  }, [lessons, grades, units, allSections])

  const handleOpenNew = () => {
    setEditingLesson(null)
    setIsModalOpen(true)
  }

  const handleEdit = (lesson: Lesson) => {
    setEditingLesson(lesson)
    setIsModalOpen(true)
  }

  const handleTogglePublish = async (lesson: Lesson) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    if (!lesson.gradeId || !lesson.unitId) {
      notifyError('Invalid lesson', 'Lesson missing required IDs')
      return
    }
    
    // Optimistic update
    const newPublishedState = !lesson.isPublished
    setLessons((prevLessons) =>
      prevLessons.map((l) => (l.id === lesson.id ? { ...l, isPublished: newPublishedState } : l)),
    )
    
    try {
      await hierarchicalLessonService.update(lesson.gradeId, lesson.unitId, lesson.id, {
        isPublished: newPublishedState,
      })
      notifySuccess(newPublishedState ? 'Lesson published' : 'Lesson unpublished')
    } catch (error) {
      // Revert on error
      setLessons((prevLessons) =>
        prevLessons.map((l) => (l.id === lesson.id ? { ...l, isPublished: lesson.isPublished } : l)),
      )
      notifyError('Unable to update lesson', error instanceof Error ? error.message : undefined)
    }
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
          l.gradeId === values.gradeId &&
          l.unitId === values.unitId &&
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
            isPublished: values.isPublished,
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
          isPublished: values.isPublished,
        })
        notifySuccess('Lesson created successfully')
        refreshLessons() // Refresh cache
        // Ensure the grade and unit are selected to show the new lesson
        if (selectedGradeId !== values.gradeId) {
          setSelectedGradeId(values.gradeId)
        }
        if (selectedUnitId !== values.unitId) {
          setSelectedUnitId(values.unitId)
        }
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
        <div className="truncate max-w-[200px]" title={row.title}>
          {row.title}
        </div>
      ),
    },
    { 
      key: 'unitTitle', 
      header: 'Unit',
      render: (row) => (
        <div className="truncate max-w-[120px]" title={row.unitTitle}>
          {row.unitTitle}
        </div>
      ),
    },
    { 
      key: 'gradeName', 
      header: 'Grade',
      render: (row) => (
        <div className="truncate max-w-[150px]" title={row.gradeName}>
          {row.gradeName}
        </div>
      ),
    },
    {
      key: 'sectionCount',
      header: 'Sections',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.sectionCount}</span>,
    },
    {
      key: 'isPublished',
      header: 'Published',
      align: 'center',
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch 
            checked={row.isPublished ?? false} 
            onCheckedChange={() => {
              handleTogglePublish(row)
            }}
          />
        </div>
      ),
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
                          Unit {unit.number}
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
                      {grades.length === 0 ? (
                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                          No grades available. Please create a grade first.
                        </div>
                      ) : (
                        grades.map((grade) => (
                          <SelectItem key={grade.id} value={grade.id}>
                            {grade.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="unitId"
              render={({ field }) => {
                const selectedGradeId = form.getValues('gradeId')
                const hasUnits = selectedGradeId
                  ? cachedAllUnits.filter((unit) => unit.gradeId === selectedGradeId).length > 0
                  : false
                
                return (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                      disabled={!selectedGradeId || !hasUnits}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedGradeId ? "Select grade first" : "Select unit"} />
                        </SelectTrigger>
                      </FormControl>
                    <SelectContent>
                      {(() => {
                        const selectedGradeId = form.getValues('gradeId')
                        const filteredUnits = selectedGradeId
                          ? cachedAllUnits.filter((unit) => unit.gradeId === selectedGradeId)
                          : []
                        
                        if (!selectedGradeId) {
                          return (
                            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                              Please select a grade first.
                            </div>
                          )
                        }
                        
                        if (filteredUnits.length === 0) {
                          return (
                            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                              No units available for this grade. Please create a unit first.
                            </div>
                          )
                        }
                        
                        return filteredUnits.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            Unit {unit.number}
                          </SelectItem>
                        ))
                      })()}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
                )
              }}
            />
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
            <FormField
              name="isPublished"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Publish to Mobile App</FormLabel>
                    <p className="text-xs text-muted-foreground">Only published lessons appear to students.</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </FormModal>
    </div>
  )
}


