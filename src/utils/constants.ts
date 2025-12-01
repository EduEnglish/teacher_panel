import { BarChart3, BellRing, BookOpenCheck, Settings, Users } from 'lucide-react'

export const navigationLinks = [
  {
    label: 'Dashboard',
    icon: BarChart3,
    to: '/dashboard',
  },
  {
    label: 'Curriculum',
    icon: BookOpenCheck,
    to: '/curriculum',
    children: [
      { label: 'Grades', to: '/curriculum/grades' },
      { label: 'Units', to: '/curriculum/units' },
      { label: 'Lessons', to: '/curriculum/lessons' },
      { label: 'Sections', to: '/curriculum/sections' },
      { label: 'Quizzes', to: '/curriculum/quizzes' },
      { label: 'Questions', to: '/curriculum/questions' },
    ],
  },
  {
    label: 'Students',
    icon: Users,
    to: '/students',
  },
  {
    label: 'Notifications',
    icon: BellRing,
    to: '/notifications',
  },
  {
    label: 'Settings',
    icon: Settings,
    to: '/settings',
  },
]

export const lessonTypeOptions = ['Grammar', 'Vocabulary', 'Reading', 'Listening'] as const

export const lessonTitleOptions = [
  'Grammar',
  'Matching',
  'Fill in the blanks',
  'Spelling',
  'Listening',
  'Reading',
] as const

export const quizTypeOptions = [
  { value: 'fill-in', label: 'Fill in the Blanks' },
  { value: 'spelling', label: 'Spelling' },
  { value: 'matching', label: 'Matching' },
  { value: 'order-words', label: 'Order Words' },
] as const

export const notificationAudienceOptions = [
  { value: 'all', label: 'All students' },
  { value: 'grade', label: 'Specific grade' },
  { value: 'unit', label: 'Specific unit' },
  { value: 'lesson', label: 'Specific lesson' },
  { value: 'custom', label: 'Custom segment' },
] as const

export const notificationChannelOptions = [
  { value: 'in-app', label: 'In-app banner' },
  { value: 'email', label: 'Email' },
  { value: 'push', label: 'Push notification' },
] as const

export const notificationStatusBadges: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  scheduled: { label: 'Scheduled', variant: 'outline' },
  sent: { label: 'Sent', variant: 'default' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
}

export const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const



