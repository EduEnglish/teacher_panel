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
   * Delete unit
   */
  async remove(gradeId: string, unitId: string): Promise<void> {
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

