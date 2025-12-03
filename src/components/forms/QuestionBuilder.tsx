import { useEffect, useMemo, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { nanoid } from 'nanoid/non-secure'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import {
  fillInQuestionSchema,
  matchingQuestionSchema,
  orderWordsQuestionSchema,
  spellingQuestionSchema,
  type FillInQuestionFormValues,
  type MatchingQuestionFormValues,
  type OrderWordsQuestionFormValues,
  type SpellingQuestionFormValues,
} from '@/utils/schemas'
import type { Question, Quiz, SpellingQuestion } from '@/types/models'

type QuestionBuilderProps = {
  quiz: Quiz
  questions: Question[]
  onCreate: (values: QuestionInput) => Promise<void>
  onUpdate: (id: string, values: QuestionInput) => Promise<void>
  onDelete: (question: Question) => Promise<void>
  isSaving: boolean
  editingQuestion?: Question | null
}

type QuestionInput =
  | FillInQuestionFormValues
  | SpellingQuestionFormValues
  | MatchingQuestionFormValues
  | OrderWordsQuestionFormValues


export function QuestionBuilder({ quiz, questions, onCreate, onUpdate, onDelete, isSaving, editingQuestion: externalEditingQuestion }: QuestionBuilderProps) {
  // onDelete is kept for interface compatibility but not used since questions list was removed
  void onDelete
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [orderWordsSentence, setOrderWordsSentence] = useState<string>('')
  
  // Use external editingQuestion if provided, otherwise use internal state
  const currentEditingQuestion = externalEditingQuestion !== undefined ? externalEditingQuestion : editingQuestion

  const schema = useMemo(() => {
    switch (quiz.quizType) {
      case 'fill-in':
        return fillInQuestionSchema
      case 'spelling':
        return spellingQuestionSchema
      case 'matching':
        return matchingQuestionSchema
      case 'order-words':
      default:
        return orderWordsQuestionSchema
    }
  }, [quiz.quizType])

  const form = useForm<QuestionInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: getDefaultValues(quiz.id, quiz.quizType),
    mode: 'onChange',
  })

  const blanksFieldArray = useFieldArray({
    control: form.control,
    name: 'blanks' as never,
  })

  const optionsFieldArray = useFieldArray({
    control: form.control,
    name: 'options' as never,
  })

  const answersFieldArray = useFieldArray({
    control: form.control,
    name: 'answers' as never,
  })

  const pairsFieldArray = useFieldArray({
    control: form.control,
    name: 'pairs' as never,
  })


  useEffect(() => {
    const values = currentEditingQuestion ? mapQuestionToValues(currentEditingQuestion) : getDefaultValues(quiz.id, quiz.quizType)
    form.reset(values)
  }, [currentEditingQuestion, quiz.id, quiz.quizType, form])

  // Separate effect to update orderWordsSentence state for order-words questions
  useEffect(() => {
    if (quiz.quizType === 'order-words' && currentEditingQuestion) {
      const values = mapQuestionToValues(currentEditingQuestion)
      const correctOrder = (values as OrderWordsQuestionFormValues).correctOrder ?? []
      const sentence = Array.isArray(correctOrder) && correctOrder.length > 0 ? correctOrder.join(' ') : ''
      setOrderWordsSentence(sentence)
    } else if (quiz.quizType === 'order-words' && !currentEditingQuestion) {
      setOrderWordsSentence('')
    }
  }, [currentEditingQuestion, quiz.quizType])

  const handleSubmit = form.handleSubmit(async (values) => {
    // Ensure question type matches quiz type
    const expectedType = getQuestionTypeFromQuizType(quiz.quizType)
    const payload = {
      ...values,
      type: expectedType, // Force type to match quiz type
    } as QuestionInput
    
    if (currentEditingQuestion) {
      await onUpdate(currentEditingQuestion.id, payload)
    } else {
      await onCreate(payload)
    }
    setEditingQuestion(null)
    form.reset(getDefaultValues(quiz.id, quiz.quizType))
  })

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


  const isFillIn = quiz.quizType === 'fill-in'
  const isSpelling = quiz.quizType === 'spelling'
  const isMatching = quiz.quizType === 'matching'
  const isOrderWords = quiz.quizType === 'order-words'

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-xl font-semibold">Question Builder</CardTitle>
          
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
          {questions.length} Question{questions.length === 1 ? '' : 's'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <FormField
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isFillIn ? 'Question with blanks' : 'Question Prompt'}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={isFillIn ? "e.g., The cat sat on the ___" : "Describe the question context..."} 
                        rows={isFillIn ? 2 : 3} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isFillIn && (
              <div className="space-y-5 border-t border-border pt-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FormLabel>Accepted Answers</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => blanksFieldArray.append({ id: nanoid(), answer: '' } as never)}
                    >
                      Add more answers
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {blanksFieldArray.fields.map((fieldItem, index) => (
                      <FormField
                        key={fieldItem.id}
                        name={`blanks.${index}.answer` as const}
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-xs font-semibold uppercase text-muted-foreground">
                              Answer {index + 1}
                            </FormLabel>
                            <div className="flex items-center gap-2">
                              <FormControl>
                                <Input {...field} placeholder="Correct word" />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => blanksFieldArray.remove(index)}
                              >
                                ×
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <FormLabel>Multiple Choice Options (Optional)</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => optionsFieldArray.append('')}
                    >
                      Add more options
                    </Button>
                  </div>
                 
                  <div className="grid gap-3 sm:grid-cols-2">
                    {optionsFieldArray.fields.map((fieldItem, index) => (
                      <FormField
                        key={fieldItem.id}
                        name={`options.${index}` as const}
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-xs font-semibold uppercase text-muted-foreground">
                              Option {index + 1}
                            </FormLabel>
                            <div className="flex items-center gap-2">
                              <FormControl>
                                <Input {...field} placeholder="Option text" />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => optionsFieldArray.remove(index)}
                              >
                                ×
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  {optionsFieldArray.fields.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      No options added. Students will type their answers freely.
                    </p>
                  )}
                </div>
              </div>
            )}

            {isSpelling && (
              <div className="space-y-3 border-t border-border pt-5">
                <div className="flex items-center justify-between">
                  <FormLabel>Correct Answers</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => answersFieldArray.append('')}
                  >
                    Add Answer
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add one or more correct answers. Students can provide any of these answers.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {answersFieldArray.fields.map((fieldItem, index) => (
                    <FormField
                      key={fieldItem.id}
                      name={`answers.${index}` as const}
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-xs font-semibold uppercase text-muted-foreground">
                            Answer {index + 1}
                          </FormLabel>
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input {...field} placeholder="Correct spelling" />
                            </FormControl>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => answersFieldArray.remove(index)}
                            >
                              ×
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {isMatching && (
              <div className="space-y-3 border-t border-border pt-5">
                <div className="flex items-center justify-between">
                  <FormLabel>Matching Pairs</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pairsFieldArray.append({ id: nanoid(), left: '', right: '' } as never)}
                  >
                    Add Pair
                  </Button>
                </div>
                <div className="space-y-3">
                  {pairsFieldArray.fields.map((fieldItem, index) => (
                    <div key={fieldItem.id} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
                      <FormField
                        name={`pairs.${index}.left` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">Prompt</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Left column value" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name={`pairs.${index}.right` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">Answer</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Right column value" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => pairsFieldArray.remove(index)}>
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isOrderWords && (
              <div className="space-y-3 border-t border-border pt-5">
                <FormField
                  name="correctOrder"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel>Correct Answer</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter the complete sentence in the correct order (e.g., The cat sat on the mat)"
                            rows={3}
                            value={orderWordsSentence}
                            onChange={(event) => {
                              const sentence = event.target.value
                              // Update local state immediately to allow free typing with spaces
                              setOrderWordsSentence(sentence)
                              
                              // Split sentence into words for form storage
                              const words = sentence.trim()
                                ? sentence
                                    .trim()
                                    .split(/\s+/)
                                    .filter((word) => word.length > 0)
                                : []
                              
                              // Update form fields
                              field.onChange(words)
                              form.setValue('words', words)
                            }}
                            onBlur={() => {
                              // Ensure form is synced on blur
                              const words = orderWordsSentence.trim()
                                ? orderWordsSentence
                                    .trim()
                                    .split(/\s+/)
                                    .filter((word) => word.length > 0)
                                : []
                              field.onChange(words)
                              form.setValue('words', words)
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Enter the complete sentence that students should form by arranging the words.
                        </p>
                      </FormItem>
                    )
                  }}
                />
              </div>
            )}

            <div className="space-y-4 border-t border-border pt-5">
              <FormField
                name="points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Points</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        value={field.value ?? 1}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                        placeholder="1"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="order"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        value={field.value ?? (currentEditingQuestion?.order ?? questions.length + 1)}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
            
              <Button type="submit" disabled={isSaving} className="sm:min-w-[180px]">
                {isSaving ? 'Saving…' : currentEditingQuestion ? 'Update Question' : 'Add Question'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function getDefaultValues(quizId: string, quizType: Quiz['quizType']): QuestionInput {
  switch (quizType) {
    case 'fill-in':
      return {
        quizId,
        prompt: '',
        blanks: [{ id: nanoid(), answer: '' }],
        options: [],
        type: 'fill-in',
        order: 1,
        points: 1,
        isPublished: false,
        status: 'active',
      }
    case 'spelling':
      return {
        quizId,
        prompt: '',
        answers: [''],
        type: 'spelling',
        order: 1,
        points: 1,
        isPublished: false,
        status: 'active',
      }
    case 'matching':
      return {
        quizId,
        prompt: '',
        pairs: [
          { id: nanoid(), left: '', right: '' },
          { id: nanoid(), left: '', right: '' },
        ],
        type: 'matching',
        order: 1,
        points: 1,
        isPublished: false,
        status: 'active',
      }
    case 'order-words':
    default:
      return {
        quizId,
        prompt: '',
        words: [], // Keep for schema validation, will be synced with correctOrder
        correctOrder: [],
        type: 'order-words',
        order: 1,
        points: 1,
        isPublished: false,
        status: 'active',
      }
  }
}

function mapQuestionToValues(question: Question): QuestionInput {
  if (question.type === 'fill-in') {
    return {
      ...question,
      prompt: question.prompt || question.sentence || '', // Support both prompt and sentence for backward compatibility
      blanks: question.blanks.length ? question.blanks : [{ id: nanoid(), answer: '' }],
      options: question.options || [],
      points: question.points ?? 1,
      order: question.order ?? 1,
      isPublished: question.isPublished ?? false,
      status: question.status ?? 'active',
    }
  }

  if (question.type === 'spelling') {
    // Convert single answer to array if needed (backward compatibility)
    const questionWithAnswer = question as SpellingQuestion & { answer?: string }
    const answers = Array.isArray(question.answers)
      ? question.answers
      : questionWithAnswer.answer
        ? [questionWithAnswer.answer]
        : ['']
    return {
      ...question,
      answers,
      points: question.points ?? 1,
      order: question.order ?? 1,
      isPublished: question.isPublished ?? false,
      status: question.status ?? 'active',
    }
  }

  if (question.type === 'matching') {
    return {
      ...question,
      pairs: question.pairs.length
        ? question.pairs
        : [
            { id: nanoid(), left: '', right: '' },
            { id: nanoid(), left: '', right: '' },
          ],
      points: question.points ?? 1,
      order: question.order ?? 1,
      isPublished: question.isPublished ?? false,
      status: question.status ?? 'active',
    }
  }

  if (question.type === 'order-words') {
    // In Firestore, 'order' can be an array (correct answer) or a number (question position)
    // Check if order is an array (from Firestore student app format)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const questionOrder = (question as any).order
    const isOrderArray = Array.isArray(questionOrder)
    
    // Use correctOrder as primary, fallback to words, then check if order is an array
    let correctOrder = question.correctOrder ?? question.words ?? []
    
    // If order is an array (from Firestore), use it as the correct answer
    if (isOrderArray && questionOrder.length > 0) {
      correctOrder = questionOrder
    }
    
    // If correctOrder is still empty but prompt exists, try to extract words from prompt
    if ((!correctOrder || correctOrder.length === 0) && question.prompt) {
      const wordsFromPrompt = question.prompt.trim().split(/\s+/).filter((word) => word.length > 0)
      if (wordsFromPrompt.length > 0) {
        correctOrder = wordsFromPrompt
      }
    }
    
    // Get the question position order (number), not the word array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const questionPositionOrder = isOrderArray ? ((question as any).questionOrder ?? 1) : (typeof questionOrder === 'number' ? questionOrder : question.order ?? 1)
    
    return {
      ...question,
      prompt: question.prompt || '',
      words: correctOrder, // Sync words with correctOrder for schema validation
      correctOrder: correctOrder,
      points: question.points ?? 1,
      order: questionPositionOrder, // Question position order (number)
      isPublished: question.isPublished ?? false,
      status: question.status ?? 'active',
    }
  }

  return question as QuestionInput
}



