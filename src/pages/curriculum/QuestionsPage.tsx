import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { QuestionBuilder } from '@/components/forms/QuestionBuilder'
import { PageLoader } from '@/components/feedback/PageLoader'
import { getQuizWithQuestions, updateQuizWithQuestions } from '@/services/quizBuilderService'
import { useCurriculumCache } from '@/context/CurriculumCacheContext'
import type { Question, Quiz } from '@/types/models'
import type { FillInQuestionFormValues, SpellingQuestionFormValues, MatchingQuestionFormValues, OrderWordsQuestionFormValues, CompositionQuestionFormValues } from '@/utils/schemas'
import { useAuth } from '@/context/AuthContext'
import { useUI } from '@/context/UIContext'

// Helper function to map quiz type to question type
function getQuestionTypeFromQuizType(quizType: Quiz['quizType']): Question['type'] {
  switch (quizType) {
    case 'fill-in':
      return 'fill-in'
    case 'spelling':
      return 'spelling'
    case 'matching':
      return 'matching'
    case 'order-words':
      return 'order-words'
    case 'composition':
      return 'composition'
    default:
      return 'fill-in'
  }
}

type QuestionTableRow = Question & {
  gradeName: string
  unitTitle: string
  lessonTitle: string
  sectionTitle: string
  quizTitle: string
  quizType: string
  serialNumber: number
}

export function QuestionsPage() {
  const { gradeId, unitId, lessonId, sectionId, quizId } = useParams<{ gradeId: string; unitId: string; lessonId: string; sectionId: string; quizId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingQuestion, setIsSavingQuestion] = useState(false)

  const { grades, allUnits: cachedAllUnits, allLessons: cachedAllLessons, allSections: cachedAllSections, allQuizzes: cachedAllQuizzes, isLoading: cacheLoading, refreshQuizzes } = useCurriculumCache()

  // Get the current grade, unit, lesson, section, and quiz
  const currentGrade = grades.find((g) => g.id === gradeId)
  const currentUnit = cachedAllUnits.find((u) => u.id === unitId && u.gradeId === gradeId)
  const currentLesson = cachedAllLessons.find((l) => l.id === lessonId && l.gradeId === gradeId && l.unitId === unitId)
  const currentSection = cachedAllSections.find((s) => s.id === sectionId && s.gradeId === gradeId && s.unitId === unitId && s.lessonId === lessonId)
  const currentQuiz = cachedAllQuizzes.find((q) => q.id === quizId && q.gradeId === gradeId && q.unitId === unitId && q.lessonId === lessonId && q.sectionId === sectionId)

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
    if (!quizId) {
      navigate(`/curriculum/${gradeId}/${unitId}/${lessonId}/${sectionId}/quizzes`)
      return
    }
  }, [gradeId, unitId, lessonId, sectionId, quizId, navigate])

  // Load questions for the quiz from URL
  useEffect(() => {
    if (!gradeId || !unitId || !lessonId || !sectionId || !quizId) {
      setIsLoading(false)
      setQuestions([])
      return
    }

    setIsLoading(true)
    getQuizWithQuestions(gradeId, unitId, lessonId, sectionId, quizId)
      .then((result) => {
        if (result) {
          setQuestions(result.questions || [])
        } else {
          setQuestions([])
        }
        setIsLoading(false)
      })
      .catch((error) => {
        notifyError('Unable to load questions', error instanceof Error ? error.message : undefined)
        setIsLoading(false)
      })
  }, [gradeId, unitId, lessonId, sectionId, quizId, notifyError])

  useEffect(() => {
    setPageTitle('Questions')
  }, [setPageTitle])

  const rows: QuestionTableRow[] = (() => {
    const getCreatedAtMillis = (question: Question) => {
      const ts = question.createdAt as { toMillis?: () => number } | null | undefined
      return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0
    }

    const baseRows = questions
      .map((question) => {
        return {
          ...question,
          gradeName: currentGrade?.name ?? '—',
          unitTitle: currentUnit ? `Unit ${currentUnit.number}` : '—',
          lessonTitle: currentLesson?.title ?? '—',
          sectionTitle: currentSection?.title ?? '—',
          quizTitle: currentQuiz?.title ?? '—',
          quizType: currentQuiz?.quizType ?? '—',
        }
      })
      .sort((a, b) => {
        // Primary: latest created first
        const aCreated = getCreatedAtMillis(a)
        const bCreated = getCreatedAtMillis(b)
        if (aCreated !== bCreated) {
          return bCreated - aCreated
        }
        // Fallback: highest order first (newer questions usually have higher order)
        const aOrder = a.order ?? 0
        const bOrder = b.order ?? 0
        return bOrder - aOrder
      })

    return baseRows.map((row, index) => ({
      ...row,
      serialNumber: index + 1,
    }))
  })()

  const handleOpenNew = () => {
    setEditingQuestion(null)
    setIsModalOpen(true)
  }

  const handleEdit = async (question: Question) => {
    if (!currentQuiz) {
      notifyError('Quiz not found', 'The quiz for this question could not be found.')
      return
    }

    setEditingQuestion(question)
    setIsModalOpen(true)
  }


  const handleDelete = async (question: Question) => {
    const confirmed = await confirmAction({
      title: 'Delete question?',
      description: `Are you sure you want to delete this question?`,
      confirmLabel: 'Delete',
    })
    if (!confirmed) return
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }

    if (!currentQuiz) {
      notifyError('Quiz not found', 'The quiz for this question could not be found.')
      return
    }

    try {
      // Get current questions
      const result = await getQuizWithQuestions(currentQuiz.gradeId, currentQuiz.unitId, currentQuiz.lessonId, currentQuiz.sectionId, currentQuiz.id)
      if (!result) {
        notifyError('Quiz not found', 'Could not load quiz questions.')
        return
      }

      // Remove question from array
      const updatedQuestions = result.questions.filter((q) => q.id !== question.id)

      // Update quiz with modified questions array
      await updateQuizWithQuestions(
        currentQuiz.gradeId,
        currentQuiz.unitId,
        currentQuiz.lessonId,
        currentQuiz.sectionId,
        currentQuiz.id,
        {}, // No quiz updates
        updatedQuestions.map((q) => ({
          ...q,
          quizId: undefined, // Remove quizId for update
        })),
        user.uid,
      )

      notifySuccess('Question deleted successfully')
      refreshQuizzes() // Refresh cache
      // Reload questions for current quiz
      if (gradeId && unitId && lessonId && sectionId && quizId) {
        const result = await getQuizWithQuestions(gradeId, unitId, lessonId, sectionId, quizId)
        if (result) {
          setQuestions(result.questions || [])
        }
      }
    } catch (error) {
      notifyError('Unable to delete question', error instanceof Error ? error.message : undefined)
    }
  }

  const handleCreateQuestion = async (values: FillInQuestionFormValues | SpellingQuestionFormValues | MatchingQuestionFormValues | OrderWordsQuestionFormValues | CompositionQuestionFormValues) => {
    if (!user?.uid || !quizId || !currentQuiz) {
      notifyError('Missing quiz', 'Quiz ID is missing')
      return
    }

    const selectedQuiz = currentQuiz

    // Ensure question type matches quiz type
    const questionType = getQuestionTypeFromQuizType(selectedQuiz.quizType)
    if (values.type && values.type !== questionType) {
      notifyError('Type mismatch', `Question type must match quiz type (${selectedQuiz.quizType})`)
      return
    }

    try {
      setIsSavingQuestion(true)
      // Get current questions
      const result = await getQuizWithQuestions(
        selectedQuiz.gradeId,
        selectedQuiz.unitId,
        selectedQuiz.lessonId,
        selectedQuiz.sectionId,
        selectedQuiz.id,
      )

      const currentQuestions = result?.questions || []
      const newQuestion: Omit<Question, 'id' | 'createdAt' | 'updatedAt' | 'quizId'> = {
        ...values,
        type: questionType, // Force type to match quiz type
        order: values.order ?? currentQuestions.length + 1,
      }

      const updatedQuestions = [...currentQuestions, newQuestion as Question]

      // Update quiz with new questions array
      await updateQuizWithQuestions(
        selectedQuiz.gradeId,
        selectedQuiz.unitId,
        selectedQuiz.lessonId,
        selectedQuiz.sectionId,
        selectedQuiz.id,
        {}, // No quiz updates
        updatedQuestions.map((q) => ({
          ...q,
          quizId: undefined, // Remove quizId for update
        })),
        user.uid,
      )

      notifySuccess('Question added successfully')
      refreshQuizzes() // Refresh cache
      setIsModalOpen(false)
      setEditingQuestion(null)

      // Reload questions for current quiz
      if (gradeId && unitId && lessonId && sectionId && quizId) {
        const result = await getQuizWithQuestions(gradeId, unitId, lessonId, sectionId, quizId)
        if (result) {
          setQuestions(result.questions || [])
        }
      }
    } catch (error) {
      notifyError('Unable to add question', error instanceof Error ? error.message : undefined)
    } finally {
      setIsSavingQuestion(false)
    }
  }

  const handleUpdateQuestion = async (id: string, values: FillInQuestionFormValues | SpellingQuestionFormValues | MatchingQuestionFormValues | OrderWordsQuestionFormValues | CompositionQuestionFormValues) => {
    if (!user?.uid || !quizId || !currentQuiz) {
      notifyError('Missing quiz', 'Quiz ID is missing')
      return
    }

    const selectedQuiz = currentQuiz

    // Ensure question type matches quiz type
    const questionType = getQuestionTypeFromQuizType(selectedQuiz.quizType)
    if (values.type && values.type !== questionType) {
      notifyError('Type mismatch', `Question type must match quiz type (${selectedQuiz.quizType})`)
      return
    }

    try {
      setIsSavingQuestion(true)
      // Get current questions
      const result = await getQuizWithQuestions(
        selectedQuiz.gradeId,
        selectedQuiz.unitId,
        selectedQuiz.lessonId,
        selectedQuiz.sectionId,
        selectedQuiz.id,
      )

      if (!result) {
        notifyError('Quiz not found', 'Could not load quiz questions.')
        return
      }

      // Update question in array, ensuring type matches quiz type
      const updatedQuestions = result.questions.map((q) =>
        q.id === id ? { ...q, ...values, type: questionType } : q,
      )

      // Update quiz with modified questions array
      await updateQuizWithQuestions(
        selectedQuiz.gradeId,
        selectedQuiz.unitId,
        selectedQuiz.lessonId,
        selectedQuiz.sectionId,
        selectedQuiz.id,
        {}, // No quiz updates
        updatedQuestions.map((q) => ({
          ...q,
          quizId: undefined, // Remove quizId for update
        })),
        user.uid,
      )

      notifySuccess('Question updated successfully')
      refreshQuizzes() // Refresh cache
      setIsModalOpen(false)
      setEditingQuestion(null)

      // Reload questions for current quiz
      if (gradeId && unitId && lessonId && sectionId && quizId) {
        const result = await getQuizWithQuestions(gradeId, unitId, lessonId, sectionId, quizId)
        if (result) {
          setQuestions(result.questions || [])
        }
      }
    } catch (error) {
      notifyError('Unable to update question', error instanceof Error ? error.message : undefined)
    } finally {
      setIsSavingQuestion(false)
    }
  }

  const handleDeleteQuestion = async (question: Question) => {
    await handleDelete(question)
  }

  const columns: Array<DataTableColumn<QuestionTableRow>> = [
    {
      key: 'serialNumber',
      header: 'S.No.',
      width: '64px',
      align: 'center',
      render: (row) => <span className="text-xs text-muted-foreground">{row.serialNumber}</span>,
    },
    {
      key: 'prompt',
      header: 'Question',
      render: (row) => (
        <div className="max-w-[400px]">
          <p className="text-sm font-medium text-foreground whitespace-normal break-words" title={row.prompt}>{row.prompt}</p>
          {row.explanation && (
            <p className="text-xs text-muted-foreground mt-1 whitespace-normal break-words" title={row.explanation}>{row.explanation}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <Badge variant="outline">{row.type}</Badge>,
    },
  ]

  // Show loader while data is loading
  if (cacheLoading || isLoading) {
    return <PageLoader />
  }

  // Show error only after loading is complete
  if (!gradeId || !unitId || !lessonId || !sectionId || !quizId || !currentGrade || !currentUnit || !currentLesson || !currentSection || !currentQuiz) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Grade, Unit, Lesson, Section, or Quiz not found</p>
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
            <Link to={`/curriculum/${gradeId}/${unitId}/${lessonId}/${sectionId}/quizzes`} className="hover:text-primary transition-colors">
              {currentQuiz.title}
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">Questions</span>
          </h2>
          <p className="text-sm text-muted-foreground">Manage questions for this quiz.</p>
        </div>
        <Button onClick={handleOpenNew} className="rounded-full px-6">
          Add Question
        </Button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No questions yet. Add questions to start building this assessment."
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <FormModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingQuestion(null)
        }}
        title={editingQuestion ? 'Edit Question' : 'Add Question'}
        onSubmit={() => {}}
        submitLabel=""
        isSubmitting={false}
        hideSubmitButton
      >
        <div className="space-y-4">

          {currentQuiz && (
            <QuestionBuilder
              quiz={currentQuiz}
              questions={questions}
              onCreate={handleCreateQuestion}
              onUpdate={handleUpdateQuestion}
              onDelete={handleDeleteQuestion}
              isSaving={isSavingQuestion}
              editingQuestion={editingQuestion}
              lessonTitle={currentLesson?.title}
            />
          )}
        </div>
      </FormModal>
    </div>
  )
}

