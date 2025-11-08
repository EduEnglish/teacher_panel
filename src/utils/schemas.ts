import { z } from 'zod'

const lessonTypes = ['Grammar', 'Vocabulary', 'Reading', 'Listening'] as const
const quizTypes = ['fill-in', 'spelling', 'matching', 'order-words'] as const

export const statusSchema = z.enum(['active', 'inactive'] as const)

export const gradeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Grade name must be at least 2 characters'),
  description: z.string().max(200).optional().or(z.literal('')),
  status: statusSchema.default('active'),
})

export const unitSchema = z.object({
  id: z.string().optional(),
  gradeId: z.string().min(1, 'Grade is required'),
  number: z.number().min(1, 'Unit number must be greater than zero'),
  title: z.string().min(2, 'Unit title must be at least 2 characters'),
  description: z.string().max(300).optional().or(z.literal('')),
  status: statusSchema.default('active'),
})

export const lessonSchema = z.object({
  id: z.string().optional(),
  gradeId: z.string().min(1, 'Grade is required'),
  unitId: z.string().min(1, 'Unit is required'),
  title: z.string().min(2, 'Lesson title must be at least 2 characters'),
  type: z.enum(lessonTypes),
  description: z.string().max(400).optional().or(z.literal('')),
  order: z.number().min(1, 'Order must be greater than zero'),
  status: statusSchema.default('active'),
})

export const sectionSchema = z.object({
  id: z.string().optional(),
  gradeId: z.string().min(1, 'Grade is required'),
  unitId: z.string().min(1, 'Unit is required'),
  lessonId: z.string().min(1, 'Lesson is required'),
  title: z.string().min(2, 'Section title must be at least 2 characters'),
  description: z.string().max(400).optional().or(z.literal('')),
  quizType: z.enum(quizTypes),
  status: statusSchema.default('active'),
})

export const quizSchema = z.object({
  id: z.string().optional(),
  gradeId: z.string().min(1, 'Grade is required'),
  unitId: z.string().min(1, 'Unit is required'),
  lessonId: z.string().min(1, 'Lesson is required'),
  sectionId: z.string().min(1, 'Section is required'),
  title: z.string().min(2, 'Quiz title must be at least 2 characters'),
  description: z.string().max(400).optional().or(z.literal('')),
  quizType: z.enum(quizTypes),
  isPublished: z.boolean().default(false),
  status: statusSchema.default('active'),
})

export const fillInQuestionSchema = z.object({
  id: z.string().optional(),
  quizId: z.string().min(1, 'Quiz is required'),
  prompt: z.string().min(5, 'Prompt must be descriptive'),
  sentence: z.string().min(5, 'Sentence is required'),
  blanks: z
    .array(
      z.object({
        id: z.string(),
        answer: z.string().min(1, 'Answer required'),
      }),
    )
    .min(1, 'At least one blank is required'),
  type: z.literal('fill-in'),
  order: z.number().min(1),
  status: statusSchema.default('active'),
})

export const spellingQuestionSchema = z.object({
  id: z.string().optional(),
  quizId: z.string().min(1, 'Quiz is required'),
  prompt: z.string().min(3),
  answer: z.string().min(1),
  type: z.literal('spelling'),
  order: z.number().min(1),
  status: statusSchema.default('active'),
})

export const matchingQuestionSchema = z.object({
  id: z.string().optional(),
  quizId: z.string().min(1, 'Quiz is required'),
  prompt: z.string().min(3),
  pairs: z
    .array(
      z.object({
        id: z.string(),
        left: z.string().min(1),
        right: z.string().min(1),
      }),
    )
    .min(2, 'Add at least two pairs'),
  type: z.literal('matching'),
  order: z.number().min(1),
  status: statusSchema.default('active'),
})

export const orderWordsQuestionSchema = z.object({
  id: z.string().optional(),
  quizId: z.string().min(1, 'Quiz is required'),
  prompt: z.string().min(3),
  words: z.array(z.string().min(1)).min(2, 'Add at least two words'),
  correctOrder: z.array(z.string().min(1)).min(2, 'Provide the correct order'),
  type: z.literal('order-words'),
  order: z.number().min(1),
  status: statusSchema.default('active'),
})

export const adminSettingsSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  email: z.string().email(),
  logoUrl: z.string().url().optional(),
  logoStoragePath: z.string().optional(),
  analyticsEnabled: z.boolean(),
  weaknessThreshold: z.number().min(0).max(100),
  status: statusSchema.default('active'),
})

export const specialLessonSchema = z.object({
  id: z.string().optional(),
  gradeId: z.string().min(1, 'Grade is required'),
  lessonType: z.enum(['Revision', 'Assessment', 'Mixed Practice']),
  title: z.string().min(2, 'Title must be at least 2 characters'),
  sourceUnitIds: z.array(z.string().min(1)).min(1, 'Select at least one unit'),
  linkedQuizIds: z.array(z.string().min(1)).min(1, 'Select at least one quiz'),
  description: z.string().max(400).optional().or(z.literal('')),
  status: statusSchema.default('active'),
})

export type GradeFormValues = z.infer<typeof gradeSchema>
export type UnitFormValues = z.infer<typeof unitSchema>
export type LessonFormValues = z.infer<typeof lessonSchema>
export type SectionFormValues = z.infer<typeof sectionSchema>
export type QuizFormValues = z.infer<typeof quizSchema>
export type FillInQuestionFormValues = z.infer<typeof fillInQuestionSchema>
export type SpellingQuestionFormValues = z.infer<typeof spellingQuestionSchema>
export type MatchingQuestionFormValues = z.infer<typeof matchingQuestionSchema>
export type OrderWordsQuestionFormValues = z.infer<typeof orderWordsQuestionSchema>
export type AdminSettingsFormValues = z.infer<typeof adminSettingsSchema>
export type SpecialLessonFormValues = z.infer<typeof specialLessonSchema>


