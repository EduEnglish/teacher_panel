import type { Timestamp } from 'firebase/firestore'

export type EntityStatus = 'active' | 'inactive'
export type QuizType = 'fill-in' | 'spelling' | 'matching' | 'order-words'
export type LessonType = 'Grammar' | 'Vocabulary' | 'Reading' | 'Listening'
export type SpecialLessonType = 'Revision' | 'Assessment' | 'Mixed Practice'

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

export interface SpecialLesson extends BaseEntity {
  gradeId: string
  title: string
  lessonType: SpecialLessonType
  sourceUnitIds: string[]
  linkedQuizIds: string[]
  description?: string
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

export interface AnalyticsSnapshot {
  totalExercises: number
  averageAccuracy: number
  mostPracticedUnit?: string
  mostChallengingLesson?: string
}

export interface LessonAnalyticsRow {
  lessonId: string
  lessonTitle: string
  attempts: number
  accuracy: number
}

export interface AdminProfile extends BaseEntity {
  name: string
  email: string
  logoUrl?: string
  logoStoragePath?: string
  analyticsEnabled: boolean
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


