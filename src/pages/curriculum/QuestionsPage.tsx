import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable'
import { FormModal } from '@/components/forms/FormModal'
import { QuestionBuilder } from '@/components/forms/QuestionBuilder'
import { hierarchicalUnitService, hierarchicalLessonService, hierarchicalSectionService } from '@/services/hierarchicalServices'
import { getQuizzesForSection, getQuizWithQuestions, updateQuizWithQuestions } from '@/services/quizBuilderService'
import { useCurriculumCache } from '@/context/CurriculumCacheContext'
import type { Lesson, Question, Quiz, Section, Unit } from '@/types/models'
import type { FillInQuestionFormValues, SpellingQuestionFormValues, MatchingQuestionFormValues, OrderWordsQuestionFormValues } from '@/utils/schemas'
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
}

export function QuestionsPage() {
  const { user } = useAuth()
  const { setPageTitle, notifyError, notifySuccess, confirmAction } = useUI()

  const [selectedGradeId, setSelectedGradeId] = useState<string | 'all'>('all')
  const [selectedUnitId, setSelectedUnitId] = useState<string | 'all'>('all')
  const [selectedLessonId, setSelectedLessonId] = useState<string | 'all'>('all')
  const [selectedSectionId, setSelectedSectionId] = useState<string | 'all'>('all')
  const [selectedQuizId, setSelectedQuizId] = useState<string | 'all'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [formSelectedQuizId, setFormSelectedQuizId] = useState<string>('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingQuestion, setIsSavingQuestion] = useState(false)

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

  // Load units for selected grade
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

  // Auto-select first unit if only one exists
  useEffect(() => {
    if (selectedGradeId !== 'all' && units.length === 1 && selectedUnitId === 'all') {
      setSelectedUnitId(units[0].id)
    }
  }, [selectedGradeId, units, selectedUnitId])

  // Load lessons for selected unit
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

  // Auto-select first lesson if only one exists
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

  // Auto-select first section if only one exists
  useEffect(() => {
    if (selectedLessonId !== 'all' && sections.length === 1 && selectedSectionId === 'all') {
      setSelectedSectionId(sections[0].id)
    }
  }, [selectedLessonId, sections, selectedSectionId])

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
      
      let filtered = cachedAllQuizzes
      
      if (selectedGradeId !== 'all') {
        filtered = filtered.filter((quiz) => quiz.gradeId === selectedGradeId)
      }
      
      if (selectedUnitId !== 'all') {
        filtered = filtered.filter((quiz) => quiz.unitId === selectedUnitId)
      }
      
      if (selectedLessonId !== 'all') {
        filtered = filtered.filter((quiz) => quiz.lessonId === selectedLessonId)
      }
      
      if (selectedSectionId !== 'all') {
        filtered = filtered.filter((quiz) => quiz.sectionId === selectedSectionId)
      }
      
      setQuizzes(filtered)
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
  }, [selectedGradeId, selectedUnitId, selectedLessonId, selectedSectionId, cachedAllQuizzes, cacheLoading, notifyError])

  // Auto-select first quiz if only one exists
  useEffect(() => {
    if (selectedSectionId !== 'all' && quizzes.length === 1 && selectedQuizId === 'all') {
      setSelectedQuizId(quizzes[0].id)
    }
  }, [selectedSectionId, quizzes, selectedQuizId])

  // Load all questions from all quizzes
  useEffect(() => {
    if (cachedAllQuizzes.length === 0) {
      setQuestions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const loadAllQuestions = async () => {
      const questionPromises = cachedAllQuizzes.map(async (quiz) => {
        try {
          const result = await getQuizWithQuestions(
            quiz.gradeId,
            quiz.unitId,
            quiz.lessonId,
            quiz.sectionId,
            quiz.id,
          )
          return result?.questions || []
        } catch {
          return []
        }
      })

      const questionArrays = await Promise.all(questionPromises)
      const allQuestions = questionArrays.flat()
      setQuestions(allQuestions)
      setIsLoading(false)
    }

    loadAllQuestions()
  }, [cachedAllQuizzes])

  useEffect(() => {
    setPageTitle('Question Management')
  }, [setPageTitle])

  const gradeMap = useMemo(() => new Map(grades.map((grade) => [grade.id, grade.name])), [grades])
  const unitMap = useMemo(() => new Map(cachedAllUnits.map((unit) => [unit.id, `Unit ${unit.number}`])), [cachedAllUnits])
  const lessonMap = useMemo(() => new Map(cachedAllLessons.map((lesson) => [lesson.id, lesson.title])), [cachedAllLessons])
  const sectionMap = useMemo(() => new Map(cachedAllSections.map((section) => [section.id, section.title])), [cachedAllSections])
  const quizMap = useMemo(() => new Map(cachedAllQuizzes.map((quiz) => [quiz.id, quiz])), [cachedAllQuizzes])

  const filteredQuestions = useMemo(() => {
    return questions.filter((question) => {
      const quiz = quizMap.get(question.quizId)
      if (!quiz) return false

      const gradeMatch = selectedGradeId === 'all' || quiz.gradeId === selectedGradeId
      const unitMatch = selectedUnitId === 'all' || quiz.unitId === selectedUnitId
      const lessonMatch = selectedLessonId === 'all' || quiz.lessonId === selectedLessonId
      const sectionMatch = selectedSectionId === 'all' || quiz.sectionId === selectedSectionId
      const quizMatch = selectedQuizId === 'all' || quiz.id === selectedQuizId

      return gradeMatch && unitMatch && lessonMatch && sectionMatch && quizMatch
    })
  }, [questions, quizMap, selectedGradeId, selectedUnitId, selectedLessonId, selectedSectionId, selectedQuizId])

  const rows: QuestionTableRow[] = filteredQuestions
    .map((question) => {
      const quiz = quizMap.get(question.quizId)
      return {
        ...question,
        gradeName: quiz ? gradeMap.get(quiz.gradeId) ?? '—' : '—',
        unitTitle: quiz ? unitMap.get(quiz.unitId) ?? '—' : '—',
        lessonTitle: quiz ? lessonMap.get(quiz.lessonId) ?? '—' : '—',
        sectionTitle: quiz ? sectionMap.get(quiz.sectionId) ?? '—' : '—',
        quizTitle: quiz?.title ?? '—',
        quizType: quiz?.quizType ?? '—',
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
      // Then sort by quiz title
      const quizCompare = (a.quizTitle || '').localeCompare(b.quizTitle || '')
      if (quizCompare !== 0) return quizCompare
      // Finally sort by question order
      return a.order - b.order
    })

  const handleOpenNew = () => {
    setEditingQuestion(null)
    setFormSelectedQuizId('')
    setIsModalOpen(true)
  }

  const handleEdit = async (question: Question) => {
    const quiz = quizMap.get(question.quizId)
    if (!quiz) {
      notifyError('Quiz not found', 'The quiz for this question could not be found.')
      return
    }

    setEditingQuestion(question)
    setFormSelectedQuizId(quiz.id)
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

    const quiz = quizMap.get(question.quizId)
    if (!quiz) {
      notifyError('Quiz not found', 'The quiz for this question could not be found.')
      return
    }

    try {
      // Get current questions
      const result = await getQuizWithQuestions(quiz.gradeId, quiz.unitId, quiz.lessonId, quiz.sectionId, quiz.id)
      if (!result) {
        notifyError('Quiz not found', 'Could not load quiz questions.')
        return
      }

      // Remove question from array
      const updatedQuestions = result.questions.filter((q) => q.id !== question.id)

      // Update quiz with modified questions array
      await updateQuizWithQuestions(
        quiz.gradeId,
        quiz.unitId,
        quiz.lessonId,
        quiz.sectionId,
        quiz.id,
        {}, // No quiz updates
        updatedQuestions.map((q) => ({
          ...q,
          quizId: undefined, // Remove quizId for update
        })),
        user.uid,
      )

      notifySuccess('Question deleted successfully')
      refreshQuizzes() // Refresh cache
      // Reload questions
      const loadAllQuestions = async () => {
        const questionPromises = cachedAllQuizzes.map(async (q) => {
          try {
            const res = await getQuizWithQuestions(q.gradeId, q.unitId, q.lessonId, q.sectionId, q.id)
            return res?.questions || []
          } catch {
            return []
          }
        })
        const questionArrays = await Promise.all(questionPromises)
        setQuestions(questionArrays.flat())
      }
      loadAllQuestions()
    } catch (error) {
      notifyError('Unable to delete question', error instanceof Error ? error.message : undefined)
    }
  }

  const handleCreateQuestion = async (values: FillInQuestionFormValues | SpellingQuestionFormValues | MatchingQuestionFormValues | OrderWordsQuestionFormValues) => {
    if (!user?.uid || !formSelectedQuizId) {
      notifyError('Missing quiz selection', 'Please select a quiz first.')
      return
    }

    const selectedQuiz = quizMap.get(formSelectedQuizId)
    if (!selectedQuiz) {
      notifyError('Quiz not found', 'The selected quiz could not be found.')
      return
    }

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
      setFormSelectedQuizId('')
      setEditingQuestion(null)

      // Reload questions
      const loadAllQuestions = async () => {
        const questionPromises = cachedAllQuizzes.map(async (q) => {
          try {
            const res = await getQuizWithQuestions(q.gradeId, q.unitId, q.lessonId, q.sectionId, q.id)
            return res?.questions || []
          } catch {
            return []
          }
        })
        const questionArrays = await Promise.all(questionPromises)
        setQuestions(questionArrays.flat())
      }
      loadAllQuestions()
    } catch (error) {
      notifyError('Unable to add question', error instanceof Error ? error.message : undefined)
    } finally {
      setIsSavingQuestion(false)
    }
  }

  const handleUpdateQuestion = async (id: string, values: FillInQuestionFormValues | SpellingQuestionFormValues | MatchingQuestionFormValues | OrderWordsQuestionFormValues) => {
    if (!user?.uid || !formSelectedQuizId) {
      notifyError('Missing quiz selection', 'Please select a quiz first.')
      return
    }

    const selectedQuiz = quizMap.get(formSelectedQuizId)
    if (!selectedQuiz) {
      notifyError('Quiz not found', 'The selected quiz could not be found.')
      return
    }

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
      setFormSelectedQuizId('')
      setEditingQuestion(null)

      // Reload questions
      const loadAllQuestions = async () => {
        const questionPromises = cachedAllQuizzes.map(async (q) => {
          try {
            const res = await getQuizWithQuestions(q.gradeId, q.unitId, q.lessonId, q.sectionId, q.id)
            return res?.questions || []
          } catch {
            return []
          }
        })
        const questionArrays = await Promise.all(questionPromises)
        setQuestions(questionArrays.flat())
      }
      loadAllQuestions()
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
      key: 'prompt',
      header: 'Question',
      render: (row) => (
        <div className="max-w-[300px]">
          <p className="text-sm font-medium text-foreground truncate" title={row.prompt}>{row.prompt}</p>
          {row.explanation && (
            <p className="text-xs text-muted-foreground mt-1 truncate" title={row.explanation}>{row.explanation}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <Badge variant="outline">{row.type}</Badge>,
    },
    {
      key: 'quizTitle',
      header: 'Quiz',
      render: (row) => (
        <div className="max-w-[150px]">
          <p className="text-sm font-medium truncate" title={row.quizTitle}>{row.quizTitle}</p>
          <p className="text-xs text-muted-foreground truncate" title={row.quizType}>{row.quizType}</p>
        </div>
      ),
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
  ]

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
  const filteredQuizzesForSelect = quizzes.filter((quiz) => {
    const gradeMatch = selectedGradeId === 'all' || quiz.gradeId === selectedGradeId
    const unitMatch = selectedUnitId === 'all' || quiz.unitId === selectedUnitId
    const lessonMatch = selectedLessonId === 'all' || quiz.lessonId === selectedLessonId
    const sectionMatch = selectedSectionId === 'all' || quiz.sectionId === selectedSectionId
    return gradeMatch && unitMatch && lessonMatch && sectionMatch
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Questions</h2>
          <p className="text-sm text-muted-foreground">Manage questions across all quizzes in your curriculum.</p>
        </div>
        <Button onClick={handleOpenNew} className="rounded-full px-6">
          Add Question
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          value={selectedGradeId}
          onValueChange={(value: string) => {
            setSelectedGradeId(value as typeof selectedGradeId)
            setSelectedUnitId('all')
            setSelectedLessonId('all')
            setSelectedSectionId('all')
            setSelectedQuizId('all')
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
            setSelectedQuizId('all')
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
            setSelectedQuizId('all')
          }}
        >
          <SelectTrigger className="w-[180px]">
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

        <Select
          value={selectedSectionId}
          onValueChange={(value: string) => {
            setSelectedSectionId(value as typeof selectedSectionId)
            setSelectedQuizId('all')
          }}
        >
          <SelectTrigger className="w-[180px]">
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

        <Select
          value={selectedQuizId}
          onValueChange={(value: string) => {
            setSelectedQuizId(value as typeof selectedQuizId)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by quiz" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All quizzes</SelectItem>
            {filteredQuizzesForSelect.map((quiz) => (
              <SelectItem key={quiz.id} value={quiz.id}>
                {quiz.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No questions yet. Select a quiz and add questions to start building assessments."
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <FormModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setFormSelectedQuizId('')
          setEditingQuestion(null)
        }}
        title={editingQuestion ? 'Edit Question' : 'Add Question'}
        description="Select a quiz and add questions to it."
        onSubmit={() => {}}
        submitLabel=""
        isSubmitting={false}
        hideSubmitButton
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Quiz</label>
            <Select
              value={formSelectedQuizId}
              onValueChange={setFormSelectedQuizId}
              disabled={!!editingQuestion}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a quiz" />
              </SelectTrigger>
              <SelectContent>
                {cachedAllQuizzes.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No quizzes available. Please create a quiz first.
                  </div>
                ) : (
                  cachedAllQuizzes.map((quiz) => (
                    <SelectItem key={quiz.id} value={quiz.id}>
                      {quiz.title} ({quiz.quizType})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {editingQuestion && (
              <p className="text-xs text-muted-foreground">Quiz cannot be changed when editing a question.</p>
            )}
          </div>

          {formSelectedQuizId && quizMap.get(formSelectedQuizId) && (
            <QuestionBuilder
              quiz={quizMap.get(formSelectedQuizId)!}
              questions={editingQuestion ? [editingQuestion] : []}
              onCreate={handleCreateQuestion}
              onUpdate={handleUpdateQuestion}
              onDelete={handleDeleteQuestion}
              isSaving={isSavingQuestion}
            />
          )}
        </div>
      </FormModal>
    </div>
  )
}

