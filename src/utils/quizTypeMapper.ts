/**
 * Quiz Type Mapper
 * Maps teacher panel quiz types to student app quiz types
 * Student app uses: fill_blank, spelling, matching, order_words
 * Teacher panel uses: fill-in, spelling, matching, order-words
 */

export type TeacherQuizType = 'fill-in' | 'spelling' | 'matching' | 'order-words' | 'composition'
export type StudentQuizType = 'fill_blank' | 'spelling' | 'matching' | 'order_words' | 'composition'

/**
 * Maps teacher panel quiz type to student app quiz type
 */
export function mapToStudentQuizType(teacherType: TeacherQuizType): StudentQuizType {
  const mapping: Record<TeacherQuizType, StudentQuizType> = {
    'fill-in': 'fill_blank',
    'spelling': 'spelling',
    'matching': 'matching',
    'order-words': 'order_words',
    'composition': 'composition',
  }
  return mapping[teacherType] ?? 'fill_blank'
}

/**
 * Maps student app quiz type to teacher panel quiz type
 */
export function mapToTeacherQuizType(studentType: string): TeacherQuizType {
  const mapping: Record<string, TeacherQuizType> = {
    'fill_blank': 'fill-in',
    'fill-in': 'fill-in',
    'spelling': 'spelling',
    'matching': 'matching',
    'order_words': 'order-words',
    'order-words': 'order-words',
    'composition': 'composition',
  }
  return mapping[studentType] ?? 'fill-in'
}

/**
 * Validates if quiz type is valid for student app
 */
export function isValidStudentQuizType(type: string): type is StudentQuizType {
  return ['fill_blank', 'spelling', 'matching', 'order_words', 'composition'].includes(type)
}

