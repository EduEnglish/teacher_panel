import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
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
import { PageLoader } from '@/components/feedback/PageLoader'
import { quizSchema, type QuizFormValues } from '@/utils/schemas'
import { quizTypeOptions } from '@/utils/constants'
import { createQuizWithQuestions, updateQuizWithQuestions, deleteQuizWithQuestions, getQuizWithQuestions, getQuizzesForSection } from '@/services/quizBuilderService'
import { useCurriculumCache } from '@/context/CurriculumCacheContext'
import type { Quiz } from '@/types/models'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'


type QuizTableRow = Quiz & {
  gradeName: string
  unitTitle: string
  lessonTitle: string
  sectionTitle: string
  questionCount: number
}

export function QuizzesPage() {
  const { gradeId, unitId, lessonId, sectionId } = useParams<{ gradeId: string; unitId: string; lessonId: string; sectionId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null)
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})

  const { grades, allUnits: cachedAllUnits, allLessons: cachedAllLessons, allSections: cachedAllSections, isLoading: cacheLoading, refreshQuizzes } = useCurriculumCache()
  
  // Get the current grade, unit, lesson, and section
  const currentGrade = grades.find((g) => g.id === gradeId)
  const currentUnit = cachedAllUnits.find((u) => u.id === unitId && u.gradeId === gradeId)
  const currentLesson = cachedAllLessons.find((l) => l.id === lessonId && l.gradeId === gradeId && l.unitId === unitId)
  const currentSection = cachedAllSections.find((s) => s.id === sectionId && s.gradeId === gradeId && s.unitId === unitId && s.lessonId === lessonId)
  
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
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
    if (!sectionId) {
      navigate(`/curriculum/${gradeId}/${unitId}/${lessonId}/sections`)
      return
    }
  }, [gradeId, unitId, lessonId, sectionId, navigate])

  // Load quizzes for the section from URL
  useEffect(() => {
    if (!gradeId || !unitId || !lessonId || !sectionId) {
      setIsLoading(false)
      setQuizzes([])
      return
    }

    setIsLoading(true)
    getQuizzesForSection(gradeId, unitId, lessonId, sectionId)
      .then((data) => {
        // Remove duplicates by quiz ID (safety check)
        const uniqueQuizzes = Array.from(
          new Map(data.map((quiz) => [quiz.id, quiz])).values()
        )
        setQuizzes(uniqueQuizzes)
        setIsLoading(false)
      })
      .catch((error) => {
        notifyError('Unable to load quizzes', error instanceof Error ? error.message : undefined)
        setIsLoading(false)
      })
  }, [gradeId, unitId, lessonId, sectionId, notifyError])

  useEffect(() => {
    setPageTitle('Quizzes')
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
      })
    } else {
      form.reset({
        gradeId: gradeId || '',
        unitId: unitId || '',
        lessonId: lessonId || '',
        sectionId: sectionId || '',
        title: '',
        quizType: 'fill-in',
      })
    }
  }, [editingQuiz, gradeId, unitId, lessonId, sectionId, form])

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
          },
          result?.questions.map((q) => ({
            ...q,
            quizId: undefined, // Remove quizId for update
          })) || [],
          user.uid,
        )
        notifySuccess('Quiz updated successfully')
        refreshQuizzes() // Refresh cache
        
        // Reload quizzes for the current section
        if (editingQuiz.gradeId && editingQuiz.unitId && editingQuiz.lessonId && editingQuiz.sectionId) {
          const updatedQuizzes = await getQuizzesForSection(editingQuiz.gradeId, editingQuiz.unitId, editingQuiz.lessonId, editingQuiz.sectionId)
          const uniqueQuizzes = Array.from(
            new Map(updatedQuizzes.map((quiz) => [quiz.id, quiz])).values()
          )
          setQuizzes(uniqueQuizzes)
        }
      } else {
        if (!gradeId || !unitId || !lessonId || !sectionId) {
          notifyError('Missing IDs', 'Grade, Unit, Lesson, and Section IDs are required')
          return
        }
        // Check for duplicate quiz type in the same grade + unit + lesson + section
        // Load quizzes for the specific section to check for duplicates
        const sectionQuizzes = await getQuizzesForSection(
          gradeId,
          unitId,
          lessonId,
          sectionId,
        )
        const duplicateQuiz = sectionQuizzes.find((q) => q.quizType === values.quizType)
        if (duplicateQuiz) {
          notifyError('Duplicate quiz type', `A quiz with type "${values.quizType}" already exists for this section.`)
          return
        }

        // Create new quiz with empty questions array (can add questions after)
        await createQuizWithQuestions(
          {
            gradeId: gradeId,
            unitId: unitId,
            lessonId: lessonId,
            sectionId: sectionId,
            title: values.title,
            quizType: values.quizType,
          } as Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>,
          [], // Start with no questions
          user.uid,
        )
        notifySuccess('Quiz created successfully')
        refreshQuizzes() // Refresh cache
        
        // Reload quizzes for the current section
        if (gradeId && unitId && lessonId && sectionId) {
          const updatedQuizzes = await getQuizzesForSection(gradeId, unitId, lessonId, sectionId)
          const uniqueQuizzes = Array.from(
            new Map(updatedQuizzes.map((quiz) => [quiz.id, quiz])).values()
          )
          setQuizzes(uniqueQuizzes)
        }
      }
      setIsModalOpen(false)
    } catch (error) {
      notifyError('Unable to save quiz', error instanceof Error ? error.message : undefined)
    }
  })

  const gradeMap = useMemo(() => new Map(grades.map((grade) => [grade.id, grade.name])), [grades])
  const unitMap = useMemo(() => new Map(cachedAllUnits.map((unit) => [unit.id, `Unit ${unit.number}`])), [cachedAllUnits])
  const lessonMap = useMemo(() => new Map(cachedAllLessons.map((lesson) => [lesson.id, lesson.title])), [cachedAllLessons])
  const sectionMap = useMemo(() => new Map(cachedAllSections.map((section) => [section.id, section.title])), [cachedAllSections])

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
        <div className="whitespace-normal break-words" title={row.title}>
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
  ]


  // Show loader while data is loading
  if (cacheLoading || isLoading) {
    return <PageLoader />
  }

  // Show error only after loading is complete
  if (!gradeId || !unitId || !lessonId || !sectionId || !currentGrade || !currentUnit || !currentLesson || !currentSection) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Grade, Unit, Lesson, or Section not found</p>
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
            <Link to={`/curriculum/${gradeId}/${unitId}/${lessonId}/sections`} className="hover:text-primary transition-colors">
              {currentSection.title}
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">Quizzes</span>
          </h2>
          <p className="text-sm text-muted-foreground">Design assessments that reinforce mastery and provide feedback.</p>
        </div>
        <Button onClick={handleOpenNew} className="rounded-full px-6">
          Add Quiz
        </Button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No quizzes yet. Create a quiz to start building assessments."
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRowClick={(quiz) => navigate(`/curriculum/${gradeId}/${unitId}/${lessonId}/${sectionId}/${quiz.id}/questions`)}
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
          </form>
        </Form>
      </FormModal>
    </div>
  )
}


