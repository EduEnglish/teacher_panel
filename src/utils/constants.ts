import { BarChart3, BookOpenCheck, LibraryBig, LineChart, Settings } from 'lucide-react'

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
      { label: 'Special Lessons', to: '/curriculum/special-lessons' },
    ],
  },
  {
    label: 'Analytics',
    icon: LineChart,
    to: '/analytics',
  },
  {
    label: 'Resources',
    icon: LibraryBig,
    to: '/resources',
    disabled: true,
  },
  {
    label: 'Settings',
    icon: Settings,
    to: '/settings',
  },
]

export const lessonTypeOptions = ['Grammar', 'Vocabulary', 'Reading', 'Listening'] as const

export const quizTypeOptions = [
  { value: 'fill-in', label: 'Fill in the Blanks' },
  { value: 'spelling', label: 'Spelling' },
  { value: 'matching', label: 'Matching' },
  { value: 'order-words', label: 'Order Words' },
] as const

export const specialLessonTypeOptions = [
  { value: 'Revision', label: 'Revision' },
  { value: 'Assessment', label: 'Assessment' },
  { value: 'Mixed Practice', label: 'Mixed Practice' },
] as const

export const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const

export const defaultWeaknessThreshold = 60


