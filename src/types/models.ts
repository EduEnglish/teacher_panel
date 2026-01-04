import type { Timestamp } from 'firebase/firestore'

export type EntityStatus = 'active' | 'inactive'
export type QuizType = 'fill-in' | 'spelling' | 'matching' | 'order-words' | 'composition'
export type LessonType = 'Grammar' | 'Vocabulary' | 'Passages' | 'Literature' | 'Composition'
export type NotificationAudience = 'all' | 'grade' | 'unit' | 'lesson' | 'custom'
export type NotificationStatus = 'draft' | 'scheduled' | 'sent' | 'cancelled'
export type NotificationChannel = 'in-app' | 'email' | 'push'

export interface BaseEntity {
  id: string
  status: EntityStatus
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}

export interface Grade extends Omit<BaseEntity, 'status'> {
  name: string
  description?: string
  isPublished: boolean
  // Legacy field (for backward compatibility with existing Firebase data)
  status?: string
}

export interface Unit extends Omit<BaseEntity, 'status'> {
  gradeId: string
  number: number
  isPublished: boolean
  // Legacy fields (for backward compatibility with existing Firebase data)
  title?: string
  description?: string
  status?: string
}

export interface Lesson extends Omit<BaseEntity, 'status'> {
  gradeId: string
  unitId: string
  title: string
  order: number
}

export interface ListItem {
  english: string
  arabic: string
  imageUrl?: string // Optional image URL from Firebase Storage
  pronunciation?: string // Optional pronunciation guide for TTS (e.g., "reed" for "read")
}

export interface SectionList {
  items: ListItem[]
}

export interface Section extends Omit<BaseEntity, 'status'> {
  gradeId: string
  unitId: string
  lessonId: string
  title: string
  description?: string
  videoLink?: string // Optional YouTube video link
  lists?: SectionList // Optional list with items
}

export interface Quiz extends Omit<BaseEntity, 'status'> {
  gradeId: string
  unitId: string
  lessonId: string
  sectionId: string
  title: string
  description?: string
  quizType: QuizType
  isPublished: boolean
  aiEvaluationPrompt?: string // Optional additional prompt/instructions for AI evaluation (composition quizzes only)
}

export type QuestionOption = {
  id: string
  text: string
}

export interface QuestionBase extends BaseEntity {
  quizId: string
  prompt: string
  explanation?: string
  order: number
  difficulty?: 'easy' | 'medium' | 'hard'
  points: number // Required points field (defaults to 1)
}

export interface FillInQuestion extends QuestionBase {
  type: 'fill-in'
  blanks: Array<{ id: string; answer: string; options?: string[] }> // Each blank has its own answer and options
  sentence?: string // Optional for backward compatibility, use prompt instead
  options?: string[] // Optional multiple choice options (for backward compatibility)
}

export interface SpellingQuestion extends QuestionBase {
  type: 'spelling'
  answers: string[] // Array of answers (can have multiple)
}

export interface MatchingQuestion extends QuestionBase {
  type: 'matching'
  pairs: Array<{ id: string; left: string; right: string }>
}

export interface OrderWordsQuestion extends QuestionBase {
  type: 'order-words'
  words: string[]
  correctOrder: string[]
  correctAnswer?: string // Complete correct answer sentence exactly as entered (e.g., "This is Sara's book")
  instructionTitle?: string // Optional instruction text displayed above the question in mobile app
  additionalWords?: string[] // Additional words to mix with correct answer words for distraction
  punctuation?: string[] // Punctuation marks separated from words
}

export interface CompositionQuestion extends QuestionBase {
  type: 'composition'
  // For composition, prompt is the question/topic title
  // No answers needed - evaluated by AI
}

export type Question = FillInQuestion | SpellingQuestion | MatchingQuestion | OrderWordsQuestion | CompositionQuestion

export interface PracticeAggregate extends BaseEntity {
  gradeId?: string
  unitId?: string
  lessonId?: string
  sectionId?: string
  quizId?: string
  attempts: number
  correct: number
  totalTimeSeconds?: number
  accuracy?: number
  quizType?: QuizType
}

export interface AdminProfile extends BaseEntity {
  name: string
  email: string
}

export interface AdminActionLog extends BaseEntity {
  adminId: string
  action: 'create' | 'update' | 'delete'
  entity: string
  entityId: string
  metadata?: Record<string, unknown>
  timestamp?: Timestamp | null
}

export interface Notification extends BaseEntity {
  title: string
  message: string
  audienceType: NotificationAudience
  audienceValue?: string
  channels: NotificationChannel[]
  scheduledAt?: Timestamp | null
  sentAt?: Timestamp | null
  createdBy: string
  metadata?: Record<string, unknown>
  deliveryStatus: NotificationStatus
  deliveryProcessed?: boolean
}

export interface Student extends BaseEntity {
  name: string
  email?: string
  gradeId?: string
  photoURL?: string
  enrolledAt?: Timestamp | null
  lastActiveAt?: Timestamp | null
}

export interface StudentPerformance {
  studentId: string
  studentName: string
  gradeId?: string
  gradeName?: string
  totalAttempts: number
  totalCorrect: number
  averageAccuracy: number
  quizzesCompleted: number
  lastActivityAt?: Timestamp | null
}

export interface CurriculumCounts {
  grades: number
  units: number
  lessons: number
  sections: number
  quizzes: number
  practices: number
  averageAccuracy: number
  mostPracticedUnit?: string
  mostChallengingLesson?: string
}


