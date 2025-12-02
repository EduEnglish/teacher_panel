import { z } from 'zod'

// const lessonTypes = ['Grammar', 'Vocabulary', 'Reading', 'Listening'] as const
const quizTypes = ['fill-in', 'spelling', 'matching', 'order-words'] as const
const notificationAudienceTypes = ['all', 'grade', 'unit', 'lesson', 'custom'] as const
const notificationChannels = ['in-app', 'email', 'push'] as const
const notificationStatuses = ['draft', 'scheduled', 'sent', 'cancelled'] as const

export const statusSchema = z.enum(['active', 'inactive'] as const)

export const gradeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Grade name must be at least 2 characters'),
  description: z.string().max(30, 'Description must be at most 30 characters').optional().or(z.literal('')),
})

export const unitSchema = z.object({
  id: z.string().optional(),
  gradeId: z.string().min(1, 'Grade is required'),
  number: z.number().min(1, 'Unit number must be greater than zero'),
  isPublished: z.boolean().default(false),
})

const lessonTitleOptions = ['Grammar', 'Matching', 'Fill in the blanks', 'Spelling', 'Listening', 'Reading'] as const

export const lessonSchema = z.object({
  id: z.string().optional(),
  gradeId: z.string().min(1, 'Grade is required'),
  unitId: z.string().min(1, 'Unit is required'),
  title: z.enum(lessonTitleOptions, {
    message: 'Please select a lesson title',
  }),
  order: z.number().min(1, 'Order must be greater than zero'),
  isPublished: z.boolean().default(false),
})

export const sectionSchema = z.object({
  id: z.string().optional(),
  gradeId: z.string().min(1, 'Grade is required'),
  unitId: z.string().min(1, 'Unit is required'),
  lessonId: z.string().min(1, 'Lesson is required'),
  title: z.string().min(2, 'Section title must be at least 2 characters'),
  isPublished: z.boolean().default(false),
})

export const quizSchema = z.object({
  id: z.string().optional(),
  gradeId: z.string().min(1, 'Grade is required'),
  unitId: z.string().min(1, 'Unit is required'),
  lessonId: z.string().min(1, 'Lesson is required'),
  sectionId: z.string().min(1, 'Section is required'),
  title: z.string().min(2, 'Quiz title must be at least 2 characters'),
  quizType: z.enum(quizTypes),
  isPublished: z.boolean().default(false),
})

export const fillInQuestionSchema = z.object({
  id: z.string().optional(),
  quizId: z.string().min(1, 'Quiz is required'),
  prompt: z.string().min(5, 'Prompt must be descriptive. Enter the question with blanks using ___'),
  blanks: z
    .array(
      z.object({
        id: z.string(),
        answer: z.string().min(1, 'Answer required'),
      }),
    )
    .min(1, 'At least one blank is required'),
  options: z.array(z.string().min(1, 'Option cannot be empty')).optional(),
  type: z.literal('fill-in'),
  order: z.number().min(1),
  points: z.number().min(1, 'Points must be at least 1').default(1),
  isPublished: z.boolean().default(false),
  status: statusSchema.default('active'),
})

export const spellingQuestionSchema = z.object({
  id: z.string().optional(),
  quizId: z.string().min(1, 'Quiz is required'),
  prompt: z.string().min(3),
  answers: z.array(z.string().min(1, 'Answer cannot be empty')).min(1, 'At least one answer is required'),
  type: z.literal('spelling'),
  order: z.number().min(1),
  points: z.number().min(1, 'Points must be at least 1').default(1),
  isPublished: z.boolean().default(false),
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
  points: z.number().min(1, 'Points must be at least 1').default(1),
  isPublished: z.boolean().default(false),
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
  points: z.number().min(1, 'Points must be at least 1').default(1),
  isPublished: z.boolean().default(false),
  status: statusSchema.default('active'),
})

export const adminSettingsSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  email: z.string().email(),
  status: statusSchema.default('active'),
})

export const notificationSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, 'Notification title must be at least 3 characters'),
  message: z.string().min(10, 'Provide more context in the message'),
  audienceType: z.enum(notificationAudienceTypes),
  audienceValue: z.string().optional(),
  channels: z.array(z.enum(notificationChannels)).min(1, 'Select at least one channel'),
  deliveryStatus: z.enum(notificationStatuses).default('draft'),
  scheduledAt: z
    .preprocess((value) => {
      if (!value) return undefined
      if (value instanceof Date) return value
      if (typeof value === 'string') {
        const parsed = new Date(value)
        return Number.isNaN(parsed.getTime()) ? undefined : parsed
      }
      return value
    }, z.date())
    .optional(),
  status: statusSchema.default('active'),
  deliveryProcessed: z.boolean().optional(),
}).superRefine((values, ctx) => {
  if (values.audienceType !== 'all' && !values.audienceValue?.trim()) {
    ctx.addIssue({
      path: ['audienceValue'],
      code: z.ZodIssueCode.custom,
      message: 'Provide a target for the selected audience.',
    })
  }

  if (values.deliveryStatus === 'scheduled' && !values.scheduledAt) {
    ctx.addIssue({
      path: ['scheduledAt'],
      code: z.ZodIssueCode.custom,
      message: 'Select a schedule time for scheduled notifications.',
    })
  }

  if (values.deliveryStatus !== 'scheduled' && values.scheduledAt) {
    ctx.addIssue({
      path: ['scheduledAt'],
      code: z.ZodIssueCode.custom,
      message: 'Remove the scheduled date or update the status to scheduled.',
    })
  }
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
export type NotificationFormValues = z.infer<typeof notificationSchema>


