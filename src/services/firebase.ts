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
  where,
  orderBy,
  limit,
  getDocs,
  type Firestore,
  type QueryConstraint,
  type DocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, type FirebaseStorage } from 'firebase/storage'
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics'
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
  SpecialLesson,
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

let analyticsPromise: Promise<Analytics | null> | null = null

export const firebaseApp = app
export const firebaseAuth = auth
export const firestore = db
export const firebaseStorage = storage

export async function getFirebaseAnalytics() {
  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => (supported ? getAnalytics(app) : null))
      .catch(() => null)
  }
  return analyticsPromise
}

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
  | 'specialLessons'
  | 'notifications'

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
  specialLessons: SpecialLesson
  notifications: Notification
}

function fromDoc<T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as T
}

async function logAdminAction(params: Omit<AdminActionLog, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: 'active' | 'inactive' }) {
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

interface CollectionService<T extends { id: string; status: string }> {
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
        status: data.status ?? 'active',
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
export const specialLessonService = createCollectionService('specialLessons')
export const notificationService = createCollectionService('notifications')

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
  const [gradesSnap, unitsSnap, lessonsSnap, sectionsSnap, quizzesSnap, practiceSnap] = await Promise.all([
    getDocs(collection(db, 'grades')),
    getDocs(collection(db, 'units')),
    getDocs(collection(db, 'lessons')),
    getDocs(collection(db, 'sections')),
    getDocs(collection(db, 'quizzes')),
    getDocs(collection(db, 'practiceData')),
  ])

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

  const unitDoc = mostPracticedUnitId
    ? unitsSnap.docs.find((unit) => unit.id === mostPracticedUnitId)
    : undefined
  const unitTitle = unitDoc ? (unitDoc.data() as Unit).title : undefined

  const lessonDoc = mostChallengingLessonId
    ? lessonsSnap.docs.find((lesson) => lesson.id === mostChallengingLessonId)
    : undefined
  const lessonTitle = lessonDoc ? (lessonDoc.data() as Lesson).title : undefined

  return {
    grades: gradesSnap.size,
    units: unitsSnap.size,
    lessons: lessonsSnap.size,
    sections: sectionsSnap.size,
    quizzes: quizzesSnap.size,
    practices: practiceSnap.size,
    averageAccuracy,
    mostPracticedUnit: unitTitle ?? undefined,
    mostChallengingLesson: lessonTitle ?? undefined,
  }
}

export async function fetchAccuracyByUnit(): Promise<Array<{ unitId: string; unitTitle: string; accuracy: number }>> {
  const [unitsSnap, practiceSnap] = await Promise.all([getDocs(collection(db, 'units')), getDocs(collection(db, 'practiceData'))])
  const unitTitleMap = new Map(unitsSnap.docs.map((unit) => [unit.id, (unit.data() as Unit).title]))

  const aggregation = new Map<string, { attempts: number; correct: number }>()
  practiceSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as PracticeAggregate
    if (!data.unitId) return
    const entry = aggregation.get(data.unitId) ?? { attempts: 0, correct: 0 }
    aggregation.set(data.unitId, {
      attempts: entry.attempts + (data.attempts ?? 0),
      correct: entry.correct + (data.correct ?? 0),
    })
  })

  return Array.from(aggregation.entries()).map(([unitId, value]) => ({
    unitId,
    unitTitle: unitTitleMap.get(unitId) ?? 'Unknown Unit',
    accuracy: value.attempts ? Number(((value.correct / value.attempts) * 100).toFixed(2)) : 0,
  }))
}

export async function fetchQuizTypeDistribution(): Promise<Record<string, number>> {
  const practiceSnap = await getDocs(collection(db, 'practiceData'))
  const distribution = new Map<string, number>()
  practiceSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as PracticeAggregate
    if (!data.quizType) return
    distribution.set(data.quizType, (distribution.get(data.quizType) ?? 0) + (data.attempts ?? 0))
  })
  return Object.fromEntries(distribution.entries())
}

export async function fetchPracticeTable({
  gradeId,
  unitId,
  lessonId,
}: {
  gradeId?: string
  unitId?: string
  lessonId?: string
} = {}) {
  const constraints: QueryConstraint[] = []
  if (gradeId) constraints.push(where('gradeId', '==', gradeId))
  if (unitId) constraints.push(where('unitId', '==', unitId))
  if (lessonId) constraints.push(where('lessonId', '==', lessonId))

  const snapshot = await getDocs(constraints.length ? query(collection(db, 'practiceData'), ...constraints) : collection(db, 'practiceData'))
  return snapshot.docs.map((docSnap) => fromDoc<PracticeAggregate>(docSnap))
}

export async function fetchLatestAdminProfile(): Promise<AdminProfile | null> {
  const snapshot = await getDocs(query(collection(db, 'admin'), orderBy('updatedAt', 'desc'), limit(1)))
  if (snapshot.empty) return null
  return fromDoc<AdminProfile>(snapshot.docs[0])
}

export async function saveAdminProfile(
  profile: Partial<Pick<AdminProfile, 'id' | 'status' | 'logoUrl' | 'logoStoragePath' | 'createdAt'>> &
    Pick<AdminProfile, 'name' | 'email' | 'analyticsEnabled' | 'weaknessThreshold'>,
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


