/**
 * Data Transformers
 * Transform teacher panel data formats to student app compatible formats
 * Based on exact structure from mobile app mock data
 */

import type {
  FillInQuestion,
  MatchingQuestion,
  OrderWordsQuestion,
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
  type: 'fill_blank' | 'spelling' | 'matching' | 'order_words'
  options?: string[] // Optional, for fill_blank multiple choice
  answers: string[] // Array of answers
  pairs?: Record<string, string> // For matching type
  order?: string[] // For order_words type
  hint?: string
  points: number
}

/**
 * Transform Fill-in question to student app format
 * Teacher: { sentence, blanks: [{id, answer}] }
 * Student: { answers: ["word1", "word2"] }
 */
function transformFillInQuestion(question: FillInQuestion): StudentAppQuestion {
  // Extract answers from blanks array - in order
  const answers = question.blanks.map((blank) => blank.answer.trim()).filter(Boolean)

  // Options are optional in student app (for multiple choice)
  // If teacher panel has options, include them
  const options = question.options || []

  return {
    id: question.id,
    prompt: question.prompt,
    type: 'fill_blank',
    options: options.length > 0 ? options : undefined,
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
        if (q.options && q.options.length > 0) {
          questionObj.options = q.options
        }
        questionObj.answers = q.answers
      } else if (q.type === 'spelling') {
        questionObj.answers = q.answers
      } else if (q.type === 'matching') {
        questionObj.pairs = q.pairs
      } else if (q.type === 'order_words') {
        questionObj.order = q.order
      }

      // Add hint if present
      if (q.hint) {
        questionObj.hint = q.hint
      }

      return questionObj
    }),
  }
}

