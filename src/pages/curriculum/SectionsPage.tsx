import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronRight, Play } from 'lucide-react'
import { deleteField } from 'firebase/firestore'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { PageLoader } from '@/components/feedback/PageLoader'
import { sectionSchema, type SectionFormValues } from '@/utils/schemas'
import { hierarchicalSectionService } from '@/services/hierarchicalServices'
import { useCurriculumCache } from '@/context/CurriculumCacheContext'
import type { Section } from '@/types/models'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'

type SectionTableRow = Section & { gradeName: string; unitTitle: string; lessonTitle: string; quizCount: number }

export function SectionsPage() {
  const { gradeId, unitId, lessonId } = useParams<{ gradeId: string; unitId: string; lessonId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)

  const { grades, allUnits: cachedAllUnits, allLessons: cachedAllLessons, allQuizzes: cachedAllQuizzes, isLoading: cacheLoading, refreshSections } = useCurriculumCache()
  
  // Get the current grade, unit, and lesson
  const currentGrade = grades.find((g) => g.id === gradeId)
  const currentUnit = cachedAllUnits.find((u) => u.id === unitId && u.gradeId === gradeId)
  const currentLesson = cachedAllLessons.find((l) => l.id === lessonId && l.gradeId === gradeId && l.unitId === unitId)
  
  const [sections, setSections] = useState<Section[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Redirect if params are missing
  useEffect(() => {
    if (!gradeId) {
      navigate('/curriculum/grades')
      return
    }
    if (!unitId) {
      navigate(`/curriculum/${gradeId}/units`)
      return
    }
    if (!lessonId) {
      navigate(`/curriculum/${gradeId}/${unitId}/lessons`)
      return
    }
  }, [gradeId, unitId, lessonId, navigate])

  // Load sections for the lesson from URL (hierarchical)
  useEffect(() => {
    if (!gradeId || !unitId || !lessonId) {
      setIsLoading(false)
      setSections([])
      return
    }

    setIsLoading(true)
    const unsubscribe = hierarchicalSectionService.listen(
      gradeId,
      unitId,
      lessonId,
      (data) => {
        setSections(data)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [gradeId, unitId, lessonId])

  const form = useForm<SectionFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(sectionSchema) as any,
    defaultValues: {
      gradeId: '',
      unitId: '',
      lessonId: '',
      title: '',
    },
  })

  useEffect(() => {
    setPageTitle('Sections')
  }, [setPageTitle])

  useEffect(() => {
    if (editingSection) {
      form.reset({
        id: editingSection.id,
        gradeId: editingSection.gradeId,
        unitId: editingSection.unitId,
        lessonId: editingSection.lessonId,
        title: editingSection.title,
        videoLink: editingSection.videoLink || '',
      })
    } else {
      form.reset({
        gradeId: gradeId || '',
        unitId: unitId || '',
        lessonId: lessonId || '',
        title: '',
        videoLink: '',
      })
    }
  }, [editingSection, gradeId, unitId, lessonId, form])

  const rows = useMemo<SectionTableRow[]>(() => {
    const gradeMap = new Map(grades.map((grade) => [grade.id, grade.name]))
    const unitMap = new Map(cachedAllUnits.map((unit) => [unit.id, `Unit ${unit.number}`]))
    const lessonMap = new Map(cachedAllLessons.map((lesson) => [lesson.id, lesson.title]))
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
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [sections, grades, cachedAllUnits, cachedAllLessons, cachedAllQuizzes])

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
          s.gradeId === gradeId &&
          s.unitId === unitId &&
          s.lessonId === lessonId &&
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
        // Prepare update data
        const trimmedVideoLink = values.videoLink?.trim()
        const updateData: Record<string, unknown> = {
          title: values.title,
        }
        // Only include videoLink if it has a value, otherwise use deleteField to remove it
        if (trimmedVideoLink && trimmedVideoLink.length > 0) {
          updateData.videoLink = trimmedVideoLink
        } else {
          // Use deleteField to remove the field from Firestore
          updateData.videoLink = deleteField()
        }
        await hierarchicalSectionService.update(
          editingSection.gradeId,
          editingSection.unitId,
          editingSection.lessonId,
          editingSection.id,
          updateData as Partial<Omit<Section, 'id' | 'createdAt' | 'updatedAt'>>,
        )
        notifySuccess('Section updated successfully')
        refreshSections() // Refresh cache
      } else {
        if (!gradeId || !unitId || !lessonId) {
          notifyError('Missing IDs', 'Grade, Unit, and Lesson IDs are required')
          return
        }
        // Prepare create data - only include videoLink if it has a value
        const trimmedVideoLink = values.videoLink?.trim()
        const createData: Omit<Section, 'id' | 'createdAt' | 'updatedAt'> = {
          gradeId: gradeId,
          unitId: unitId,
          lessonId: lessonId,
          title: values.title,
        }
        // Only include videoLink if it has a value
        if (trimmedVideoLink && trimmedVideoLink.length > 0) {
          createData.videoLink = trimmedVideoLink
        }
        await hierarchicalSectionService.create(gradeId, unitId, lessonId, createData)
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
        <div className="whitespace-normal break-words" title={row.title}>
          {row.title}
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
      key: 'videoLink',
      header: 'Video',
      align: 'center',
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          {row.videoLink ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 group"
              onClick={() => window.open(row.videoLink, '_blank', 'noopener,noreferrer')}
              title="Watch Video"
            >
              <Play className="h-4 w-4 text-primary group-hover:text-white" />
            </Button>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </div>
      ),
    },
  ]

  // Show loader while data is loading
  if (cacheLoading || isLoading) {
    return <PageLoader />
  }

  // Show error only after loading is complete
  if (!gradeId || !unitId || !lessonId || !currentGrade || !currentUnit || !currentLesson) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Grade, Unit, or Lesson not found</p>
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
            <Link to={`/curriculum/${gradeId}/${unitId}/lessons`} className="hover:text-primary transition-colors">
              {currentLesson.title}
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">Sections</span>
          </h2>
          <p className="text-sm text-muted-foreground">Sections organize quiz experiences within each lesson.</p>
        </div>
        <Button onClick={handleOpenNew} className="rounded-full px-6">
          Add Section
        </Button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No sections yet. Create a section to add quizzes for this lesson."
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRowClick={(section) => navigate(`/curriculum/${gradeId}/${unitId}/${lessonId}/${section.id}/quizzes`)}
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
              name="videoLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>YouTube Video Link (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://www.youtube.com/watch?v=..." 
                      {...field} 
                      type="url"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Add an educational video link that will be displayed to students.
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


