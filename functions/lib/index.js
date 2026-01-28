import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
const rtdb = admin.database();
const NOTIFICATIONS_COLLECTION = 'notifications';
const MAX_BATCH_SIZE = 500;
const isPushEnabled = (notification) => notification.channels?.includes('push') ?? false;
const toDate = (value) => {
    if (!value)
        return undefined;
    if (value instanceof Date)
        return value;
    if (value instanceof admin.firestore.Timestamp)
        return value.toDate();
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    return undefined;
};
const shouldProcessImmediateSend = (after, before) => {
    if (!isPushEnabled(after))
        return false;
    if (after.deliveryProcessed)
        return false;
    if (after.deliveryStatus !== 'sent')
        return false;
    const previousStatus = before?.deliveryStatus;
    if (previousStatus === 'sent')
        return false;
    return true;
};
const chunk = (arr, size) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
};
const logAdminAction = async (adminId, entityId, action, metadata) => {
    if (!adminId)
        return;
    const logRef = db.collection('adminLogs').doc();
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
    });
};
const fetchEligibleDevices = async (notification) => {
    const snapshot = await db
        .collectionGroup('devices')
        .where('notificationsEnabled', '==', true)
        .get();
    const devices = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        const record = {
            token: data.fcmToken,
            notificationsEnabled: Boolean(data.notificationsEnabled),
            segments: data.segments ?? [],
            platform: data.platform,
            ref: doc.ref,
        };
        if (!record.token)
            return;
        switch (notification.audienceType) {
            case 'all':
                devices.push(record);
                break;
            case 'grade':
            case 'unit':
            case 'lesson':
            case 'custom': {
                const audienceValue = notification.audienceValue?.trim();
                if (!audienceValue)
                    return;
                const segmentKey = audienceValue.toLowerCase();
                const segments = (record.segments ?? []).map((segment) => String(segment).toLowerCase());
                if (segments.includes(segmentKey)) {
                    devices.push(record);
                }
                break;
            }
            default:
                devices.push(record);
        }
    });
    return devices;
};
const removeInvalidDevices = async (devices, invalidIndexes) => {
    const removals = invalidIndexes.map((index) => devices[index]?.ref.delete().catch(() => undefined));
    await Promise.all(removals);
};
const sendPushNotification = async (notificationId, notification, devices) => {
    if (!devices.length)
        return { successCount: 0, failureCount: 0 };
    const batches = chunk(devices, MAX_BATCH_SIZE);
    let successCount = 0;
    let failureCount = 0;
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
        });
        successCount += response.successCount;
        failureCount += response.failureCount;
        const invalidIndexes = response.responses
            .map((res, index) => (res.error?.code === 'messaging/registration-token-not-registered' ? index : -1))
            .filter((index) => index >= 0);
        if (invalidIndexes.length) {
            await removeInvalidDevices(batch, invalidIndexes);
        }
    }
    return { successCount, failureCount };
};
const markNotificationProcessed = async (notificationRef, updates) => {
    await notificationRef.set({
        ...updates,
        deliveryProcessed: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
};
const processNotification = async (notificationId, notification, notificationRef) => {
    if (!isPushEnabled(notification)) {
        await markNotificationProcessed(notificationRef, {
            deliveryStatus: notification.deliveryStatus ?? 'sent',
            metadata: {
                ...(notification.metadata ?? {}),
                deliveryNote: 'Push channel not selected; notification ignored by backend.',
            },
        });
        return;
    }
    const devices = await fetchEligibleDevices(notification);
    const { successCount, failureCount } = await sendPushNotification(notificationId, notification, devices);
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
    });
    await logAdminAction(notification.createdBy, notificationId, 'update', {
        deliveryStatus: 'sent',
        successCount,
        failureCount,
    });
};
export const onNotificationWrite = functions.firestore
    .document(`${NOTIFICATIONS_COLLECTION}/{notificationId}`)
    .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    if (!after)
        return;
    const before = change.before.exists ? change.before.data() : null;
    if (shouldProcessImmediateSend(after, before)) {
        await processNotification(context.params.notificationId, after, change.after.ref);
    }
});
export const processScheduledNotifications = functions.pubsub
    .schedule('every 5 minutes')
    .onRun(async () => {
    const now = new Date();
    const snapshot = await db
        .collection(NOTIFICATIONS_COLLECTION)
        .where('deliveryStatus', '==', 'scheduled')
        .get();
    const dueNotifications = snapshot.docs.filter((doc) => {
        const data = doc.data();
        const scheduledAt = toDate(data.scheduledAt);
        if (!scheduledAt)
            return true;
        return scheduledAt.getTime() <= now.getTime();
    });
    const tasks = dueNotifications.map(async (doc) => {
        const data = doc.data();
        const scheduledAt = toDate(data.scheduledAt);
        await doc.ref.set({
            deliveryStatus: 'sent',
            deliveryProcessed: false,
            metadata: {
                ...(data.metadata ?? {}),
                scheduledDelivery: true,
                scheduledAt: scheduledAt?.toISOString?.() ?? scheduledAt?.toString?.(),
            },
        }, { merge: true });
    });
    await Promise.all(tasks);
});
// AI Composition Evaluation Function
// This function evaluates student composition answers using OpenAI API
// API key is stored securely in Firebase Functions config
export const evaluateComposition = functions.https.onCall(async (data, context) => {
    // Validate authentication (optional - remove if you want to allow anonymous calls)
    // if (!context.auth) {
    //   throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    // }
    // Validate input data
    const { questionPrompt, studentAnswer } = data;
    if (!questionPrompt || typeof questionPrompt !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'questionPrompt is required and must be a string');
    }
    if (!studentAnswer || typeof studentAnswer !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'studentAnswer is required and must be a string');
    }
    if (studentAnswer.trim().length === 0) {
        return { isCorrect: false };
    }
    // Get OpenAI API key from Firebase Functions config
    // Set this using: firebase functions:config:set openai.api_key="your-key-here"
    const openaiApiKey = functions.config().openai?.api_key;
    if (!openaiApiKey) {
        console.error('OpenAI API key not configured in Firebase Functions config');
        throw new functions.https.HttpsError('internal', 'AI evaluation service is not configured. Please contact administrator.');
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
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`OpenAI API error: ${response.status} ${errorBody}`);
            throw new functions.https.HttpsError('internal', 'Failed to evaluate composition. Please try again.');
        }
        const result = await response.json();
        const content = result.choices?.[0]?.message?.content || '';
        const normalizedContent = content.trim().toUpperCase();
        const isCorrect = normalizedContent.includes('CORRECT');
        return { isCorrect };
    }
    catch (error) {
        console.error('Error evaluating composition:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'An error occurred while evaluating the composition. Please try again.');
    }
});
// ============================================================================
// COMPETITION FUNCTIONS
// ============================================================================
/**
 * Create a competition room
 * - For PUBLIC matches: First checks for existing rooms waiting for players (matchmaking)
 * - If found, joins existing room
 * - If not found, creates new room
 * - For INVITE matches: Creates new room with invited user
 * - Generates questionIds from section
 * - Sets up match structure
 */
export const createCompetitionRoom = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { sectionId, userId, userName, invitedUserId, matchType, sectionMetadata } = data;
    if (!sectionId || !userId || !userName || !matchType) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    try {
        // Load questions from section
        const { gradeId, unitId, lessonId } = sectionMetadata;
        if (!gradeId || !unitId || !lessonId) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing section metadata');
        }
        const quizSnapshot = await db
            .collection('grades')
            .doc(gradeId)
            .collection('units')
            .doc(unitId)
            .collection('lessons')
            .doc(lessonId)
            .collection('sections')
            .doc(sectionId)
            .collection('quizzes')
            .limit(1)
            .get();
        if (quizSnapshot.empty) {
            throw new functions.https.HttpsError('not-found', 'No quiz found for this section');
        }
        const quizDoc = quizSnapshot.docs[0];
        const quizData = quizDoc.data();
        const questions = quizData.questions || [];
        if (questions.length === 0) {
            throw new functions.https.HttpsError('not-found', 'Quiz has no questions');
        }
        // Select random questions (5-10 questions)
        const questionCount = Math.min(Math.max(5, Math.floor(questions.length * 0.7)), 10);
        const shuffled = [...questions].sort(() => Math.random() - 0.5);
        const selectedQuestions = shuffled.slice(0, questionCount);
        const questionIds = selectedQuestions.map((q) => q.id);
        let roomId = '';
        let isJoiningExistingRoom = false;
        // MATCHMAKING LOGIC: For public matches, try to find existing room waiting for players
        if (matchType === 'public' && !invitedUserId) {
            try {
                // Get all rooms and filter client-side (Realtime DB doesn't support complex queries)
                const roomsRef = rtdb.ref('competition_rooms');
                const roomsSnapshot = await roomsRef.once('value');
                if (roomsSnapshot.exists()) {
                    const rooms = roomsSnapshot.val();
                    const now = Date.now();
                    const maxRoomAge = 2 * 60 * 1000; // 2 minutes
                    // Find a room that matches our criteria
                    for (const [key, roomData] of Object.entries(rooms)) {
                        const room = roomData;
                        // Check if room is available for matching
                        if (room &&
                            room.matchType === 'public' &&
                            room.status === 'waiting' &&
                            room.sectionId === sectionId &&
                            !room.invitedUserId // Not an invite-only room
                        ) {
                            const participants = room.participants || {};
                            const participantCount = Object.keys(participants).length;
                            // Found a room waiting for a player (has exactly 1 participant)
                            if (participantCount === 1) {
                                // Check if room is not too old (created within last 2 minutes)
                                const createdAt = room.createdAt || 0;
                                const roomAge = now - createdAt;
                                if (roomAge < maxRoomAge && roomAge >= 0) {
                                    roomId = key;
                                    isJoiningExistingRoom = true;
                                    // Join the existing room
                                    await roomsRef.child(roomId).child('participants').child(userId).set({
                                        userId,
                                        userName,
                                        joinedAt: admin.database.ServerValue.TIMESTAMP,
                                        status: 'waiting',
                                    });
                                    console.log(`✅ Player ${userId} joined existing room ${roomId} (matchmaking)`);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            catch (matchmakingError) {
                console.error('Error in matchmaking:', matchmakingError);
                // Continue to create new room if matchmaking fails
                isJoiningExistingRoom = false;
            }
        }
        // If no existing room found, create a new one
        if (!isJoiningExistingRoom) {
            const roomRef = rtdb.ref('competition_rooms').push();
            roomId = roomRef.key;
            const roomData = {
                roomId,
                sectionId,
                matchType, // 'invite' or 'public'
                createdBy: userId,
                createdAt: admin.database.ServerValue.TIMESTAMP,
                status: 'waiting',
                questionIds,
                timerPerQuestion: 60, // 60 seconds per question
                participants: {
                    [userId]: {
                        userId,
                        userName,
                        joinedAt: admin.database.ServerValue.TIMESTAMP,
                        status: 'waiting',
                    },
                },
                ...(invitedUserId ? { invitedUserId } : {}),
                sectionMetadata,
            };
            await roomRef.set(roomData);
            console.log(`Created new room ${roomId} for player ${userId}`);
        }
        return { roomId, questionIds, timerPerQuestion: 60, isJoiningExistingRoom };
    }
    catch (error) {
        console.error('Error creating competition room:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to create competition room');
    }
});
/**
 * Triggered when a player joins a room
 * Creates a match when both players are ready
 */
export const onRoomParticipantJoin = functions.database
    .ref('competition_rooms/{roomId}/participants/{userId}')
    .onCreate(async (snapshot, context) => {
    const roomId = context.params.roomId;
    const roomRef = rtdb.ref(`competition_rooms/${roomId}`);
    const roomSnapshot = await roomRef.once('value');
    const roomData = roomSnapshot.val();
    if (!roomData)
        return;
    const participants = roomData.participants || {};
    const participantCount = Object.keys(participants).length;
    // When second player joins, create match
    if (participantCount >= 2) {
        const matchRef = rtdb.ref('competition_matches').push();
        const matchId = matchRef.key;
        const matchData = {
            matchId,
            roomId,
            sectionId: roomData.sectionId,
            status: 'live',
            questionIds: roomData.questionIds,
            timerPerQuestion: roomData.timerPerQuestion || 60,
            participants: roomData.participants,
            sectionMetadata: roomData.sectionMetadata,
            createdAt: admin.database.ServerValue.TIMESTAMP,
            submissions: {},
        };
        await matchRef.set(matchData);
        // Update room status and link to match
        await roomRef.update({
            status: 'ready',
            matchId,
        });
    }
});
/**
 * Submit competition answers
 * - Validates answers server-side
 * - Calculates score server-side
 * - Updates match status
 * - Updates leaderboard when match completes
 */
export const submitCompetitionAnswers = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { matchId, userId, responses } = data;
    if (!matchId || !userId || !responses) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    try {
        // Get match data from Realtime Database
        const matchRef = rtdb.ref(`competition_matches/${matchId}`);
        const matchSnapshot = await matchRef.once('value');
        const matchData = matchSnapshot.val();
        if (!matchData) {
            throw new functions.https.HttpsError('not-found', 'Match not found');
        }
        // Get questions from Firestore
        const { sectionId, questionIds, sectionMetadata } = matchData;
        const { gradeId, unitId, lessonId } = sectionMetadata;
        const quizSnapshot = await db
            .collection('grades')
            .doc(gradeId)
            .collection('units')
            .doc(unitId)
            .collection('lessons')
            .doc(lessonId)
            .collection('sections')
            .doc(sectionId)
            .collection('quizzes')
            .limit(1)
            .get();
        if (quizSnapshot.empty) {
            throw new functions.https.HttpsError('not-found', 'Quiz not found');
        }
        const quizData = quizSnapshot.docs[0].data();
        const allQuestions = quizData.questions || [];
        const questionsMap = new Map(allQuestions.map((q) => [q.id, q]));
        // Validate and calculate score server-side
        let correctCount = 0;
        let totalPoints = 0;
        for (const questionId of questionIds) {
            const question = questionsMap.get(questionId);
            if (!question)
                continue;
            const userAnswer = responses[questionId];
            if (!userAnswer)
                continue;
            const isCorrect = validateAnswer(question, userAnswer);
            if (isCorrect) {
                correctCount++;
                totalPoints += question.points || 1;
            }
        }
        // Update match with user's submission
        const submissionData = {
            userId,
            correctCount,
            totalPoints,
            totalQuestions: questionIds.length,
            submittedAt: admin.database.ServerValue.TIMESTAMP,
        };
        await matchRef.child('submissions').child(userId).set(submissionData);
        // Check if both players have submitted
        const submissionsSnapshot = await matchRef.child('submissions').once('value');
        const submissions = submissionsSnapshot.val() || {};
        const participantIds = Object.keys(matchData.participants || {});
        if (Object.keys(submissions).length === participantIds.length) {
            // Both players submitted - determine winner and update leaderboard
            await finalizeMatch(matchId, matchData, submissions, sectionId);
        }
        return {
            success: true,
            score: totalPoints,
            correctCount,
            totalQuestions: questionIds.length,
        };
    }
    catch (error) {
        console.error('Error submitting competition answers:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to submit answers');
    }
});
/**
 * Validate answer against question (server-side validation)
 */
function validateAnswer(question, userAnswer) {
    const questionType = question.type;
    switch (questionType) {
        case 'fill_blank':
        case 'spelling': {
            const userAnswerStr = String(userAnswer).trim().toLowerCase();
            const correctAnswers = (question.answers || []).map((a) => a.trim().toLowerCase());
            return correctAnswers.includes(userAnswerStr);
        }
        case 'matching': {
            if (typeof userAnswer !== 'object')
                return false;
            const userPairs = userAnswer;
            const correctPairs = (question.pairs || {});
            if (Object.keys(userPairs).length !== Object.keys(correctPairs).length) {
                return false;
            }
            for (const [key, value] of Object.entries(correctPairs)) {
                const correctValue = String(value).toLowerCase().trim();
                const userValue = userPairs[key]?.toLowerCase().trim();
                if (userValue !== correctValue) {
                    return false;
                }
            }
            return true;
        }
        case 'order_words': {
            if (!Array.isArray(userAnswer))
                return false;
            const userOrder = userAnswer.map((w) => String(w).trim());
            const correctOrder = question.order || [];
            if (userOrder.length !== correctOrder.length)
                return false;
            return userOrder.every((word, index) => word === correctOrder[index]);
        }
        case 'composition': {
            // Composition validation is done via AI evaluation (separate function)
            // For now, accept any non-empty answer
            return String(userAnswer).trim().length > 0;
        }
        default:
            return false;
    }
}
/**
 * Finalize match and update leaderboard
 */
async function finalizeMatch(matchId, matchData, submissions, sectionId) {
    const participantIds = Object.keys(matchData.participants || {});
    const scores = participantIds.map((id) => ({
        userId: id,
        score: submissions[id]?.totalPoints || 0,
        correctCount: submissions[id]?.correctCount || 0,
    }));
    // Determine winner
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores[0].userId;
    const isTie = scores.length > 1 && scores[0].score === scores[1].score;
    // Update match status
    await rtdb.ref(`competition_matches/${matchId}`).update({
        status: 'completed',
        winnerId: isTie ? null : winnerId,
        isTie,
        finalizedAt: admin.database.ServerValue.TIMESTAMP,
    });
    // Update leaderboard in Firestore
    const leaderboardRef = db.collection('competition_leaderboards').doc(sectionId);
    const leaderboardDoc = await leaderboardRef.get();
    const currentEntries = leaderboardDoc.exists ? (leaderboardDoc.data()?.entries || []) : [];
    // Update points for each participant
    for (const { userId, score: matchScore } of scores) {
        const isWin = userId === winnerId && !isTie;
        const pointsGained = isWin ? 10 : 5;
        // Find or create entry
        let entryIndex = currentEntries.findIndex((e) => e.userId === userId);
        if (entryIndex === -1) {
            currentEntries.push({
                userId,
                userName: matchData.participants[userId]?.userName || 'Anonymous',
                points: 0,
            });
            entryIndex = currentEntries.length - 1;
        }
        // Update points
        currentEntries[entryIndex].points = (currentEntries[entryIndex].points || 0) + pointsGained;
    }
    // Sort by points descending
    currentEntries.sort((a, b) => (b.points || 0) - (a.points || 0));
    // Assign ranks
    currentEntries.forEach((entry, index) => {
        entry.rank = index + 1;
    });
    // Keep top 100
    const topEntries = currentEntries.slice(0, 100);
    // Update leaderboard
    await leaderboardRef.set({
        sectionId,
        entries: topEntries,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
