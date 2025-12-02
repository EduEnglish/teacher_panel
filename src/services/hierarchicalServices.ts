/**
 * Hierarchical Collection Services
 * Services for nested Firestore structure compatible with student app
 * Structure: grades/{gradeId}/units/{unitId}/lessons/{lessonId}/sections/{sectionId}/quizzes/{quizId}
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  serverTimestamp,
  onSnapshot,
  type QueryConstraint,
  type DocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { firestore } from './firebase'
import type { Unit, Lesson, Section } from '@/types/models'

/**
 * Convert Firestore document to entity
 */
function fromDoc<T>(snapshot: DocumentSnapshot<DocumentData>): T {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as T
}

/**
 * Recursively delete all quizzes under a section
 */
async function deleteAllQuizzes(
  gradeId: string,
  unitId: string,
  lessonId: string,
  sectionId: string,
): Promise<void> {
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
  const deletePromises = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref))
  await Promise.all(deletePromises)
}

/**
 * Recursively delete all sections and their quizzes under a lesson
 */
async function deleteAllSections(
  gradeId: string,
  unitId: string,
  lessonId: string,
): Promise<void> {
  const sectionsRef = collection(
    firestore,
    'grades',
    gradeId,
    'units',
    unitId,
    'lessons',
    lessonId,
    'sections',
  )
  const snapshot = await getDocs(sectionsRef)
  
  // Delete all quizzes for each section, then delete the section
  const deletePromises = snapshot.docs.map(async (sectionDoc) => {
    const sectionId = sectionDoc.id
    // Delete all quizzes under this section
    await deleteAllQuizzes(gradeId, unitId, lessonId, sectionId)
    // Delete the section itself
    await deleteDoc(sectionDoc.ref)
  })
  
  await Promise.all(deletePromises)
}

/**
 * Recursively delete all lessons, sections, and quizzes under a unit
 */
async function deleteAllLessons(
  gradeId: string,
  unitId: string,
): Promise<void> {
  const lessonsRef = collection(
    firestore,
    'grades',
    gradeId,
    'units',
    unitId,
    'lessons',
  )
  const snapshot = await getDocs(lessonsRef)
  
  // Delete all sections and quizzes for each lesson, then delete the lesson
  const deletePromises = snapshot.docs.map(async (lessonDoc) => {
    const lessonId = lessonDoc.id
    // Delete all sections and their quizzes under this lesson
    await deleteAllSections(gradeId, unitId, lessonId)
    // Delete the lesson itself
    await deleteDoc(lessonDoc.ref)
  })
  
  await Promise.all(deletePromises)
}

/**
 * Recursively delete all units, lessons, sections, and quizzes under a grade
 */
export async function deleteAllUnits(gradeId: string): Promise<void> {
  const unitsRef = collection(firestore, 'grades', gradeId, 'units')
  const snapshot = await getDocs(unitsRef)
  
  // Delete all lessons, sections, and quizzes for each unit, then delete the unit
  const deletePromises = snapshot.docs.map(async (unitDoc) => {
    const unitId = unitDoc.id
    // Delete all lessons, sections, and quizzes under this unit
    await deleteAllLessons(gradeId, unitId)
    // Delete the unit itself
    await deleteDoc(unitDoc.ref)
  })
  
  await Promise.all(deletePromises)
}

/**
 * Hierarchical Unit Service
 * Units as subcollections of grades: grades/{gradeId}/units/{unitId}
 */
export const hierarchicalUnitService = {
  /**
   * Create unit under a grade
   */
  async create(
    gradeId: string,
    data: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Unit> {
    const unitsRef = collection(firestore, 'grades', gradeId, 'units')
    const docRef = doc(unitsRef)
    const payload = {
      ...data,
      id: docRef.id,
      gradeId: gradeId, // Keep for reference
      isPublished: data.isPublished ?? false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    await setDoc(docRef, payload)
    return payload as Unit
  },

  /**
   * Update unit
   */
  async update(
    gradeId: string,
    unitId: string,
    data: Partial<Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<void> {
    const docRef = doc(firestore, 'grades', gradeId, 'units', unitId)
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
  },

  /**
   * Delete unit and all its child data (lessons, sections, quizzes)
   */
  async remove(gradeId: string, unitId: string): Promise<void> {
    // Delete all lessons, sections, and quizzes under this unit first
    await deleteAllLessons(gradeId, unitId)
    // Delete the unit itself
    const docRef = doc(firestore, 'grades', gradeId, 'units', unitId)
    await deleteDoc(docRef)
  },

  /**
   * Get unit by ID
   */
  async get(gradeId: string, unitId: string): Promise<Unit | null> {
    const docRef = doc(firestore, 'grades', gradeId, 'units', unitId)
    const snapshot = await getDoc(docRef)
    if (!snapshot.exists()) return null
    return fromDoc<Unit>(snapshot)
  },

  /**
   * Get all units for a grade
   */
  async getAll(gradeId: string, constraints?: QueryConstraint[]): Promise<Unit[]> {
    const unitsRef = collection(firestore, 'grades', gradeId, 'units')
    const q = constraints?.length ? query(unitsRef, ...constraints) : unitsRef
    const snapshot = await getDocs(q)
    return snapshot.docs.map((docSnap) => fromDoc<Unit>(docSnap))
  },

  /**
   * Listen to units for a grade
   */
  listen(
    gradeId: string,
    callback: (units: Unit[]) => void,
    constraints?: QueryConstraint[],
  ): () => void {
    const unitsRef = collection(firestore, 'grades', gradeId, 'units')
    const q = constraints?.length ? query(unitsRef, ...constraints) : unitsRef
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => fromDoc<Unit>(docSnap))
      callback(data)
    })
  },
}

/**
 * Hierarchical Lesson Service
 * Lessons as subcollections of units: grades/{gradeId}/units/{unitId}/lessons/{lessonId}
 */
export const hierarchicalLessonService = {
  async create(
    gradeId: string,
    unitId: string,
    data: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Lesson> {
    const lessonsRef = collection(firestore, 'grades', gradeId, 'units', unitId, 'lessons')
    const docRef = doc(lessonsRef)
    const payload = {
      ...data,
      id: docRef.id,
      gradeId: gradeId, // Keep for filtering
      unitId: unitId,
      isPublished: data.isPublished ?? false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    await setDoc(docRef, payload)
    return payload as Lesson
  },

  async update(
    gradeId: string,
    unitId: string,
    lessonId: string,
    data: Partial<Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<void> {
    const docRef = doc(firestore, 'grades', gradeId, 'units', unitId, 'lessons', lessonId)
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(gradeId: string, unitId: string, lessonId: string): Promise<void> {
    // Delete all sections and quizzes under this lesson first
    await deleteAllSections(gradeId, unitId, lessonId)
    // Delete the lesson itself
    const docRef = doc(firestore, 'grades', gradeId, 'units', unitId, 'lessons', lessonId)
    await deleteDoc(docRef)
  },

  async get(gradeId: string, unitId: string, lessonId: string): Promise<Lesson | null> {
    const docRef = doc(firestore, 'grades', gradeId, 'units', unitId, 'lessons', lessonId)
    const snapshot = await getDoc(docRef)
    if (!snapshot.exists()) return null
    return fromDoc<Lesson>(snapshot)
  },

  async getAll(
    gradeId: string,
    unitId: string,
    constraints?: QueryConstraint[],
  ): Promise<Lesson[]> {
    const lessonsRef = collection(firestore, 'grades', gradeId, 'units', unitId, 'lessons')
    const q = constraints?.length ? query(lessonsRef, ...constraints) : lessonsRef
    const snapshot = await getDocs(q)
    return snapshot.docs.map((docSnap) => fromDoc<Lesson>(docSnap))
  },

  listen(
    gradeId: string,
    unitId: string,
    callback: (lessons: Lesson[]) => void,
    constraints?: QueryConstraint[],
  ): () => void {
    const lessonsRef = collection(firestore, 'grades', gradeId, 'units', unitId, 'lessons')
    const q = constraints?.length ? query(lessonsRef, ...constraints) : lessonsRef
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => fromDoc<Lesson>(docSnap))
      callback(data)
    })
  },
}

/**
 * Hierarchical Section Service
 * Sections as subcollections of lessons: grades/{gradeId}/units/{unitId}/lessons/{lessonId}/sections/{sectionId}
 */
export const hierarchicalSectionService = {
  async create(
    gradeId: string,
    unitId: string,
    lessonId: string,
    data: Omit<Section, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Section> {
    const sectionsRef = collection(
      firestore,
      'grades',
      gradeId,
      'units',
      unitId,
      'lessons',
      lessonId,
      'sections',
    )
    const docRef = doc(sectionsRef)
    const payload = {
      ...data,
      id: docRef.id,
      gradeId: gradeId, // Keep for filtering
      unitId: unitId, // Keep for filtering
      lessonId: lessonId,
      isPublished: data.isPublished ?? false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    await setDoc(docRef, payload)
    return payload as Section
  },

  async update(
    gradeId: string,
    unitId: string,
    lessonId: string,
    sectionId: string,
    data: Partial<Omit<Section, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<void> {
    const docRef = doc(
      firestore,
      'grades',
      gradeId,
      'units',
      unitId,
      'lessons',
      lessonId,
      'sections',
      sectionId,
    )
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(
    gradeId: string,
    unitId: string,
    lessonId: string,
    sectionId: string,
  ): Promise<void> {
    // Delete all quizzes under this section first
    await deleteAllQuizzes(gradeId, unitId, lessonId, sectionId)
    // Delete the section itself
    const docRef = doc(
      firestore,
      'grades',
      gradeId,
      'units',
      unitId,
      'lessons',
      lessonId,
      'sections',
      sectionId,
    )
    await deleteDoc(docRef)
  },

  async get(
    gradeId: string,
    unitId: string,
    lessonId: string,
    sectionId: string,
  ): Promise<Section | null> {
    const docRef = doc(
      firestore,
      'grades',
      gradeId,
      'units',
      unitId,
      'lessons',
      lessonId,
      'sections',
      sectionId,
    )
    const snapshot = await getDoc(docRef)
    if (!snapshot.exists()) return null
    return fromDoc<Section>(snapshot)
  },

  async getAll(
    gradeId: string,
    unitId: string,
    lessonId: string,
    constraints?: QueryConstraint[],
  ): Promise<Section[]> {
    const sectionsRef = collection(
      firestore,
      'grades',
      gradeId,
      'units',
      unitId,
      'lessons',
      lessonId,
      'sections',
    )
    const q = constraints?.length ? query(sectionsRef, ...constraints) : sectionsRef
    const snapshot = await getDocs(q)
    return snapshot.docs.map((docSnap) => fromDoc<Section>(docSnap))
  },

  listen(
    gradeId: string,
    unitId: string,
    lessonId: string,
    callback: (sections: Section[]) => void,
    constraints?: QueryConstraint[],
  ): () => void {
    const sectionsRef = collection(
      firestore,
      'grades',
      gradeId,
      'units',
      unitId,
      'lessons',
      lessonId,
      'sections',
    )
    const q = constraints?.length ? query(sectionsRef, ...constraints) : sectionsRef
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => fromDoc<Section>(docSnap))
      callback(data)
    })
  },
}

