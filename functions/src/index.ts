import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

admin.initializeApp()

const db = admin.firestore()
const messaging = admin.messaging()

type NotificationDoc = admin.firestore.DocumentData & {
  title: string
  message: string
  audienceType: 'all' | 'grade' | 'unit' | 'lesson' | 'custom'
  audienceValue?: string
  channels?: string[]
  deliveryStatus?: 'draft' | 'scheduled' | 'sent' | 'cancelled' | 'sending'
  scheduledAt?: admin.firestore.Timestamp | admin.firestore.FieldValue | Date | null
  sentAt?: admin.firestore.Timestamp | admin.firestore.FieldValue | null
  createdBy?: string
  metadata?: Record<string, unknown>
  deliveryProcessed?: boolean
}

type DeviceRecord = {
  token: string
  ref: admin.firestore.DocumentReference
  notificationsEnabled: boolean
  segments?: string[]
  platform?: string
}

const NOTIFICATIONS_COLLECTION = 'notifications'
const MAX_BATCH_SIZE = 500

const isPushEnabled = (notification: NotificationDoc) => notification.channels?.includes('push') ?? false

const toDate = (value: unknown) => {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (value instanceof admin.firestore.Timestamp) return value.toDate()
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }
  return undefined
}

const shouldProcessImmediateSend = (after: NotificationDoc, before?: NotificationDoc | null) => {
  if (!isPushEnabled(after)) return false
  if (after.deliveryProcessed) return false
  if (after.deliveryStatus !== 'sent') return false
  const previousStatus = before?.deliveryStatus
  if (previousStatus === 'sent') return false
  return true
}

const chunk = <T,>(arr: T[], size: number) => {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

const logAdminAction = async (
  adminId: string | undefined,
  entityId: string,
  action: 'create' | 'update' | 'delete',
  metadata?: Record<string, unknown>,
) => {
  if (!adminId) return
  const logRef = db.collection('adminLogs').doc()
  await logRef.set({
    id: logRef.id,
    adminId,
    action,
    entity: 'notifications',
    entityId,
    metadata,
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  })
}

const fetchEligibleDevices = async (notification: NotificationDoc) => {
  const snapshot = await db
    .collectionGroup('devices')
    .where('notificationsEnabled', '==', true)
    .get()

  const devices: DeviceRecord[] = []
  snapshot.forEach((doc) => {
    const data = doc.data()
    const record: DeviceRecord = {
      token: data.fcmToken,
      notificationsEnabled: Boolean(data.notificationsEnabled),
      segments: data.segments ?? [],
      platform: data.platform,
      ref: doc.ref,
    }
    if (!record.token) return

    switch (notification.audienceType) {
      case 'all':
        devices.push(record)
        break
      case 'grade':
      case 'unit':
      case 'lesson':
      case 'custom': {
        const audienceValue = notification.audienceValue?.trim()
        if (!audienceValue) return
        const segmentKey = audienceValue.toLowerCase()
        const segments = (record.segments ?? []).map((segment) => String(segment).toLowerCase())
        if (segments.includes(segmentKey)) {
          devices.push(record)
        }
        break
      }
      default:
        devices.push(record)
    }
  })

  return devices
}

const removeInvalidDevices = async (devices: DeviceRecord[], invalidIndexes: number[]) => {
  const removals = invalidIndexes.map((index) => devices[index]?.ref.delete().catch(() => undefined))
  await Promise.all(removals)
}

const sendPushNotification = async (
  notificationId: string,
  notification: NotificationDoc,
  devices: DeviceRecord[],
) => {
  if (!devices.length) return { successCount: 0, failureCount: 0 }

  const batches = chunk(devices, MAX_BATCH_SIZE)
  let successCount = 0
  let failureCount = 0

  for (const batch of batches) {
    const response = await messaging.sendEachForMulticast({
      tokens: batch.map((device) => device.token),
      notification: {
        title: notification.title,
        body: notification.message,
      },
      data: {
        notificationId,
        audienceType: notification.audienceType,
        ...(notification.audienceValue ? { audienceValue: notification.audienceValue } : {}),
      },
    })

    successCount += response.successCount
    failureCount += response.failureCount

    const invalidIndexes = response.responses
      .map((res, index) => (res.error?.code === 'messaging/registration-token-not-registered' ? index : -1))
      .filter((index) => index >= 0)

    if (invalidIndexes.length) {
      await removeInvalidDevices(batch, invalidIndexes)
    }
  }

  return { successCount, failureCount }
}

const markNotificationProcessed = async (
  notificationRef: admin.firestore.DocumentReference,
  updates: Partial<NotificationDoc> & Record<string, unknown>,
) => {
  await notificationRef.set(
    {
      ...updates,
      deliveryProcessed: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
}

const processNotification = async (
  notificationId: string,
  notification: NotificationDoc,
  notificationRef: admin.firestore.DocumentReference,
) => {
  if (!isPushEnabled(notification)) {
    await markNotificationProcessed(notificationRef, {
      deliveryStatus: notification.deliveryStatus ?? 'sent',
      metadata: {
        ...(notification.metadata ?? {}),
        deliveryNote: 'Push channel not selected; notification ignored by backend.',
      },
    })
    return
  }

  const devices = await fetchEligibleDevices(notification)
  const { successCount, failureCount } = await sendPushNotification(notificationId, notification, devices)

  await markNotificationProcessed(notificationRef, {
    deliveryStatus: 'sent',
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    metadata: {
      ...(notification.metadata ?? {}),
      deliverySummary: {
        successCount,
        failureCount,
        attempted: devices.length,
        processedAt: new Date().toISOString(),
      },
    },
  })

  await logAdminAction(notification.createdBy, notificationId, 'update', {
    deliveryStatus: 'sent',
    successCount,
    failureCount,
  })
}

export const onNotificationWrite = functions.firestore
  .document(`${NOTIFICATIONS_COLLECTION}/{notificationId}`)
  .onWrite(async (change, context) => {
    const after = change.after.exists ? (change.after.data() as NotificationDoc) : null
    if (!after) return
    const before = change.before.exists ? (change.before.data() as NotificationDoc) : null

    if (shouldProcessImmediateSend(after, before)) {
      await processNotification(context.params.notificationId, after, change.after.ref)
    }
  })

export const processScheduledNotifications = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const now = new Date()
    const snapshot = await db
      .collection(NOTIFICATIONS_COLLECTION)
      .where('deliveryStatus', '==', 'scheduled')
      .get()

    const dueNotifications = snapshot.docs.filter((doc) => {
      const data = doc.data() as NotificationDoc
      const scheduledAt = toDate(data.scheduledAt)
      if (!scheduledAt) return true
      return scheduledAt.getTime() <= now.getTime()
    })

    const tasks = dueNotifications.map(async (doc) => {
      const data = doc.data() as NotificationDoc
      const scheduledAt = toDate(data.scheduledAt)
      await doc.ref.set(
        {
          deliveryStatus: 'sent',
          deliveryProcessed: false,
          metadata: {
            ...(data.metadata ?? {}),
            scheduledDelivery: true,
            scheduledAt: scheduledAt?.toISOString?.() ?? scheduledAt?.toString?.(),
          },
        },
        { merge: true },
      )
    })

    await Promise.all(tasks)
  })

// AI Composition Evaluation Function
// This function evaluates student composition answers using OpenAI API
// API key is stored securely in Firebase Functions config
export const evaluateComposition = functions.https.onCall(async (data, context) => {
  // Validate authentication (optional - remove if you want to allow anonymous calls)
  // if (!context.auth) {
  //   throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  // }

  // Validate input data
  const { questionPrompt, studentAnswer } = data

  if (!questionPrompt || typeof questionPrompt !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'questionPrompt is required and must be a string')
  }

  if (!studentAnswer || typeof studentAnswer !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'studentAnswer is required and must be a string')
  }

  if (studentAnswer.trim().length === 0) {
    return { isCorrect: false }
  }

  // Get OpenAI API key from Firebase Functions config
  // Set this using: firebase functions:config:set openai.api_key="your-key-here"
  const openaiApiKey = functions.config().openai?.api_key

  if (!openaiApiKey) {
    console.error('OpenAI API key not configured in Firebase Functions config')
    throw new functions.https.HttpsError(
      'internal',
      'AI evaluation service is not configured. Please contact administrator.',
    )
  }

  try {
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'system',
            content: 'You are an English teacher. Respond with only "CORRECT" or "INCORRECT".',
          },
          {
            role: 'user',
            content: `You are an English teacher evaluating a student's composition.

Question/Topic: ${questionPrompt}

Student's Answer:
${studentAnswer}

Evaluate if the student's answer:
1. Addresses the question/topic appropriately
2. Shows understanding of the subject
3. Is written in proper English
4. Has reasonable content quality for the grade level

Respond with ONLY "CORRECT" or "INCORRECT" (no other text, no explanation).`,
          },
        ],
        temperature: 0.3,
        max_tokens: 10,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`OpenAI API error: ${response.status} ${errorBody}`)
      throw new functions.https.HttpsError(
        'internal',
        'Failed to evaluate composition. Please try again.',
      )
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content || ''
    const normalizedContent = content.trim().toUpperCase()

    const isCorrect = normalizedContent.includes('CORRECT')

    return { isCorrect }
  } catch (error) {
    console.error('Error evaluating composition:', error)
    if (error instanceof functions.https.HttpsError) {
      throw error
    }
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while evaluating the composition. Please try again.',
    )
  }
})

