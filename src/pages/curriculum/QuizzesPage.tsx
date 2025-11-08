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
import { QuestionBuilder, renderQuestionPreview } from '@/components/forms/QuestionBuilder'
import { quizSchema, type QuizFormValues } from '@/utils/schemas'
import { gradeService, lessonService, questionService, quizService, sectionService, unitService } from '@/services/firebase'
import type { Grade, Lesson, Question, Quiz, Section, Unit } from '@/types/models'
import { useCollection } from '@/hooks/useCollection'
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
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})
  const [questions, setQuestions] = useState<Question[]>([])
  const [areQuestionsLoading, setAreQuestionsLoading] = useState(false)
  const [isSavingQuestion, setIsSavingQuestion] = useState(false)

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
  const { data: sections } = useCollection<Section>(sectionService.listen, sectionsConstraints)

  const quizzesConstraints = useMemo(() => {
    const constraints = []
    if (selectedGradeId !== 'all') constraints.push(where('gradeId', '==', selectedGradeId))
    if (selectedUnitId !== 'all') constraints.push(where('unitId', '==', selectedUnitId))
    if (selectedLessonId !== 'all') constraints.push(where('lessonId', '==', selectedLessonId))
    if (selectedSectionId !== 'all') constraints.push(where('sectionId', '==', selectedSectionId))
    return constraints.length ? constraints : undefined
  }, [selectedGradeId, selectedUnitId, selectedLessonId, selectedSectionId])
  const { data: quizzes, isLoading } = useCollection<Quiz>(quizService.listen, quizzesConstraints)

  useEffect(() => {
    setPageTitle('Quiz Management')
  }, [setPageTitle])

  useEffect(() => {
    const unsubscribe = questionService.listen((items) => {
      const grouped = items.reduce<Record<string, number>>((acc, question) => {
        acc[question.quizId] = (acc[question.quizId] ?? 0) + 1
        return acc
      }, {})
      setQuestionCounts(grouped)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!selectedQuiz) {
      setQuestions([])
      return
    }
    setAreQuestionsLoading(true)
    const unsubscribe = questionService.listen(
      (items) => {
        setQuestions(items.filter((question) => question.quizId === selectedQuiz.id))
        setAreQuestionsLoading(false)
      },
      [where('quizId', '==', selectedQuiz.id)],
    )
    return () => unsubscribe()
  }, [selectedQuiz])

  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizSchema) as any,
    defaultValues: {
      gradeId: '',
      unitId: '',
      lessonId: '',
      sectionId: '',
      title: '',
      description: '',
      quizType: 'fill-in',
      isPublished: false,
      status: 'active',
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
        description: editingQuiz.description ?? '',
        quizType: editingQuiz.quizType,
        isPublished: editingQuiz.isPublished,
        status: editingQuiz.status,
      })
    } else {
      form.reset({
        gradeId: selectedGradeId === 'all' ? '' : selectedGradeId,
        unitId: selectedUnitId === 'all' ? '' : selectedUnitId,
        lessonId: selectedLessonId === 'all' ? '' : selectedLessonId,
        sectionId: selectedSectionId === 'all' ? '' : selectedSectionId,
        title: '',
        description: '',
        quizType: 'fill-in',
        isPublished: false,
        status: 'active',
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
      await quizService.remove(quiz.id, user.uid, { title: quiz.title })
      notifySuccess('Quiz deleted successfully')
      if (selectedQuiz?.id === quiz.id) {
        setSelectedQuiz(null)
      }
    } catch (error) {
      notifyError('Unable to delete quiz', error instanceof Error ? error.message : undefined)
    }
  }

  const handlePublishToggle = async (quiz: Quiz) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      await quizService.update(
        quiz.id,
        { isPublished: !quiz.isPublished },
        user.uid,
        { title: quiz.title, isPublished: !quiz.isPublished },
      )
      notifySuccess(quiz.isPublished ? 'Quiz unpublished' : 'Quiz published')
    } catch (error) {
      notifyError('Unable to update quiz status', error instanceof Error ? error.message : undefined)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      if (editingQuiz) {
        await quizService.update(
          editingQuiz.id,
          {
            gradeId: values.gradeId,
            unitId: values.unitId,
            lessonId: values.lessonId,
            sectionId: values.sectionId,
            title: values.title,
            description: values.description?.trim() || '',
            quizType: values.quizType,
            isPublished: values.isPublished,
            status: values.status,
          },
          user.uid,
          { title: values.title },
        )
        notifySuccess('Quiz updated successfully')
      } else {
        await quizService.create(
          {
            gradeId: values.gradeId,
            unitId: values.unitId,
            lessonId: values.lessonId,
            sectionId: values.sectionId,
            title: values.title,
            description: values.description?.trim() || '',
            quizType: values.quizType,
            isPublished: values.isPublished,
            status: values.status,
          } as Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>,
          user.uid,
          { title: values.title },
        )
        notifySuccess('Quiz created successfully')
      }
      setIsModalOpen(false)
    } catch (error) {
      notifyError('Unable to save quiz', error instanceof Error ? error.message : undefined)
    }
  })

  const handleSelectQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz)
  }

  const handlePreview = () => {
    if (!selectedQuiz) return
    setPreviewOpen(true)
  }

  const handleCreateQuestion = async (values: any) => {
    if (!user?.uid || !selectedQuiz) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      setIsSavingQuestion(true)
      await questionService.create(values as Omit<Question, 'id' | 'createdAt' | 'updatedAt'>, user.uid, { quizId: selectedQuiz.id })
      notifySuccess('Question added')
    } catch (error) {
      notifyError('Unable to add question', error instanceof Error ? error.message : undefined)
    } finally {
      setIsSavingQuestion(false)
    }
  }

  const handleUpdateQuestion = async (id: string, values: any) => {
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      setIsSavingQuestion(true)
      await questionService.update(id, values, user.uid, { quizId: selectedQuiz?.id })
      notifySuccess('Question updated')
    } catch (error) {
      notifyError('Unable to update question', error instanceof Error ? error.message : undefined)
    } finally {
      setIsSavingQuestion(false)
    }
  }

  const handleDeleteQuestion = async (question: Question) => {
    const confirmed = await confirmAction({
      title: 'Delete question?',
      description: 'This question will be removed from the quiz.',
      confirmLabel: 'Delete',
    })
    if (!confirmed) return
    if (!user?.uid) {
      notifyError('Missing admin session', 'Please sign in again.')
      return
    }
    try {
      await questionService.remove(question.id, user.uid, { quizId: question.quizId })
      notifySuccess('Question deleted')
    } catch (error) {
      notifyError('Unable to delete question', error instanceof Error ? error.message : undefined)
    }
  }

  const gradeMap = useMemo(() => new Map(grades.map((grade) => [grade.id, grade.name])), [grades])
  const unitMap = useMemo(() => new Map(units.map((unit) => [unit.id, unit.title])), [units])
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
    .map((quiz) => ({
      ...quiz,
      gradeName: gradeMap.get(quiz.gradeId) ?? '—',
      unitTitle: unitMap.get(quiz.unitId) ?? '—',
      lessonTitle: lessonMap.get(quiz.lessonId) ?? '—',
      sectionTitle: sectionMap.get(quiz.sectionId) ?? '—',
      questionCount: questionCounts[quiz.id] ?? 0,
    }))
    .sort((a, b) => a.title.localeCompare(b.title))

  const columns: Array<DataTableColumn<QuizTableRow>> = [
    { key: 'title', header: 'Quiz Title' },
    { key: 'quizType', header: 'Type', render: (row) => <Badge variant="secondary">{row.quizType}</Badge> },
    {
      key: 'questionCount',
      header: 'Questions',
      align: 'center',
      render: (row) => <span className="font-semibold text-foreground">{row.questionCount}</span>,
    },
    { key: 'sectionTitle', header: 'Section' },
    { key: 'lessonTitle', header: 'Lesson' },
    {
      key: 'isPublished',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.isPublished ? 'default' : 'secondary'}>{row.isPublished ? 'Published' : 'Draft'}</Badge>
      ),
    },
    {
      key: 'manage',
      header: 'Builder',
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => handleSelectQuiz(row)}>
          Build
        </Button>
      ),
    },
  ]

  const selectedQuizQuestions = selectedQuiz ? questions : []

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
                  {unit.title}
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

      {selectedQuiz && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary/60">{selectedQuiz.quizType}</p>
              <h3 className="text-xl font-semibold text-foreground">{selectedQuiz.title}</h3>
              <p className="text-sm text-muted-foreground">{selectedQuiz.description || 'No description provided.'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handlePublishToggle(selectedQuiz)}>
                {selectedQuiz.isPublished ? 'Unpublish' : 'Publish'}
              </Button>
              <Button variant="outline" size="sm" onClick={handlePreview} disabled={!selectedQuizQuestions.length}>
                Preview Quiz
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setSelectedQuiz(null)}>
                Close Builder
              </Button>
            </div>
          </div>

          <QuestionBuilder
            quiz={selectedQuiz}
            questions={selectedQuizQuestions}
            onCreate={handleCreateQuestion}
            onUpdate={handleUpdateQuestion}
            onDelete={handleDeleteQuestion}
            isSaving={isSavingQuestion}
          />
          {areQuestionsLoading && <p className="text-sm text-muted-foreground">Loading questions…</p>}
        </div>
      )}

      <FormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingQuiz ? 'Edit Quiz' : 'Add Quiz'}
        description="Quizzes inherit their type from the selected section."
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
                      form.setValue('quizType', 'fill-in')
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
                      form.setValue('sectionId', '')
                      form.setValue('quizType', 'fill-in')
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
                  <Select
                    value={field.value}
                    onValueChange={(value: string) => {
                      field.onChange(value)
                      form.setValue('sectionId', '')
                      form.setValue('quizType', 'fill-in')
                    }}
                  >
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
              name="sectionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Section</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value: string) => {
                      field.onChange(value)
                      const section = sections.find((s) => s.id === value)
                      form.setValue('quizType', section?.quizType ?? 'fill-in')
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sections
                        .filter((section) => section.lessonId === form.getValues('lessonId'))
                        .map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.title}
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
                  <FormLabel>Quiz Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Grammar Challenge" {...field} />
                  </FormControl>
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
                    <Input placeholder="Optional instructions" {...field} />
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
                  <Input value={field.value} readOnly />
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
            <DialogTitle>Quiz Preview · {selectedQuiz?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedQuizQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add questions to preview this quiz.</p>
            ) : (
              selectedQuizQuestions
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


