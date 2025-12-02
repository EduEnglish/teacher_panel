/**
 * Quiz Builder Service
 * Handles quiz creation with embedded questions (student app compatible)
 * Questions are embedded in quiz document exactly as in quizzes.json
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { firestore } from './firebase'
import type { Quiz, Question } from '@/types/models'
import { prepareQuizDocumentForFirestore } from '@/utils/dataTransformers'
import { mapToTeacherQuizType } from '@/utils/quizTypeMapper'
import { logAdminAction } from './firebase'

/**
 * Create quiz with embedded questions
 * Questions are embedded in the quiz document (student app format)
 * Path: grades/{gradeId}/units/{unitId}/lessons/{lessonId}/sections/{sectionId}/quizzes/{quizId}
 */
export async function createQuizWithQuestions(
  quiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>,
  questions: Omit<Question, 'id' | 'createdAt' | 'updatedAt' | 'quizId'>[],
  adminId: string,
): Promise<Quiz> {
  // Create quiz document reference in nested structure
  const quizzesRef = collection(
    firestore,
    'grades',
    quiz.gradeId,
    'units',
    quiz.unitId,
    'lessons',
    quiz.lessonId,
    'sections',
    quiz.sectionId,
    'quizzes',
  )
  const quizDocRef = doc(quizzesRef)

  // Create quiz object with ID
  const quizWithId: Quiz = {
    ...quiz,
    id: quizDocRef.id,
    createdAt: null,
    updatedAt: null,
  }

  // Transform questions to include quizId and generate IDs
  const questionsWithIds: Question[] = questions.map((q, index) => ({
    ...q,
    id: `${quizDocRef.id}_q${index + 1}`,
    quizId: quizDocRef.id,
    order: q.order ?? index + 1,
    isPublished: q.isPublished ?? false,
    createdAt: null,
    updatedAt: null,
  } as Question))

  // Prepare document in student app format (exact match to quizzes.json)
  const firestoreDoc = prepareQuizDocumentForFirestore(quizWithId, questionsWithIds)

  // Add timestamps (these won't be in student app format, but needed for teacher panel)
  firestoreDoc.createdAt = serverTimestamp()
  firestoreDoc.updatedAt = serverTimestamp()

  // Add teacher panel metadata (won't affect student app)
  firestoreDoc.gradeId = quiz.gradeId
  firestoreDoc.unitId = quiz.unitId
  firestoreDoc.lessonId = quiz.lessonId
  firestoreDoc.quizType = quiz.quizType // Preserve teacher panel quiz type
  firestoreDoc.isPublished = quiz.isPublished

  // Write to Firestore
  await setDoc(quizDocRef, firestoreDoc)

  // Log admin action
  await logAdminAction({
    adminId,
    action: 'create',
    entity: 'quizzes',
    entityId: quizDocRef.id,
    metadata: {
      title: quiz.title,
      questionCount: questions.length,
    },
  })

  return quizWithId
}

/**
 * Update quiz with embedded questions
 */
export async function updateQuizWithQuestions(
  gradeId: string,
  unitId: string,
  lessonId: string,
  sectionId: string,
  quizId: string,
  quizUpdates: Partial<Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>>,
  questions: Omit<Question, 'id' | 'createdAt' | 'updatedAt' | 'quizId'>[],
  adminId: string,
): Promise<void> {
  const quizDocRef = doc(
    firestore,
    'grades',
    gradeId,
    'units',
    unitId,
    'lessons',
    lessonId,
    'sections',
    sectionId,
    'quizzes',
    quizId,
  )

  // Get existing quiz to merge updates
  const existingQuizSnap = await getDoc(quizDocRef)
  if (!existingQuizSnap.exists()) {
    throw new Error('Quiz not found')
  }

  const existingQuiz = existingQuizSnap.data() as Quiz

  // Merge updates
  const updatedQuiz: Quiz = {
    ...existingQuiz,
    ...quizUpdates,
    id: quizId,
  }

  // Transform questions
  const questionsWithIds: Question[] = questions.map((q, index) => ({
    ...q,
    id: `${quizId}_q${index + 1}`,
    quizId: quizId,
    order: q.order ?? index + 1,
    isPublished: q.isPublished ?? false,
    createdAt: null,
    updatedAt: null,
  } as Question))

  // Prepare document
  const firestoreDoc = prepareQuizDocumentForFirestore(updatedQuiz, questionsWithIds)
  firestoreDoc.updatedAt = serverTimestamp()

  // Keep teacher panel metadata
  firestoreDoc.gradeId = gradeId
  firestoreDoc.unitId = unitId
  firestoreDoc.lessonId = lessonId
  firestoreDoc.quizType = updatedQuiz.quizType // Preserve teacher panel quiz type
  firestoreDoc.isPublished = updatedQuiz.isPublished

  // Update in Firestore
  await updateDoc(quizDocRef, firestoreDoc)

  // Log admin action
  await logAdminAction({
    adminId,
    action: 'update',
    entity: 'quizzes',
    entityId: quizId,
    metadata: {
      title: updatedQuiz.title,
      questionCount: questions.length,
    },
  })
}

/**
 * Delete quiz with embedded questions
 */
export async function deleteQuizWithQuestions(
  gradeId: string,
  unitId: string,
  lessonId: string,
  sectionId: string,
  quizId: string,
  adminId: string,
): Promise<void> {
  const quizDocRef = doc(
    firestore,
    'grades',
    gradeId,
    'units',
    unitId,
    'lessons',
    lessonId,
    'sections',
    sectionId,
    'quizzes',
    quizId,
  )

  // Get quiz title for logging
  const quizSnap = await getDoc(quizDocRef)
  const quizTitle = quizSnap.exists() ? (quizSnap.data() as Quiz).title : 'Unknown'

  // Delete quiz (questions are embedded, so they're deleted too)
  await deleteDoc(quizDocRef)

  // Log admin action
  await logAdminAction({
    adminId,
    action: 'delete',
    entity: 'quizzes',
    entityId: quizId,
    metadata: {
      title: quizTitle,
    },
  })
}

/**
 * Get quiz with embedded questions
 */
export async function getQuizWithQuestions(
  gradeId: string,
  unitId: string,
  lessonId: string,
  sectionId: string,
  quizId: string,
): Promise<{ quiz: Quiz; questions: Question[] } | null> {
  const quizDocRef = doc(
    firestore,
    'grades',
    gradeId,
    'units',
    unitId,
    'lessons',
    lessonId,
    'sections',
    sectionId,
    'quizzes',
    quizId,
  )

  const snapshot = await getDoc(quizDocRef)
  if (!snapshot.exists()) return null

  const data = snapshot.data()
  
  // Map 'type' (student app format) to 'quizType' (teacher panel format)
  const quizType = data.quizType || (data.type ? mapToTeacherQuizType(data.type) : 'fill-in')
  
  const quiz = {
    id: snapshot.id,
    ...data,
    quizType,
  } as Quiz

  // Extract questions from embedded array and transform from student app format to teacher panel format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questions = ((data.questions as any[]) || []).map((q: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const question: any = {
      ...q,
      quizId: quizId,
    }

    // Transform matching question pairs from object to array format
    if (q.type === 'matching' && q.pairs && typeof q.pairs === 'object' && !Array.isArray(q.pairs)) {
      question.pairs = Object.entries(q.pairs).map(([left, right]) => ({
        id: left,
        left,
        right: right as string,
      }))
    }

    // Transform order_words to order-words type
    if (q.type === 'order_words') {
      question.type = 'order-words'
    }

    // Transform fill_blank to fill-in type
    if (q.type === 'fill_blank') {
      question.type = 'fill-in'
      // Convert answers array to blanks array if needed
      if (q.answers && Array.isArray(q.answers) && (!question.blanks || question.blanks.length === 0)) {
        question.blanks = q.answers.map((answer: string, index: number) => ({
          id: `blank_${index}`,
          answer,
        }))
      }
      // Preserve options if they exist
      if (q.options && Array.isArray(q.options)) {
        question.options = q.options
      }
      // Preserve points
      if (q.points !== undefined) {
        question.points = q.points
      }
    }

    // Transform spelling type - ensure answers is array
    if (q.type === 'spelling') {
      if (q.answers && Array.isArray(q.answers)) {
        question.answers = q.answers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } else if ((q as any).answer) {
        // Backward compatibility: single answer to array
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        question.answers = [(q as any).answer]
      }
      // Preserve points
      if (q.points !== undefined) {
        question.points = q.points
      }
    }

    // Preserve points for matching and order_words
    if (q.points !== undefined) {
      question.points = q.points
    }

    return question as Question
  })

  return {
    quiz,
    questions: questions,
  }
}

/**
 * Get all quizzes for a section
 */
export async function getQuizzesForSection(
  gradeId: string,
  unitId: string,
  lessonId: string,
  sectionId: string,
): Promise<Quiz[]> {
  const quizzesRef = collection(
    firestore,
    'grades',
    gradeId,
    'units',
    unitId,
    'lessons',
    lessonId,
    'sections',
    sectionId,
    'quizzes',
  )
  const snapshot = await getDocs(quizzesRef)
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    // Map 'type' (student app format) to 'quizType' (teacher panel format)
    const quizType = data.quizType || (data.type ? mapToTeacherQuizType(data.type) : 'fill-in')
    return {
      id: docSnap.id,
      ...data,
      quizType,
    } as Quiz
  })
}

