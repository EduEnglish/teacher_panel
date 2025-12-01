import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { where } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { sectionSchema, type SectionFormValues } from '@/utils/schemas'
import { gradeService } from '@/services/firebase'
import { hierarchicalUnitService, hierarchicalLessonService, hierarchicalSectionService } from '@/services/hierarchicalServices'
import { getQuizzesForSection } from '@/services/quizBuilderService'
import { useCurriculumCache } from '@/context/CurriculumCacheContext'
import type { Grade, Lesson, Quiz, Section, Unit } from '@/types/models'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'

type SectionTableRow = Section & { gradeName: string; unitTitle: string; lessonTitle: string; quizCount: number }

export function SectionsPage() {
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()
  const [selectedGradeId, setSelectedGradeId] = useState<string | 'all'>('all')
  const [selectedUnitId, setSelectedUnitId] = useState<string | 'all'>('all')
  const [selectedLessonId, setSelectedLessonId] = useState<string | 'all'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)

  const { grades, allUnits: cachedAllUnits, allLessons: cachedAllLessons, allSections: cachedAllSections, allQuizzes: cachedAllQuizzes, isLoading: cacheLoading, refreshSections } = useCurriculumCache()
  
  // Auto-select first grade if only one exists
  useEffect(() => {
    if (grades.length === 1 && selectedGradeId === 'all') {
      setSelectedGradeId(grades[0].id)
    }
  }, [grades, selectedGradeId])
  
  const [units, setUnits] = useState<Unit[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load units for selected grade (for table filtering)
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

  // Auto-select first unit if only one exists for selected grade
  useEffect(() => {
    if (selectedGradeId !== 'all' && units.length === 1 && selectedUnitId === 'all') {
      setSelectedUnitId(units[0].id)
    }
  }, [selectedGradeId, units, selectedUnitId])

  // Load lessons for selected unit (for table filtering)
  useEffect(() => {
    if (selectedGradeId === 'all' || !selectedGradeId || selectedUnitId === 'all' || !selectedUnitId) {
      // If 'all' is selected, filter cached lessons
      if (selectedGradeId === 'all') {
        setLessons(cachedAllLessons)
      } else if (selectedUnitId === 'all') {
        setLessons(cachedAllLessons.filter((lesson) => lesson.gradeId === selectedGradeId))
      } else {
        setLessons(cachedAllLessons.filter((lesson) => lesson.gradeId === selectedGradeId && lesson.unitId === selectedUnitId))
      }
      return
    }

    const unsubscribe = hierarchicalLessonService.listen(selectedGradeId, selectedUnitId, (data) => {
      setLessons(data)
    })

    return unsubscribe
  }, [selectedGradeId, selectedUnitId, cachedAllLessons])

  // Auto-select first lesson if only one exists for selected unit
  useEffect(() => {
    if (selectedUnitId !== 'all' && lessons.length === 1 && selectedLessonId === 'all') {
      setSelectedLessonId(lessons[0].id)
    }
  }, [selectedUnitId, lessons, selectedLessonId])

  // Load sections for selected lesson
  useEffect(() => {
    if (
      selectedGradeId === 'all' ||
      !selectedGradeId ||
      selectedUnitId === 'all' ||
      !selectedUnitId ||
      selectedLessonId === 'all' ||
      !selectedLessonId
    ) {
      // If 'all' is selected, filter cached sections
      setIsLoading(cacheLoading)
      
      // Filter cached sections based on selected filters
      let filteredSections = cachedAllSections
      
      if (selectedGradeId !== 'all') {
        filteredSections = filteredSections.filter((section) => section.gradeId === selectedGradeId)
      }
      
      if (selectedUnitId !== 'all') {
        filteredSections = filteredSections.filter((section) => section.unitId === selectedUnitId)
      }
      
      if (selectedLessonId !== 'all') {
        filteredSections = filteredSections.filter((section) => section.lessonId === selectedLessonId)
      }
      
      setSections(filteredSections)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const unsubscribe = hierarchicalSectionService.listen(
      selectedGradeId,
      selectedUnitId,
      selectedLessonId,
      (data) => {
        setSections(data)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [selectedGradeId, selectedUnitId, selectedLessonId, cachedAllSections, cacheLoading])

  const form = useForm<SectionFormValues>({
    resolver: zodResolver(sectionSchema) as any,
    defaultValues: {
      gradeId: '',
      unitId: '',
      lessonId: '',
      title: '',
      isPublished: false,
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
        isPublished: editingSection.isPublished ?? false,
      })
    } else {
      form.reset({
        gradeId: selectedGradeId === 'all' ? '' : selectedGradeId,
        unitId: selectedUnitId === 'all' ? '' : selectedUnitId,
        lessonId: selectedLessonId === 'all' ? '' : selectedLessonId,
        title: '',
        isPublished: false,
      })
    }
  }, [editingSection, selectedGradeId, selectedUnitId, selectedLessonId, form])

  const rows = useMemo<SectionTableRow[]>(() => {
    const gradeMap = new Map(grades.map((grade) => [grade.id, grade.name]))
    const unitMap = new Map(units.map((unit) => [unit.id, `Unit ${unit.number}`]))
    const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson.title]))
    const quizzesPerSection = cachedAllQuizzes.reduce<Record<string, number>>((acc, quiz) => {
      const key = `${quiz.gradeId}_${quiz.unitId}_${quiz.lessonId}_${quiz.sectionId}`
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    return sections
      .map((section) => ({
        ...section,
        gradeName: gradeMap.get(section.gradeId) ?? '—',
        unitTitle: unitMap.get(section.unitId) ?? '—',
        lessonTitle: lessonMap.get(section.lessonId) ?? '—',
        quizCount: quizzesPerSection[`${section.gradeId}_${section.unitId}_${section.lessonId}_${section.id}`] ?? 0,
      }))
      .sort((a, b) => {
        // First sort by grade name
        const gradeCompare = (a.gradeName || '').localeCompare(b.gradeName || '')
        if (gradeCompare !== 0) return gradeCompare
        // Then sort by unit title
        const unitCompare = (a.unitTitle || '').localeCompare(b.unitTitle || '')
        if (unitCompare !== 0) return unitCompare
        // Then sort by lesson title
        const lessonCompare = (a.lessonTitle || '').localeCompare(b.lessonTitle || '')
        if (lessonCompare !== 0) return lessonCompare
        // Finally sort by section title
        return a.title.localeCompare(b.title)
      })
  }, [sections, grades, units, lessons, cachedAllQuizzes])

  const handleOpenNew = () => {
    setEditingSection(null)
    setIsModalOpen(true)
  }

  const handleEdit = (section: Section) => {
    setEditingSection(section)
    setIsModalOpen(true)
  }

  const handleTogglePublish = async (section: Section) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    if (!section.gradeId || !section.unitId || !section.lessonId) {
      notifyError('Invalid section', 'Section missing required IDs')
      return
    }
    
    // Optimistic update
    const newPublishedState = !section.isPublished
    setSections((prevSections) =>
      prevSections.map((s) => (s.id === section.id ? { ...s, isPublished: newPublishedState } : s)),
    )
    
    try {
      await hierarchicalSectionService.update(section.gradeId, section.unitId, section.lessonId, section.id, {
        isPublished: newPublishedState,
      })
      notifySuccess(newPublishedState ? 'Section published' : 'Section unpublished')
    } catch (error) {
      // Revert on error
      setSections((prevSections) =>
        prevSections.map((s) => (s.id === section.id ? { ...s, isPublished: section.isPublished } : s)),
      )
      notifyError('Unable to update section', error instanceof Error ? error.message : undefined)
    }
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
      if (!section.gradeId || !section.unitId || !section.lessonId) {
        notifyError('Invalid section', 'Section missing required IDs')
        return
      }
      await hierarchicalSectionService.remove(section.gradeId, section.unitId, section.lessonId, section.id)
      notifySuccess('Section deleted successfully')
      refreshSections() // Refresh cache
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
      if (!values.gradeId || !values.unitId || !values.lessonId) {
        notifyError('Grade, Unit, and Lesson required', 'Please select all required fields')
        return
      }

      // Check for duplicate section title in the same grade + unit + lesson
      const duplicateSection = sections.find(
        (s) =>
          s.title.toLowerCase().trim() === values.title.toLowerCase().trim() &&
          s.gradeId === values.gradeId &&
          s.unitId === values.unitId &&
          s.lessonId === values.lessonId &&
          s.id !== editingSection?.id,
      )
      if (duplicateSection) {
        notifyError('Duplicate section', `A section with the title "${values.title}" already exists for this lesson.`)
        return
      }

      if (editingSection) {
        if (!editingSection.gradeId || !editingSection.unitId || !editingSection.lessonId) {
          notifyError('Invalid section', 'Section missing required IDs')
          return
        }
        await hierarchicalSectionService.update(
          editingSection.gradeId,
          editingSection.unitId,
          editingSection.lessonId,
          editingSection.id,
          {
            title: values.title,
            isPublished: values.isPublished,
          },
        )
        notifySuccess('Section updated successfully')
        refreshSections() // Refresh cache
      } else {
        await hierarchicalSectionService.create(values.gradeId, values.unitId, values.lessonId, {
            title: values.title,
          isPublished: values.isPublished,
        })
        notifySuccess('Section created successfully')
        refreshSections() // Refresh cache
      }
      setIsModalOpen(false)
    } catch (error) {
      notifyError('Unable to save section', error instanceof Error ? error.message : undefined)
    }
  })

  const columns: Array<DataTableColumn<SectionTableRow>> = [
    { 
      key: 'title', 
      header: 'Section Title',
      render: (row) => (
        <div className="truncate max-w-[200px]" title={row.title}>
          {row.title}
        </div>
      ),
    },
    { 
      key: 'lessonTitle', 
      header: 'Lesson',
      render: (row) => (
        <div className="truncate max-w-[150px]" title={row.lessonTitle}>
          {row.lessonTitle}
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
      key: 'quizCount',
      header: 'Quizzes',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.quizCount}</span>,
    },
    {
      key: 'isPublished',
      header: 'Published',
      align: 'center',
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch 
            checked={row.isPublished ?? false} 
            onCheckedChange={(checked) => {
              handleTogglePublish(row)
            }}
          />
        </div>
      ),
    },
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
                  Unit {unit.number}
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
              render={({ field }) => {
                const selectedGradeId = form.getValues('gradeId')
                const filteredUnits = selectedGradeId
                  ? allUnits.filter((unit) => unit.gradeId === selectedGradeId)
                  : []
                const hasUnits = filteredUnits.length > 0
                
                return (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value: string) => {
                      field.onChange(value)
                      form.setValue('lessonId', '')
                    }}
                      disabled={!selectedGradeId || !hasUnits}
                  >
                    <FormControl>
                      <SelectTrigger>
                          <SelectValue placeholder={!selectedGradeId ? "Select grade first" : "Select unit"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {!selectedGradeId ? (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            Please select a grade first.
                          </div>
                        ) : !hasUnits ? (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No units available for this grade. Please create a unit first.
                          </div>
                        ) : (
                          filteredUnits.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                              Unit {unit.number}
                          </SelectItem>
                          ))
                        )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
                )
              }}
            />
            <FormField
              name="lessonId"
              render={({ field }) => {
                const selectedGradeId = form.getValues('gradeId')
                const selectedUnitId = form.getValues('unitId')
                const filteredLessons = selectedGradeId && selectedUnitId
                  ? cachedAllLessons.filter((lesson) => lesson.gradeId === selectedGradeId && lesson.unitId === selectedUnitId)
                  : []
                const hasLessons = filteredLessons.length > 0
                
                return (
                <FormItem>
                  <FormLabel>Lesson</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                      disabled={!selectedGradeId || !selectedUnitId || !hasLessons}
                    >
                    <FormControl>
                      <SelectTrigger>
                          <SelectValue placeholder={!selectedUnitId ? "Select unit first" : "Select lesson"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {!selectedUnitId ? (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            Please select a unit first.
                          </div>
                        ) : !hasLessons ? (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No lessons available for this unit. Please create a lesson first.
                          </div>
                        ) : (
                          filteredLessons.map((lesson) => (
                          <SelectItem key={lesson.id} value={lesson.id}>
                            {lesson.title}
                          </SelectItem>
                          ))
                        )}
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
                  <FormLabel>Section Title (max 25 characters)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Vocabulary Drill" maxLength={25} {...field} />
                  </FormControl>
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
                    <p className="text-xs text-muted-foreground">Only published sections appear to students.</p>
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


