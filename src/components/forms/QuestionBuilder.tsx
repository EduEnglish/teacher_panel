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
  compositionQuestionSchema,
  type FillInQuestionFormValues,
  type MatchingQuestionFormValues,
  type OrderWordsQuestionFormValues,
  type SpellingQuestionFormValues,
  type CompositionQuestionFormValues,
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
  lessonTitle?: string
}

type QuestionInput =
  | FillInQuestionFormValues
  | SpellingQuestionFormValues
  | MatchingQuestionFormValues
  | OrderWordsQuestionFormValues
  | CompositionQuestionFormValues


export function QuestionBuilder({ quiz, questions, onCreate, onUpdate, onDelete, isSaving, editingQuestion: externalEditingQuestion, lessonTitle }: QuestionBuilderProps) {
  // onDelete is kept for interface compatibility but not used since questions list was removed
  void onDelete
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [orderWordsSentence, setOrderWordsSentence] = useState<string>('')
  
  // State for comma-separated options input for each blank
  const [commaOptionsInputs, setCommaOptionsInputs] = useState<Record<number, string>>({})

  // Function to parse comma-separated options
  const parseCommaOptions = (input: string): string[] => {
    return input
      .split(',')
      .map(option => option.trim())
      .filter(option => option.length > 0)
  }

  // Function to handle adding comma-separated options
  const handleAddCommaOptions = (blankIndex: number) => {
    const input = commaOptionsInputs[blankIndex] || ''
    const parsedOptions = parseCommaOptions(input)
    
    if (parsedOptions.length > 0) {
      const current = form.getValues(`blanks.${blankIndex}.options`) as string[] || []
      const updated = [...current, ...parsedOptions]
      form.setValue(`blanks.${blankIndex}.options`, updated)
      
      // Clear the input field after adding
      setCommaOptionsInputs(prev => ({
        ...prev,
        [blankIndex]: ''
      }))
    }
  }

  // Function to remove a specific option
  const removeOption = (blankIndex: number, optionIndex: number) => {
    const current = form.getValues(`blanks.${blankIndex}.options`) as string[] || []
    const updated = current.filter((_, idx) => idx !== optionIndex)
    form.setValue(`blanks.${blankIndex}.options`, updated)
  }
  
  // Use external editingQuestion if provided, otherwise use internal state
  const currentEditingQuestion = externalEditingQuestion !== undefined ? externalEditingQuestion : editingQuestion

  // Check if this is a Passages or Literature lesson
  const isPassages = lessonTitle?.toLowerCase().trim() === 'passages'
  const isLiterature = lessonTitle?.toLowerCase().trim() === 'literature'
  const isPassagesOrLiterature = isPassages || isLiterature

  const schema = useMemo(() => {
    switch (quiz.quizType) {
      case 'fill-in':
        return fillInQuestionSchema
      case 'spelling':
        return spellingQuestionSchema
      case 'matching':
        return matchingQuestionSchema
      case 'order-words':
        return orderWordsQuestionSchema
      case 'composition':
        return compositionQuestionSchema
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

  const answersFieldArray = useFieldArray({
    control: form.control,
    name: 'answers' as never,
  })

  const pairsFieldArray = useFieldArray({
    control: form.control,
    name: 'pairs' as never,
  })

  const additionalWordsFieldArray = useFieldArray({
    control: form.control,
    name: 'additionalWords' as never,
  })

  const alternativeCorrectAnswersFieldArray = useFieldArray({
    control: form.control,
    name: 'alternativeCorrectAnswers' as never,
  })


  useEffect(() => {
    const values = currentEditingQuestion ? mapQuestionToValues(currentEditingQuestion) : getDefaultValues(quiz.id, quiz.quizType)
    // Ensure type always matches quiz type
    const valuesWithCorrectType = {
      ...values,
      type: getQuestionTypeFromQuizType(quiz.quizType),
    } as QuestionInput
    form.reset(valuesWithCorrectType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEditingQuestion, quiz.id, quiz.quizType])

  // Separate effect to update orderWordsSentence state for order-words questions
  useEffect(() => {
    if (quiz.quizType === 'order-words' && currentEditingQuestion) {
      // Get values from form after reset (more reliable than mapQuestionToValues)
      const formValues = form.getValues() as OrderWordsQuestionFormValues
      // Use correctAnswer if available, otherwise fallback to joining correctOrder
      const correctAnswer = formValues.correctAnswer
      if (correctAnswer && correctAnswer.trim().length > 0) {
        setOrderWordsSentence(correctAnswer)
      } else {
        // Fallback: construct from correctOrder array
        const correctOrder = formValues.correctOrder ?? []
        const sentence = Array.isArray(correctOrder) && correctOrder.length > 0 ? correctOrder.join(' ') : ''
        setOrderWordsSentence(sentence)
      }
    } else if (quiz.quizType === 'order-words' && !currentEditingQuestion) {
      setOrderWordsSentence('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    case 'composition':
      return 'composition'
    default:
      return 'fill-in'
  }
}


  const isFillIn = quiz.quizType === 'fill-in'
  const isSpelling = quiz.quizType === 'spelling'
  const isMatching = quiz.quizType === 'matching'
  const isOrderWords = quiz.quizType === 'order-words'
  const isComposition = quiz.quizType === 'composition'

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
                    <FormLabel>
                      {isFillIn 
                        ? (isPassages 
                            ? 'Passage' 
                            : isLiterature 
                              ? 'Literature Text' 
                              : 'Question with blanks')
                        : 'Question Prompt'}
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={
                          isFillIn 
                            ? (isPassages 
                                ? "e.g., The sun was shining brightly. Sarah walked to the park. She saw many children playing." 
                                : isLiterature
                                  ? "e.g., Once upon a time, in a faraway kingdom, there lived a wise king who loved his people dearly."
                                  : "e.g., The cat sat on the ___")
                            : "Describe the question context..."
                        } 
                        rows={isFillIn ? (isPassagesOrLiterature ? 4 : 2) : 3} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                    {isFillIn && isPassages && (
                      <p className="text-xs text-muted-foreground">
                        Enter the full passage. Students will select answers from multiple choice options below.
                      </p>
                    )}
                    {isFillIn && isLiterature && (
                      <p className="text-xs text-muted-foreground">
                        Enter the full literature text. Students will select answers from multiple choice options below.
                      </p>
                    )}
                    {isComposition && (
                      <p className="text-xs text-muted-foreground">
                        Enter the composition topic or question title. Students will write their answer (100 - 120 words) which will be evaluated by AI.
                      </p>
                    )}
                  </FormItem>
                )}
              />
            </div>

            {isFillIn && (
              <div className="space-y-5 border-t border-border pt-5">
                <div className="flex items-center justify-between">
                  <FormLabel>{isPassagesOrLiterature ? 'Answer Options' : 'Blanks'}</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => blanksFieldArray.append({ id: nanoid(), answer: '', options: [] } as never)}
                  >
                    {isPassagesOrLiterature ? 'Add Answer Option' : 'Add Blank'}
                  </Button>
                </div>
                
                {blanksFieldArray.fields.map((fieldItem, blankIndex) => {
                  const currentOptions = form.watch(`blanks.${blankIndex}.options`) as string[] || []
                  
                  return (
                    <div key={fieldItem.id} className="space-y-4 border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-base font-semibold">
                          {isPassagesOrLiterature ? `Answer Option ${blankIndex + 1}` : `Blank ${blankIndex + 1}`}
                        </FormLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => blanksFieldArray.remove(blankIndex)}
                        >
                          ×
                        </Button>
                      </div>
                      
                      {/* Answer for this blank */}
                      <FormField
                        name={`blanks.${blankIndex}.answer` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {isPassagesOrLiterature 
                                ? `Correct Answer for Option ${blankIndex + 1}` 
                                : `Correct Answer for Blank ${blankIndex + 1}`}
                            </FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter correct answer" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Options for this blank */}
                      <div className="space-y-3 border-t border-border pt-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-sm font-medium">
                            {isPassagesOrLiterature ? 'Multiple Choice Options' : 'Options'}
                          </FormLabel>
                        </div>
                        
                        {/* Comma-separated options input */}
                        <div className="space-y-2">
                          <FormLabel className="text-xs text-muted-foreground">
                            Quick Add Options (comma-separated)
                          </FormLabel>
                          <div className="flex gap-2">
                            <Input
                              placeholder="e.g., cat, dog, bird, fish"
                              value={commaOptionsInputs[blankIndex] || ''}
                              onChange={(e) => {
                                setCommaOptionsInputs(prev => ({
                                  ...prev,
                                  [blankIndex]: e.target.value
                                }))
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleAddCommaOptions(blankIndex)
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddCommaOptions(blankIndex)}
                              disabled={!commaOptionsInputs[blankIndex]?.trim()}
                            >
                              Add Options
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Enter multiple options separated by commas. Extra spaces will be automatically cleaned.
                          </p>
                        </div>
                        
                        {/* Display current options */}
                        <div className="space-y-2">
                          <FormLabel className="text-xs text-muted-foreground">
                            Current Options ({currentOptions.length})
                          </FormLabel>
                          {currentOptions.length > 0 ? (
                            <div className="space-y-2">
                              {currentOptions.map((option, optionIndex) => (
                                <div key={optionIndex} className="flex items-center justify-between bg-muted/50 rounded-md p-2">
                                  <span className="text-sm">{option}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => removeOption(blankIndex, optionIndex)}
                                  >
                                    ×
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              {isPassagesOrLiterature 
                                ? "Add multiple choice options. Students will select from these options."
                                : "No options added. Students will type their answer freely."}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
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
                  name="instructionTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instruction Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Correct the form of the verb:"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                              
                              // Separate words and punctuation
                              const { words, punctuation } = separateWordsAndPunctuation(sentence)
                              
                              // Normalize words to lowercase for storage (but keep original in display)
                              const normalizedWords = words.map(w => w.toLowerCase())
                              
                              // Update form fields
                              field.onChange(normalizedWords)
                              form.setValue('words', normalizedWords)
                              form.setValue('punctuation', punctuation)
                              // Store the complete correct answer exactly as entered
                              form.setValue('correctAnswer', sentence.trim())
                            }}
                            onBlur={() => {
                              // Ensure form is synced on blur
                              const { words, punctuation } = separateWordsAndPunctuation(orderWordsSentence)
                              // Normalize words to lowercase for storage
                              const normalizedWords = words.map(w => w.toLowerCase())
                              field.onChange(normalizedWords)
                              form.setValue('words', normalizedWords)
                              form.setValue('punctuation', punctuation)
                              // Store the complete correct answer exactly as entered
                              form.setValue('correctAnswer', orderWordsSentence.trim())
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <FormLabel>Alternative Correct Answers (Optional)</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => alternativeCorrectAnswersFieldArray.append('' as never)}
                      >
                        Add
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      {alternativeCorrectAnswersFieldArray.fields.map((fieldItem, index) => (
                        <FormField
                          key={fieldItem.id}
                          name={`alternativeCorrectAnswers.${index}` as const}
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel className="text-xs font-semibold uppercase text-muted-foreground">
                                Answer {index + 1}
                              </FormLabel>
                              <div className="flex items-start gap-2">
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    rows={2}
                                    placeholder="Another correct sentence order"
                                  />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => alternativeCorrectAnswersFieldArray.remove(index)}
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

                  <div className="flex items-center justify-between">
                    <FormLabel>Additional Words (Optional)</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => additionalWordsFieldArray.append('')}
                    >
                      Add Word
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {additionalWordsFieldArray.fields.map((fieldItem, index) => (
                      <FormField
                        key={fieldItem.id}
                        name={`additionalWords.${index}` as const}
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-xs font-semibold uppercase text-muted-foreground">
                              Word {index + 1}
                            </FormLabel>
                            <div className="flex items-center gap-2">
                              <FormControl>
                                <Input {...field} placeholder="Additional word" />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => additionalWordsFieldArray.remove(index)}
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
                name="competitionTimerSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Competition timer (seconds)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder={
                          isSpelling
                            ? 'Default: 30 seconds'
                            : isOrderWords
                              ? 'Default: 40 seconds'
                              : isFillIn
                                ? 'Default: 30 seconds'
                                : 'Leave empty to use default'
                        }
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === '') {
                            field.onChange(undefined)
                            return
                          }
                          const value = Number(raw)
                          field.onChange(Number.isNaN(value) ? undefined : Math.max(0, value))
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Used only in competitions. Leave empty to use the default per quiz type.
                    </p>
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

// Helper function to separate words and punctuation from a sentence
function separateWordsAndPunctuation(sentence: string): { words: string[]; punctuation: string[] } {
  if (!sentence.trim()) {
    return { words: [], punctuation: [] }
  }

  // Common punctuation marks (ordered by length to check longer ones first, e.g., "'s" before "'")
  // Note: '[' and ']' are intentionally excluded here as they're used for grouping multi-word phrases
  const punctuationMarks = ["'s", '.', ',', '?', '!', ':', ';', "'", '"', '(', ')', '{', '}']
  
  const words: string[] = []
  const punctuationSet = new Set<string>()
  
  // Step 1: Extract bracketed phrases and replace with placeholders
  // This allows phrases like [her phone] to be treated as single words
  const bracketedPhrases: string[] = []
  let processedSentence = sentence.trim()
  
  // Find all [bracketed text] and replace with unique placeholders
  const bracketRegex = /\[([^\]]+)\]/g
  let match
  let placeholderIndex = 0
  
  while ((match = bracketRegex.exec(sentence)) !== null) {
    const fullMatch = match[0] // e.g., "[her phone]"
    const content = match[1].trim() // e.g., "her phone" (without brackets)
    
    if (content) {
      const placeholder = `__BRACKET_${placeholderIndex}__`
      bracketedPhrases.push(content) // Store "her phone"
      processedSentence = processedSentence.replace(fullMatch, placeholder)
      placeholderIndex++
    }
  }
  
  // Step 2: Split by whitespace
  const parts = processedSentence.split(/\s+/).filter(part => part.length > 0)
  
  // Step 3: Process each part and restore bracketed phrases
  for (const part of parts) {
    // Check if this part is a placeholder for a bracketed phrase
    const placeholderMatch = part.match(/__BRACKET_(\d+)__/)
    if (placeholderMatch) {
      const index = parseInt(placeholderMatch[1], 10)
      if (index < bracketedPhrases.length) {
        // This is a bracketed phrase - add it as a single word
        words.push(bracketedPhrases[index])
      }
      continue
    }
    
    // Check if the entire part is punctuation
    if (punctuationMarks.includes(part)) {
      punctuationSet.add(part)
      continue
    }
    
    // Extract words and punctuation from mixed parts (e.g., "word," or "Sara's")
    let remainingPart = part
    const foundPunctuation: string[] = []
    
    // Check for punctuation at the end (check longer marks first, especially "'s")
    // This handles cases like "Sara's" -> "Sara" + "'s"
    for (const mark of punctuationMarks) {
      if (remainingPart.endsWith(mark)) {
        remainingPart = remainingPart.slice(0, -mark.length)
        foundPunctuation.push(mark)
        break // Only remove one punctuation mark at a time
      }
    }
    
    // Check for punctuation at the beginning
    for (const mark of punctuationMarks) {
      if (remainingPart.startsWith(mark)) {
        remainingPart = remainingPart.slice(mark.length)
        foundPunctuation.push(mark)
        break // Only remove one punctuation mark at a time
      }
    }
    
    // Add word if it's not empty (keep original case for display, but we'll normalize in storage)
    if (remainingPart.trim().length > 0) {
      words.push(remainingPart.trim())
    }
    
    // Add punctuation marks found
    for (const mark of foundPunctuation) {
      punctuationSet.add(mark)
    }
  }
  
  return { words, punctuation: Array.from(punctuationSet) }
}

function getDefaultValues(quizId: string, quizType: Quiz['quizType']): QuestionInput {
  switch (quizType) {
    case 'fill-in':
      return {
        quizId,
        prompt: '',
        blanks: [{ id: nanoid(), answer: '', options: [] }],
        options: [],
        type: 'fill-in',
        order: 1,
        points: 1,
        status: 'active',
        competitionTimerSeconds: undefined,
      }
    case 'spelling':
      return {
        quizId,
        prompt: '',
        answers: [''],
        type: 'spelling',
        order: 1,
        points: 1,
        status: 'active',
        competitionTimerSeconds: undefined,
      }
    case 'composition':
      return {
        quizId,
        prompt: '',
        type: 'composition',
        order: 1,
        points: 1,
        status: 'active',
        competitionTimerSeconds: undefined,
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
        status: 'active',
        competitionTimerSeconds: undefined,
      }
    case 'order-words':
      return {
        quizId,
        prompt: '',
        words: [], // Keep for schema validation, will be synced with correctOrder
        correctOrder: [],
        correctAnswer: '',
        alternativeCorrectAnswers: [],
        instructionTitle: '',
        additionalWords: [],
        punctuation: [],
        type: 'order-words',
        order: 1,
        points: 1,
        status: 'active',
        competitionTimerSeconds: undefined,
      }
    default:
      return {
        quizId,
        prompt: '',
        blanks: [{ id: nanoid(), answer: '', options: [] }],
        options: [],
        type: 'fill-in',
        order: 1,
        points: 1,
        status: 'active',
        competitionTimerSeconds: undefined,
      }
  }
}

function mapQuestionToValues(question: Question): QuestionInput {
  if (question.type === 'fill-in') {
    // Ensure each blank has options array (for backward compatibility, migrate old options to first blank)
    const blanks = question.blanks.length 
      ? question.blanks.map(blank => ({
          ...blank,
          options: blank.options || (blank.id === question.blanks[0]?.id && question.options ? question.options : []),
        }))
      : [{ id: nanoid(), answer: '', options: [] }]
    
    return {
      ...question,
      prompt: question.prompt || question.sentence || '', // Support both prompt and sentence for backward compatibility
      blanks: blanks,
      options: question.options || [], // Keep for backward compatibility
      points: question.points ?? 1,
      order: question.order ?? 1,
      status: question.status ?? 'active',
      competitionTimerSeconds: question.competitionTimerSeconds,
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
      status: question.status ?? 'active',
      competitionTimerSeconds: question.competitionTimerSeconds,
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
      correctAnswer: question.correctAnswer || '',
      // Surface any existing alternative correct sentences to the form
      alternativeCorrectAnswers: question.alternativeCorrectAnswers ?? [],
      instructionTitle: question.instructionTitle || '',
      additionalWords: question.additionalWords || [],
      punctuation: question.punctuation || [],
      points: question.points ?? 1,
      order: questionPositionOrder, // Question position order (number)
      status: question.status ?? 'active',
      competitionTimerSeconds: question.competitionTimerSeconds,
    }
  }

  if (question.type === 'composition') {
    return {
      ...question,
      prompt: question.prompt || '',
      type: 'composition', // Explicitly set type to ensure it matches schema
      points: question.points ?? 1,
      order: question.order ?? 1,
      status: question.status ?? 'active',
      competitionTimerSeconds: question.competitionTimerSeconds,
    }
  }

  return question as QuestionInput
}



