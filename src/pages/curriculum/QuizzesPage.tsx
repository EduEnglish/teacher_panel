import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { renderQuestionPreview } from '@/components/forms/QuestionBuilder'
import { quizSchema, type QuizFormValues } from '@/utils/schemas'
import { quizTypeOptions } from '@/utils/constants'
import { hierarchicalUnitService, hierarchicalLessonService, hierarchicalSectionService } from '@/services/hierarchicalServices'
import { createQuizWithQuestions, updateQuizWithQuestions, deleteQuizWithQuestions, getQuizWithQuestions, getQuizzesForSection } from '@/services/quizBuilderService'
import { useCurriculumCache } from '@/context/CurriculumCacheContext'
import type { Lesson, Question, Quiz, Section, Unit } from '@/types/models'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'


type QuizTableRow = Quiz & {
  gradeName: string
  unitTitle: string
  lessonTitle: string
  sectionTitle: string
  questionCount: number
}

export function QuizzesPage() {
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()

  const [selectedGradeId, setSelectedGradeId] = useState<string | 'all'>('all')
  const [selectedUnitId, setSelectedUnitId] = useState<string | 'all'>('all')
  const [selectedLessonId, setSelectedLessonId] = useState<string | 'all'>('all')
  const [selectedSectionId, setSelectedSectionId] = useState<string | 'all'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})

  const { grades, allUnits: cachedAllUnits, allLessons: cachedAllLessons, allSections: cachedAllSections, allQuizzes: cachedAllQuizzes, isLoading: cacheLoading, refreshQuizzes } = useCurriculumCache()
  
  // Auto-select first grade if only one exists
  useEffect(() => {
    if (grades.length === 1 && selectedGradeId === 'all') {
      setSelectedGradeId(grades[0].id)
    }
  }, [grades, selectedGradeId])
  
  const [units, setUnits] = useState<Unit[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
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

  // Auto-select first section if only one exists for selected lesson
  useEffect(() => {
    if (selectedLessonId !== 'all' && sections.length === 1 && selectedSectionId === 'all') {
      setSelectedSectionId(sections[0].id)
    }
  }, [selectedLessonId, sections, selectedSectionId])

  // Load sections for selected lesson (for table filtering)
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
      if (selectedGradeId === 'all') {
        setSections(cachedAllSections)
      } else if (selectedUnitId === 'all') {
        setSections(cachedAllSections.filter((section) => section.gradeId === selectedGradeId))
      } else if (selectedLessonId === 'all') {
        setSections(cachedAllSections.filter((section) => section.gradeId === selectedGradeId && section.unitId === selectedUnitId))
      } else {
        setSections(cachedAllSections.filter((section) => section.gradeId === selectedGradeId && section.unitId === selectedUnitId && section.lessonId === selectedLessonId))
      }
      return
    }

    const unsubscribe = hierarchicalSectionService.listen(
      selectedGradeId,
      selectedUnitId,
      selectedLessonId,
      (data) => {
        setSections(data)
      },
    )

    return unsubscribe
  }, [selectedGradeId, selectedUnitId, selectedLessonId, cachedAllSections])

  // Load quizzes for selected section
  useEffect(() => {
    if (
      selectedGradeId === 'all' ||
      !selectedGradeId ||
      selectedUnitId === 'all' ||
      !selectedUnitId ||
      selectedLessonId === 'all' ||
      !selectedLessonId ||
      selectedSectionId === 'all' ||
      !selectedSectionId
    ) {
      // If 'all' is selected, filter cached quizzes
      setIsLoading(cacheLoading)
      
      // Filter cached quizzes based on selected filters
      let filteredQuizzes = cachedAllQuizzes
      
      if (selectedGradeId !== 'all') {
        filteredQuizzes = filteredQuizzes.filter((quiz) => quiz.gradeId === selectedGradeId)
      }
      
      if (selectedUnitId !== 'all') {
        filteredQuizzes = filteredQuizzes.filter((quiz) => quiz.unitId === selectedUnitId)
      }
      
      if (selectedLessonId !== 'all') {
        filteredQuizzes = filteredQuizzes.filter((quiz) => quiz.lessonId === selectedLessonId)
      }
      
      if (selectedSectionId !== 'all') {
        filteredQuizzes = filteredQuizzes.filter((quiz) => quiz.sectionId === selectedSectionId)
      }
      
      setQuizzes(filteredQuizzes)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    getQuizzesForSection(selectedGradeId, selectedUnitId, selectedLessonId, selectedSectionId)
      .then((data) => {
        setQuizzes(data)
        setIsLoading(false)
      })
      .catch((error) => {
        notifyError('Unable to load quizzes', error instanceof Error ? error.message : undefined)
        setIsLoading(false)
      })
  }, [selectedGradeId, selectedUnitId, selectedLessonId, selectedSectionId, cachedAllSections, cacheLoading, notifyError])

  useEffect(() => {
    setPageTitle('Quiz Management')
  }, [setPageTitle])

  // Calculate question counts from embedded questions in quizzes
  useEffect(() => {
    const counts: Record<string, number> = {}
    quizzes.forEach((quiz) => {
      // Questions are embedded in quiz document
      const embeddedQuestions = ('questions' in quiz && Array.isArray(quiz.questions)) ? quiz.questions : []
      counts[quiz.id] = embeddedQuestions.length
    })
    setQuestionCounts(counts)
  }, [quizzes])


  const form = useForm<QuizFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(quizSchema) as any,
    defaultValues: {
      gradeId: '',
      unitId: '',
      lessonId: '',
      sectionId: '',
      title: '',
      quizType: 'fill-in',
      isPublished: false,
    },
  })

  useEffect(() => {
    if (editingQuiz) {
      form.reset({
        id: editingQuiz.id,
        gradeId: editingQuiz.gradeId,
        unitId: editingQuiz.unitId,
        lessonId: editingQuiz.lessonId,
        sectionId: editingQuiz.sectionId,
        title: editingQuiz.title,
        quizType: editingQuiz.quizType,
        isPublished: editingQuiz.isPublished,
      })
    } else {
      form.reset({
        gradeId: selectedGradeId === 'all' ? '' : selectedGradeId,
        unitId: selectedUnitId === 'all' ? '' : selectedUnitId,
        lessonId: selectedLessonId === 'all' ? '' : selectedLessonId,
        sectionId: selectedSectionId === 'all' ? '' : selectedSectionId,
        title: '',
        quizType: 'fill-in',
        isPublished: false,
      })
    }
  }, [editingQuiz, selectedGradeId, selectedUnitId, selectedLessonId, selectedSectionId, form])

  const handleOpenNew = () => {
    setEditingQuiz(null)
    setIsModalOpen(true)
  }

  const handleEdit = (quiz: Quiz) => {
    setEditingQuiz(quiz)
    setIsModalOpen(true)
  }

  const handleDelete = async (quiz: Quiz) => {
    const confirmed = await confirmAction({
      title: 'Delete quiz?',
      description: `Are you sure you want to delete "${quiz.title}"?`,
      confirmLabel: 'Delete',
    })
    if (!confirmed) return
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      if (!quiz.gradeId || !quiz.unitId || !quiz.lessonId || !quiz.sectionId) {
        notifyError('Invalid quiz', 'Quiz missing required IDs')
        return
      }
      await deleteQuizWithQuestions(quiz.gradeId, quiz.unitId, quiz.lessonId, quiz.sectionId, quiz.id, user.uid)
      notifySuccess('Quiz deleted successfully')
      refreshQuizzes() // Refresh cache
    } catch (error) {
      notifyError('Unable to delete quiz', error instanceof Error ? error.message : undefined)
    }
  }

  const handlePublishToggle = async (quiz: Quiz) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    if (!quiz.gradeId || !quiz.unitId || !quiz.lessonId || !quiz.sectionId) {
      notifyError('Invalid quiz', 'Quiz missing required IDs')
      return
    }
    
    // Optimistic update
    const newPublishedState = !quiz.isPublished
    setQuizzes((prevQuizzes) =>
      prevQuizzes.map((q) => (q.id === quiz.id ? { ...q, isPublished: newPublishedState } : q)),
    )
    
    try {
      // Get current questions
      const result = await getQuizWithQuestions(quiz.gradeId, quiz.unitId, quiz.lessonId, quiz.sectionId, quiz.id)
      if (!result) {
        // Revert on error
        setQuizzes((prevQuizzes) =>
          prevQuizzes.map((q) => (q.id === quiz.id ? { ...q, isPublished: quiz.isPublished } : q)),
        )
        notifyError('Quiz not found', 'Unable to load quiz')
        return
      }

      // Update with same questions, just toggle published status
      await updateQuizWithQuestions(
        quiz.gradeId,
        quiz.unitId,
        quiz.lessonId,
        quiz.sectionId,
        quiz.id,
        { isPublished: newPublishedState },
        result.questions.map((q) => ({
          ...q,
          quizId: undefined, // Remove quizId for update
        })),
        user.uid,
      )
      notifySuccess(newPublishedState ? 'Quiz published' : 'Quiz unpublished')
    } catch (error) {
      // Revert on error
      setQuizzes((prevQuizzes) =>
        prevQuizzes.map((q) => (q.id === quiz.id ? { ...q, isPublished: quiz.isPublished } : q)),
      )
      notifyError('Unable to update quiz status', error instanceof Error ? error.message : undefined)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    if (!values.gradeId || !values.unitId || !values.lessonId || !values.sectionId) {
      notifyError('All fields required', 'Please select grade, unit, lesson, and section')
      return
    }

    try {
      if (editingQuiz) {
        if (!editingQuiz.gradeId || !editingQuiz.unitId || !editingQuiz.lessonId || !editingQuiz.sectionId) {
          notifyError('Invalid quiz', 'Quiz missing required IDs')
          return
        }

        // Check for duplicate quiz type in the same grade + unit + lesson + section (when changing type)
        if (editingQuiz.quizType !== values.quizType) {
          const sectionQuizzes = await getQuizzesForSection(
            editingQuiz.gradeId,
            editingQuiz.unitId,
            editingQuiz.lessonId,
            editingQuiz.sectionId,
          )
          const duplicateQuiz = sectionQuizzes.find(
            (q) => q.quizType === values.quizType && q.id !== editingQuiz.id,
          )
          if (duplicateQuiz) {
            notifyError('Duplicate quiz type', `A quiz with type "${values.quizType}" already exists for this section.`)
            return
          }
        }

        // Get current questions
        const result = await getQuizWithQuestions(
          editingQuiz.gradeId,
          editingQuiz.unitId,
          editingQuiz.lessonId,
          editingQuiz.sectionId,
          editingQuiz.id,
        )

        // Update quiz with existing questions
        await updateQuizWithQuestions(
          editingQuiz.gradeId,
          editingQuiz.unitId,
          editingQuiz.lessonId,
          editingQuiz.sectionId,
          editingQuiz.id,
          {
            title: values.title,
            quizType: values.quizType,
            isPublished: values.isPublished,
          },
          result?.questions.map((q) => ({
            ...q,
            quizId: undefined, // Remove quizId for update
          })) || [],
          user.uid,
        )
        notifySuccess('Quiz updated successfully')
        refreshQuizzes() // Refresh cache
      } else {
        // Check for duplicate quiz type in the same grade + unit + lesson + section
        // Load quizzes for the specific section to check for duplicates
        const sectionQuizzes = await getQuizzesForSection(
          values.gradeId,
          values.unitId,
          values.lessonId,
          values.sectionId,
        )
        const duplicateQuiz = sectionQuizzes.find((q) => q.quizType === values.quizType)
        if (duplicateQuiz) {
          notifyError('Duplicate quiz type', `A quiz with type "${values.quizType}" already exists for this section.`)
          return
        }

        // Create new quiz with empty questions array (can add questions after)
        await createQuizWithQuestions(
          {
            gradeId: values.gradeId,
            unitId: values.unitId,
            lessonId: values.lessonId,
            sectionId: values.sectionId,
            title: values.title,
            quizType: values.quizType,
            isPublished: values.isPublished,
          } as Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>,
          [], // Start with no questions
          user.uid,
        )
        notifySuccess('Quiz created successfully')
        refreshQuizzes() // Refresh cache
      }
      setIsModalOpen(false)
    } catch (error) {
      notifyError('Unable to save quiz', error instanceof Error ? error.message : undefined)
    }
  })

  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null)
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([])

  const handlePreview = async (quiz: Quiz) => {
    setPreviewQuiz(quiz)
    setPreviewOpen(true)
    // Load questions for preview
    try {
      const result = await getQuizWithQuestions(quiz.gradeId, quiz.unitId, quiz.lessonId, quiz.sectionId, quiz.id)
      if (result) {
        setPreviewQuestions(result.questions)
      }
    } catch {
      setPreviewQuestions([])
    }
  }


  const gradeMap = useMemo(() => new Map(grades.map((grade) => [grade.id, grade.name])), [grades])
  const unitMap = useMemo(() => new Map(units.map((unit) => [unit.id, `Unit ${unit.number}`])), [units])
  const lessonMap = useMemo(() => new Map(lessons.map((lesson) => [lesson.id, lesson.title])), [lessons])
  const sectionMap = useMemo(() => new Map(sections.map((section) => [section.id, section.title])), [sections])

  const filteredUnits = selectedGradeId === 'all' ? units : units.filter((unit) => unit.gradeId === selectedGradeId)
  const filteredLessons = lessons.filter((lesson) => {
    const gradeMatch = selectedGradeId === 'all' || lesson.gradeId === selectedGradeId
    const unitMatch = selectedUnitId === 'all' || lesson.unitId === selectedUnitId
    return gradeMatch && unitMatch
  })
  const filteredSections = sections.filter((section) => {
    const gradeMatch = selectedGradeId === 'all' || section.gradeId === selectedGradeId
    const unitMatch = selectedUnitId === 'all' || section.unitId === selectedUnitId
    const lessonMatch = selectedLessonId === 'all' || section.lessonId === selectedLessonId
    return gradeMatch && unitMatch && lessonMatch
  })

  const rows: QuizTableRow[] = quizzes
    .map((quiz) => {
      // Handle both 'quizType' and 'type' fields (Firestore uses 'type' for student app format)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quizType = ((quiz as any).quizType || (quiz as any).type || 'fill-in') as Quiz['quizType']
      return {
      ...quiz,
        quizType: quizType, // Ensure quizType is always set
      gradeName: gradeMap.get(quiz.gradeId) ?? '—',
      unitTitle: unitMap.get(quiz.unitId) ?? '—',
      lessonTitle: lessonMap.get(quiz.lessonId) ?? '—',
      sectionTitle: sectionMap.get(quiz.sectionId) ?? '—',
      questionCount: questionCounts[quiz.id] ?? 0,
      }
    })
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
      // Then sort by section title
      const sectionCompare = (a.sectionTitle || '').localeCompare(b.sectionTitle || '')
      if (sectionCompare !== 0) return sectionCompare
      // Finally sort by quiz title
      return a.title.localeCompare(b.title)
    })

  const columns: Array<DataTableColumn<QuizTableRow>> = [
    { 
      key: 'title', 
      header: 'Quiz Title',
      render: (row) => (
        <div className="truncate max-w-[200px]" title={row.title}>
          {row.title}
        </div>
      ),
    },
    { key: 'quizType', header: 'Type', render: (row) => <Badge variant="secondary">{row.quizType}</Badge> },
    {
      key: 'questionCount',
      header: 'Questions',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.questionCount}</span>,
    },
    { 
      key: 'sectionTitle', 
      header: 'Section',
      render: (row) => (
        <div className="truncate max-w-[150px]" title={row.sectionTitle}>
          {row.sectionTitle}
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
      key: 'isPublished',
      header: 'Published',
      align: 'center',
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch 
            checked={row.isPublished ?? false} 
            onCheckedChange={() => {
              handlePublishToggle(row)
            }}
          />
        </div>
      ),
    },
    {
      key: 'preview',
      header: 'Preview',
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => handlePreview(row)}>
          Preview
        </Button>
      ),
    },
  ]


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Quizzes</h2>
          <p className="text-sm text-muted-foreground">Design assessments that reinforce mastery and provide feedback.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={selectedGradeId}
            onValueChange={(value: string) => {
              setSelectedGradeId(value as typeof selectedGradeId)
              setSelectedUnitId('all')
              setSelectedLessonId('all')
              setSelectedSectionId('all')
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
              setSelectedSectionId('all')
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
          <Select
            value={selectedLessonId}
            onValueChange={(value: string) => {
              setSelectedLessonId(value as typeof selectedLessonId)
              setSelectedSectionId('all')
            }}
          >
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
          <Select value={selectedSectionId} onValueChange={(value: string) => setSelectedSectionId(value as typeof selectedSectionId)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {filteredSections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleOpenNew} className="rounded-full px-6">
            Add Quiz
          </Button>
        </div>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No quizzes yet. Create a quiz to start building assessments."
        onEdit={handleEdit}
        onDelete={handleDelete}
      />


      <FormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingQuiz ? 'Edit Quiz' : 'Add Quiz'}
        description="Create quizzes and select the quiz type for each section."
        onSubmit={onSubmit}
        submitLabel={editingQuiz ? 'Update Quiz' : 'Create Quiz'}
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
                      form.setValue('sectionId', '')
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
                  ? cachedAllUnits.filter((unit) => unit.gradeId === selectedGradeId)
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
                      form.setValue('sectionId', '')
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
                    onValueChange={(value: string) => {
                      field.onChange(value)
                      form.setValue('sectionId', '')
                    }}
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
              name="sectionId"
              render={({ field }) => {
                const selectedGradeId = form.getValues('gradeId')
                const selectedUnitId = form.getValues('unitId')
                const selectedLessonId = form.getValues('lessonId')
                const filteredSections = selectedGradeId && selectedUnitId && selectedLessonId
                  ? cachedAllSections.filter((section) => section.gradeId === selectedGradeId && section.unitId === selectedUnitId && section.lessonId === selectedLessonId)
                  : []
                const hasSections = filteredSections.length > 0
                
                return (
                <FormItem>
                  <FormLabel>Section</FormLabel>
                  <Select
                    value={field.value}
                      onValueChange={field.onChange}
                      disabled={!selectedGradeId || !selectedUnitId || !selectedLessonId || !hasSections}
                  >
                    <FormControl>
                      <SelectTrigger>
                          <SelectValue placeholder={!selectedLessonId ? "Select lesson first" : "Select section"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {!selectedLessonId ? (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            Please select a lesson first.
                          </div>
                        ) : !hasSections ? (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No sections available for this lesson. Please create a section first.
                          </div>
                        ) : (
                          filteredSections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.title}
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
              name="quizType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quiz Type</FormLabel>
                  {editingQuiz ? (
                    <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm">
                      <Badge variant="secondary">{field.value}</Badge>
                      <p className="ml-2 text-xs text-muted-foreground">Quiz type cannot be changed after creation</p>
                    </div>
                  ) : (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!!editingQuiz}>
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
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quiz Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Grammar Challenge" {...field} />
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
                    <FormLabel>Publish Quiz</FormLabel>
                    <p className="text-xs text-muted-foreground">Only published quizzes appear to learners.</p>
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quiz Preview · {previewQuiz?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {previewQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add questions to preview this quiz.</p>
            ) : (
              previewQuestions
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((question, index) => (
                  <div key={question.id} className="space-y-2 rounded-xl border border-border/60 bg-white p-4 shadow-sm">
                    <p className="font-semibold text-foreground">
                      {index + 1}. {question.prompt}
                    </p>
                    <div className="mt-1 text-sm text-muted-foreground">{renderQuestionPreview(question)}</div>
                  </div>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


