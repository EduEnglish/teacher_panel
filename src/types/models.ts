import type { Timestamp } from 'firebase/firestore'

export type EntityStatus = 'active' | 'inactive'
export type QuizType = 'fill-in' | 'spelling' | 'matching' | 'order-words'
export type LessonType = 'Grammar' | 'Vocabulary' | 'Reading' | 'Listening'
export type NotificationAudience = 'all' | 'grade' | 'unit' | 'lesson' | 'custom'
export type NotificationStatus = 'draft' | 'scheduled' | 'sent' | 'cancelled'
export type NotificationChannel = 'in-app' | 'email' | 'push'

export interface BaseEntity {
  id: string
  status: EntityStatus
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}

export interface Grade extends BaseEntity {
  name: string
  description?: string
}

export interface Unit extends BaseEntity {
  gradeId: string
  number: number
  title: string
  description?: string
}

export interface Lesson extends BaseEntity {
  gradeId: string
  unitId: string
  title: string
  type: LessonType
  description?: string
  order: number
}

export interface Section extends BaseEntity {
  gradeId: string
  unitId: string
  lessonId: string
  title: string
  quizType: QuizType
  description?: string
}

export interface Quiz extends BaseEntity {
  gradeId: string
  unitId: string
  lessonId: string
  sectionId: string
  title: string
  description?: string
  quizType: QuizType
  isPublished: boolean
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
}

export interface FillInQuestion extends QuestionBase {
  type: 'fill-in'
  blanks: Array<{ id: string; answer: string }>
  sentence: string
}

export interface SpellingQuestion extends QuestionBase {
  type: 'spelling'
  answer: string
}

export interface MatchingQuestion extends QuestionBase {
  type: 'matching'
  pairs: Array<{ id: string; left: string; right: string }>
}

export interface OrderWordsQuestion extends QuestionBase {
  type: 'order-words'
  words: string[]
  correctOrder: string[]
}

export type Question = FillInQuestion | SpellingQuestion | MatchingQuestion | OrderWordsQuestion

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
  logoUrl?: string
  logoStoragePath?: string
  weaknessThreshold: number
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


