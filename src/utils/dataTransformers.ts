/**
 * Data Transformers
 * Transform teacher panel data formats to student app compatible formats
 * Based on exact structure from mobile app mock data
 */

import type {
  FillInQuestion,
  MatchingQuestion,
  OrderWordsQuestion,
  CompositionQuestion,
  Question,
  Quiz,
  SpellingQuestion,
} from '@/types/models'
import { mapToStudentQuizType, type StudentQuizType } from './quizTypeMapper'

/**
 * Student App Question Format (exact match from quizzes.json)
 */
export interface StudentAppQuestion {
  id: string
  prompt: string
  type: 'fill_blank' | 'spelling' | 'matching' | 'order_words' | 'composition'
  options?: string[] // Optional, for fill_blank multiple choice (for backward compatibility)
  blankOptions?: string[][] // Per-blank options: blankOptions[0] = options for blank 1, blankOptions[1] = options for blank 2, etc.
  answers: string[] // Array of answers
  pairs?: Record<string, string> // For matching type
  order?: string[] // For order_words type - words only (without punctuation)
  correctAnswer?: string // For order_words type - complete correct answer sentence exactly as entered
  instructionTitle?: string // For order_words type - instruction text displayed above question
  additionalWords?: string[] // For order_words type - additional words mixed with correct answer
  punctuation?: string[] // For order_words type - punctuation marks separated from words
  hint?: string
  points: number
}

/**
 * Transform Fill-in question to student app format
 * Teacher: { prompt (with blanks), blanks: [{id, answer}] }
 * Student: { prompt: prompt (with blanks), answers: ["word1", "word2"] }
 */
function transformFillInQuestion(question: FillInQuestion): StudentAppQuestion {
  // Extract answers from blanks array - in order
  const answers = question.blanks.map((blank) => blank.answer.trim()).filter(Boolean)

  // Extract per-blank options
  const blankOptions = question.blanks.map((blank) => blank.options || [])

  // Use prompt directly (backward compatibility: use sentence if prompt is empty)
  const studentPrompt = question.prompt?.trim() || (question as any).sentence?.trim() || ''

  return {
    id: question.id,
    prompt: studentPrompt,
    type: 'fill_blank',
    options: undefined, // No longer using global options - only blankOptions
    blankOptions: blankOptions.length > 0 ? blankOptions : undefined, // Per-blank options
    answers: answers,
    pairs: undefined,
    order: undefined,
    hint: question.explanation,
    points: question.points ?? 1,
  }
}

/**
 * Transform Spelling question to student app format
 * Teacher: { answers: ["word1", "word2"] }
 * Student: { answers: ["word1", "word2"] }
 */
function transformSpellingQuestion(question: SpellingQuestion): StudentAppQuestion {
  // Handle both array format and single answer (backward compatibility)
  const questionWithAnswer = question as SpellingQuestion & { answer?: string }
  const answers = Array.isArray(question.answers)
    ? question.answers.map((a) => a.trim()).filter(Boolean)
    : questionWithAnswer.answer
      ? [questionWithAnswer.answer.trim()]
      : []
  
  return {
    id: question.id,
    prompt: question.prompt,
    type: 'spelling',
    answers: answers,
    pairs: undefined,
    order: undefined,
    hint: question.explanation,
    points: question.points ?? 1,
  }
}

/**
 * Transform Matching question to student app format
 * Teacher: { pairs: [{id, left, right}] }
 * Student: { pairs: {left: right, left: right} }
 */
function transformMatchingQuestion(question: MatchingQuestion): StudentAppQuestion {
  // Convert pairs array to object/map
  const pairs: Record<string, string> = {}
  question.pairs.forEach((pair) => {
    if (pair.left && pair.right) {
      pairs[pair.left.trim()] = pair.right.trim()
    }
  })

  return {
    id: question.id,
    prompt: question.prompt,
    type: 'matching',
    answers: [],
    pairs: pairs,
    order: undefined,
    hint: question.explanation,
    points: question.points ?? 1,
  }
}

/**
 * Transform Order Words question to student app format
 * Teacher: { words: [], correctOrder: [] }
 * Student: { order: [] }
 */
function transformOrderWordsQuestion(question: OrderWordsQuestion): StudentAppQuestion {
  return {
    id: question.id,
    prompt: question.prompt,
    type: 'order_words',
    answers: [],
    pairs: undefined,
    order: question.correctOrder ?? question.words ?? [],
    correctAnswer: question.correctAnswer,
    instructionTitle: question.instructionTitle,
    additionalWords: question.additionalWords,
    punctuation: question.punctuation,
    hint: question.explanation,
    points: question.points ?? 1,
  }
}

/**
 * Transform Composition question to student app format
 * Teacher: { prompt: "Question title" }
 * Student: { prompt: "Question title", answers: [] }
 */
function transformCompositionQuestion(question: CompositionQuestion): StudentAppQuestion {
  return {
    id: question.id,
    prompt: question.prompt,
    type: 'composition',
    answers: [], // No predefined answers - evaluated by AI
    pairs: undefined,
    order: undefined,
    hint: question.explanation,
    points: question.points ?? 1,
  }
}

/**
 * Transform teacher panel question to student app format
 */
export function transformQuestion(question: Question): StudentAppQuestion {
  switch (question.type) {
    case 'fill-in':
      return transformFillInQuestion(question)
    case 'spelling':
      return transformSpellingQuestion(question)
    case 'matching':
      return transformMatchingQuestion(question)
    case 'order-words':
      return transformOrderWordsQuestion(question)
    case 'composition':
      return transformCompositionQuestion(question)
    default: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const questionType = (question as any).type
      throw new Error(`Unknown question type: ${questionType}`)
    }
  }
}

/**
 * Transform quiz with embedded questions to student app format
 * Matches exact structure from quizzes.json
 */
export function transformQuizToStudentFormat(
  quiz: Quiz,
  questions: Question[],
): {
  id: string
  sectionId: string
  title: string
  type: StudentQuizType
  description: string
  durationMinutes: number
  totalPoints: number
  questions: StudentAppQuestion[]
} {
  // Sort questions by order
  const sortedQuestions = [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // Transform all questions
  const transformedQuestions = sortedQuestions.map(transformQuestion)

  // Calculate total points
  const totalPoints = transformedQuestions.reduce((sum, q) => sum + q.points, 0)

  // Map quiz type
  const studentQuizType = mapToStudentQuizType(quiz.quizType)

  return {
    id: quiz.id,
    sectionId: quiz.sectionId,
    title: quiz.title,
    type: studentQuizType,
    description: '', // Description removed from form, always empty
    durationMinutes: 10, // Default 10 minutes (removed from form)
    totalPoints: totalPoints,
    questions: transformedQuestions,
  }
}

/**
 * Prepare quiz document for Firestore (exact student app format)
 * This is what gets written to Firestore and read by mobile app
 */
export function prepareQuizDocumentForFirestore(
  quiz: Quiz,
  questions: Question[],
): Record<string, unknown> {
  const studentFormat = transformQuizToStudentFormat(quiz, questions)

  // Return exact format from quizzes.json
  return {
    id: studentFormat.id,
    sectionId: studentFormat.sectionId,
    title: studentFormat.title,
    type: studentFormat.type, // Student app uses 'type', not 'quizType'
    description: studentFormat.description,
    durationMinutes: studentFormat.durationMinutes,
    totalPoints: studentFormat.totalPoints,
    questions: studentFormat.questions.map((q) => {
      // Build question object exactly as in quizzes.json
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const questionObj: any = {
        id: q.id,
        prompt: q.prompt,
        type: q.type,
        points: q.points,
      }

      // Add type-specific fields
      if (q.type === 'fill_blank') {
        // Only save blankOptions, not global options
        if (q.blankOptions && q.blankOptions.length > 0) {
          // Convert nested array to object format for Firestore compatibility
          // Firestore doesn't support nested arrays, so we use an object with numeric keys
          const blankOptionsObj: Record<string, string[]> = {}
          q.blankOptions.forEach((opts, index) => {
            if (opts.length > 0) {
              blankOptionsObj[String(index)] = opts
            }
          })
          if (Object.keys(blankOptionsObj).length > 0) {
            questionObj.blankOptions = blankOptionsObj
          }
        }
        questionObj.answers = q.answers
      } else if (q.type === 'spelling') {
        questionObj.answers = q.answers
      } else if (q.type === 'matching') {
        questionObj.pairs = q.pairs
      } else if (q.type === 'order_words') {
        questionObj.order = q.order
        if (q.correctAnswer) {
          questionObj.correctAnswer = q.correctAnswer
        }
        if (q.instructionTitle) {
          questionObj.instructionTitle = q.instructionTitle
        }
        if (q.additionalWords && q.additionalWords.length > 0) {
          questionObj.additionalWords = q.additionalWords
        }
        if (q.punctuation && q.punctuation.length > 0) {
          questionObj.punctuation = q.punctuation
        }
      }

      // Add hint if present
      if (q.hint) {
        questionObj.hint = q.hint
      }

      return questionObj
    }),
  }
}

