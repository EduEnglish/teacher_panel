import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
  type Firestore,
  type QueryConstraint,
  type DocumentSnapshot,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, type FirebaseStorage } from 'firebase/storage'
import type {
  AdminActionLog,
  AdminProfile,
  CurriculumCounts,
  Grade,
  Lesson,
  Notification,
  PracticeAggregate,
  Question,
  Quiz,
  Section,
  Student,
  StudentPerformance,
  Unit,
} from '@/types/models'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

function assertFirebaseConfig(config: Record<string, string | undefined>) {
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key)
  if (missing.length > 0) {
    throw new Error(`Missing Firebase configuration. Please set: ${missing.join(', ')}`)
  }
}

assertFirebaseConfig(firebaseConfig)

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
const auth: Auth = getAuth(app)
const db: Firestore = getFirestore(app)
const storage: FirebaseStorage = getStorage(app)

export const firebaseApp = app
export const firebaseAuth = auth
export const firestore = db
export const firebaseStorage = storage

export function onAuthStateChangedListener(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

export async function login(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function requestPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email)
}

export async function logout() {
  return signOut(auth)
}

type CollectionName =
  | 'grades'
  | 'units'
  | 'lessons'
  | 'sections'
  | 'quizzes'
  | 'questions'
  | 'practiceData'
  | 'admin'
  | 'adminLogs'
  | 'notifications'
  | 'users'

type EntityMap = {
  grades: Grade
  units: Unit
  lessons: Lesson
  sections: Section
  quizzes: Quiz
  questions: Question
  practiceData: PracticeAggregate
  admin: AdminProfile
  adminLogs: AdminActionLog
  notifications: Notification
  users: Student
}

function fromDoc<T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as T
}

export async function logAdminAction(params: Omit<AdminActionLog, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: 'active' | 'inactive' }) {
  const logRef = doc(collection(db, 'adminLogs'))
  await setDoc(logRef, {
    id: logRef.id,
    status: params.status ?? 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    timestamp: serverTimestamp(),
    ...params,
  })
}

interface CollectionService<T extends { id: string }> {
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>, adminId: string, metadata?: Record<string, unknown>): Promise<T>
  update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>, adminId: string, metadata?: Record<string, unknown>): Promise<void>
  remove(id: string, adminId: string, metadata?: Record<string, unknown>): Promise<void>
  listen(callback: (items: T[]) => void, constraints?: QueryConstraint[]): () => void
  getAll(constraints?: QueryConstraint[]): Promise<T[]>
}

function createCollectionService<K extends CollectionName>(collectionName: K): CollectionService<EntityMap[K]> {
  type T = EntityMap[K]
  return {
    async create(data, adminId, metadata) {
      const collectionRef = collection(db, collectionName)
      const docRef = doc(collectionRef)
      const payload = {
        ...data,
        id: docRef.id,
        ...(('status' in data && data.status) ? { status: data.status } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      await setDoc(docRef, payload)
      await logAdminAction({
        adminId,
        action: 'create',
        entity: collectionName,
        entityId: docRef.id,
        metadata,
      })
      return payload as T
    },
    async update(id, data, adminId, metadata) {
      const docRef = doc(db, collectionName, id)
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      })
      await logAdminAction({
        adminId,
        action: 'update',
        entity: collectionName,
        entityId: id,
        metadata,
      })
    },
    async remove(id, adminId, metadata) {
      const docRef = doc(db, collectionName, id)
      await deleteDoc(docRef)
      await logAdminAction({
        adminId,
        action: 'delete',
        entity: collectionName,
        entityId: id,
        metadata,
      })
    },
    listen(callback, constraints) {
      const colRef = collection(db, collectionName)
      const q = constraints?.length ? query(colRef, ...constraints) : colRef
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map((docSnap) => fromDoc<T>(docSnap))
        callback(data)
      })
    },
    async getAll(constraints) {
      const colRef = collection(db, collectionName)
      const q = constraints?.length ? query(colRef, ...constraints) : colRef
      const snapshot = await getDocs(q)
      return snapshot.docs.map((docSnap) => fromDoc<T>(docSnap))
    },
  }
}

export const gradeService = createCollectionService('grades')
export const unitService = createCollectionService('units')
export const lessonService = createCollectionService('lessons')
export const sectionService = createCollectionService('sections')
export const quizService = createCollectionService('quizzes')
export const questionService = createCollectionService('questions')
export const practiceService = createCollectionService('practiceData')
export const adminProfileService = createCollectionService('admin')
export const notificationService = createCollectionService('notifications')
export const studentService = createCollectionService('users')

export async function sendNotification(notificationId: string, adminId: string, metadata?: Record<string, unknown>) {
  const docRef = doc(db, 'notifications', notificationId)
  await updateDoc(docRef, {
    deliveryStatus: 'sent',
    sentAt: serverTimestamp(),
    scheduledAt: null,
    updatedAt: serverTimestamp(),
  })
  await logAdminAction({
    adminId,
    action: 'update',
    entity: 'notifications',
    entityId: notificationId,
    metadata: {
      ...metadata,
      deliveryStatus: 'sent',
    },
  })
}

export async function scheduleNotification(
  notificationId: string,
  scheduledAt: Date,
  adminId: string,
  metadata?: Record<string, unknown>,
) {
  const docRef = doc(db, 'notifications', notificationId)
  await updateDoc(docRef, {
    deliveryStatus: 'scheduled',
    scheduledAt,
    sentAt: null,
    updatedAt: serverTimestamp(),
  })
  await logAdminAction({
    adminId,
    action: 'update',
    entity: 'notifications',
    entityId: notificationId,
    metadata: {
      ...metadata,
      deliveryStatus: 'scheduled',
      scheduledAt: scheduledAt.toISOString(),
    },
  })
}

export async function cancelNotification(notificationId: string, adminId: string, metadata?: Record<string, unknown>) {
  const docRef = doc(db, 'notifications', notificationId)
  await updateDoc(docRef, {
    deliveryStatus: 'cancelled',
    scheduledAt: null,
    sentAt: null,
    updatedAt: serverTimestamp(),
  })
  await logAdminAction({
    adminId,
    action: 'update',
    entity: 'notifications',
    entityId: notificationId,
    metadata: {
      ...metadata,
      deliveryStatus: 'cancelled',
    },
  })
}

export async function uploadFile(path: string, file: File | Blob) {
  const storageRef = ref(storage, path)
  const snapshot = await uploadBytes(storageRef, file)
  const url = await getDownloadURL(snapshot.ref)
  return { url, path: snapshot.ref.fullPath }
}

export async function deleteFile(path: string) {
  const storageRef = ref(storage, path)
  await deleteObject(storageRef)
}

export async function computeDashboardCounts(): Promise<CurriculumCounts> {
  // Get grades first
  const gradesSnap = await getDocs(collection(db, 'grades'))
  
  // Get all nested data by iterating through grades
  let totalUnits = 0
  let totalLessons = 0
  let totalSections = 0
  let totalQuizzes = 0
  
  for (const gradeDoc of gradesSnap.docs) {
    const gradeId = gradeDoc.id
    
    // Get units for this grade
    const unitsSnap = await getDocs(collection(db, 'grades', gradeId, 'units'))
    totalUnits += unitsSnap.size
    
    for (const unitDoc of unitsSnap.docs) {
      const unitId = unitDoc.id
      
      // Get lessons for this unit
      const lessonsSnap = await getDocs(collection(db, 'grades', gradeId, 'units', unitId, 'lessons'))
      totalLessons += lessonsSnap.size
      
      for (const lessonDoc of lessonsSnap.docs) {
        const lessonId = lessonDoc.id
        
        // Get sections for this lesson
        const sectionsSnap = await getDocs(collection(db, 'grades', gradeId, 'units', unitId, 'lessons', lessonId, 'sections'))
        totalSections += sectionsSnap.size
        
        for (const sectionDoc of sectionsSnap.docs) {
          const sectionId = sectionDoc.id
          
          // Get quizzes for this section
          const quizzesSnap = await getDocs(collection(db, 'grades', gradeId, 'units', unitId, 'lessons', lessonId, 'sections', sectionId, 'quizzes'))
          totalQuizzes += quizzesSnap.size
        }
      }
    }
  }
  
  const practiceSnap = await getDocs(collection(db, 'practiceData'))

  let totalAccuracy = 0
  let accuracyCount = 0

  let mostPracticedUnitId: string | undefined
  let mostPracticedAttempts = -1
  let mostChallengingLessonId: string | undefined
  let lowestAccuracy = Number.POSITIVE_INFINITY

  practiceSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as PracticeAggregate
    if (typeof data.accuracy === 'number') {
      totalAccuracy += data.accuracy
      accuracyCount += 1
    } else if (typeof data.correct === 'number' && typeof data.attempts === 'number' && data.attempts > 0) {
      totalAccuracy += (data.correct / data.attempts) * 100
      accuracyCount += 1
    }

    if (data.unitId) {
      const attempts = data.attempts ?? 0
      if (attempts > mostPracticedAttempts) {
        mostPracticedAttempts = attempts
        mostPracticedUnitId = data.unitId
      }
    }

    if (data.lessonId) {
      const accuracy = data.accuracy ?? (data.attempts ? (data.correct / data.attempts) * 100 : 0)
      if (accuracy < lowestAccuracy) {
        lowestAccuracy = accuracy
        mostChallengingLessonId = data.lessonId
      }
    }
  })

  const averageAccuracy = accuracyCount ? Number((totalAccuracy / accuracyCount).toFixed(2)) : 0

  // Find unit and lesson titles from nested structure
  let unitTitle: string | undefined
  let lessonTitle: string | undefined
  
  if (mostPracticedUnitId) {
    // Search through nested structure for unit
    for (const gradeDoc of gradesSnap.docs) {
      const unitsSnap = await getDocs(collection(db, 'grades', gradeDoc.id, 'units'))
      const unitDoc = unitsSnap.docs.find((u) => u.id === mostPracticedUnitId)
      if (unitDoc) {
        unitTitle = (unitDoc.data() as Unit).title
        break
      }
    }
  }
  
  if (mostChallengingLessonId) {
    // Search through nested structure for lesson
    for (const gradeDoc of gradesSnap.docs) {
      const unitsSnap = await getDocs(collection(db, 'grades', gradeDoc.id, 'units'))
      for (const unitDoc of unitsSnap.docs) {
        const lessonsSnap = await getDocs(collection(db, 'grades', gradeDoc.id, 'units', unitDoc.id, 'lessons'))
        const lessonDoc = lessonsSnap.docs.find((l) => l.id === mostChallengingLessonId)
        if (lessonDoc) {
          lessonTitle = (lessonDoc.data() as Lesson).title
          break
        }
      }
      if (lessonTitle) break
    }
  }

  return {
    grades: gradesSnap.size,
    units: totalUnits,
    lessons: totalLessons,
    sections: totalSections,
    quizzes: totalQuizzes,
    practices: practiceSnap.size,
    averageAccuracy,
    mostPracticedUnit: unitTitle ?? undefined,
    mostChallengingLesson: lessonTitle ?? undefined,
  }
}

export async function fetchLatestAdminProfile(): Promise<AdminProfile | null> {
  const snapshot = await getDocs(query(collection(db, 'admin'), orderBy('updatedAt', 'desc'), limit(1)))
  if (snapshot.empty) return null
  return fromDoc<AdminProfile>(snapshot.docs[0])
}

export async function saveAdminProfile(
  profile: Partial<Pick<AdminProfile, 'id' | 'status' | 'createdAt'>> &
    Pick<AdminProfile, 'name' | 'email'>,
) {
  const isNew = !profile.id
  const docRef = isNew ? doc(collection(db, 'admin')) : doc(db, 'admin', profile.id!)
  await setDoc(
    docRef,
    {
      ...profile,
      id: docRef.id,
      status: profile.status ?? 'active',
      createdAt: isNew ? serverTimestamp() : profile.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
  return docRef.id
}

export async function getAdminActionLogs(limitCount = 50) {
  const snapshot = await getDocs(query(collection(db, 'adminLogs'), orderBy('timestamp', 'desc'), limit(limitCount)))
  return snapshot.docs.map((docSnap) => fromDoc<AdminActionLog>(docSnap))
}

export async function fetchStudentPerformance(gradeId?: string): Promise<StudentPerformance[]> {
  const [studentsSnap, practiceSnap, gradesSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'practiceData')),
    getDocs(collection(db, 'grades')),
  ])

  const gradeMap = new Map(gradesSnap.docs.map((grade) => [grade.id, (grade.data() as Grade).name]))
  // const studentMap = new Map(studentsSnap.docs.map((student) => [student.id, fromDoc<Student>(student)]))

  // Build performance map from practiceData
  // Try multiple ways to link practiceData to users: userId, studentId, or document structure
  const performanceMap = new Map<string, { attempts: number; correct: number; quizIds: Set<string>; lastActivity?: Timestamp | null }>()

  practiceSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as PracticeAggregate & { userId?: string; studentId?: string }
    // Try to find userId/studentId in the data or extract from document ID
    const userId = data.userId || data.studentId || (docSnap.id.includes('_') ? docSnap.id.split('_')[0] : null)

    if (!userId) return

    // If filtering by grade, check if practice data matches
    if (gradeId && data.gradeId !== gradeId) return

    const existing = performanceMap.get(userId) ?? { attempts: 0, correct: 0, quizIds: new Set<string>() }
    const quizIds = existing.quizIds
    if (data.quizId) {
      quizIds.add(data.quizId)
    }
    
    performanceMap.set(userId, {
      attempts: existing.attempts + (data.attempts ?? 0),
      correct: existing.correct + (data.correct ?? 0),
      quizIds,
      lastActivity:
        data.updatedAt && existing.lastActivity
          ? data.updatedAt.toMillis() > existing.lastActivity.toMillis()
            ? data.updatedAt
            : existing.lastActivity
          : data.updatedAt || existing.lastActivity,
    })
  })

  // Return all users, with performance data if available
  return studentsSnap.docs
    .map((docSnap) => {
      const student = fromDoc<Student>(docSnap)
      const userId = docSnap.id
      const perf = performanceMap.get(userId) ?? { attempts: 0, correct: 0, quizIds: new Set<string>(), lastActivity: null }

      // If filtering by grade, check student's gradeId
      if (gradeId && student.gradeId !== gradeId) return null

      const totalAttempts = perf.attempts
      const totalCorrect = perf.correct
      const averageAccuracy = totalAttempts > 0 ? Number(((totalCorrect / totalAttempts) * 100).toFixed(2)) : 0

      return {
        studentId: userId,
        studentName: student.name,
        gradeId: student.gradeId,
        gradeName: student.gradeId ? gradeMap.get(student.gradeId) : undefined,
        totalAttempts,
        totalCorrect,
        averageAccuracy,
        quizzesCompleted: perf.quizIds.size,
        lastActivityAt: perf.lastActivity,
      } as StudentPerformance
    })
    .filter((item): item is StudentPerformance => item !== null)
    .sort((a, b) => {
      // Sort by accuracy (highest first), then by name if no data
      if (a.totalAttempts === 0 && b.totalAttempts === 0) {
        return a.studentName.localeCompare(b.studentName)
      }
      return b.averageAccuracy - a.averageAccuracy
    })
}


