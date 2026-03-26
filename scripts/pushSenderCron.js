/*
  GitHub Actions cron push sender for NEWSAP
  - Reads latest article from Firestore
  - Sends Expo push to tokens in pushTokens collection
  - Avoids duplicate send using system/pushSenderState doc
*/

const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT env variable');
  }

  // Supports plain JSON string or base64 encoded JSON
  try {
    return JSON.parse(raw);
  } catch (_) {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(decoded);
  }
}

function initFirebaseAdmin() {
  if (admin.apps.length) {
    return admin.app();
  }

  const serviceAccount = getServiceAccount();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    serviceAccount.project_id ||
    'newsap-c16ac';

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
  });
}

async function deleteInvalidTokens(db, tokens) {
  const uniqueTokens = [...new Set(tokens)];
  for (let i = 0; i < uniqueTokens.length; i += 30) {
    const chunk = uniqueTokens.slice(i, i + 30);
    const snap = await db.collection('pushTokens').where('token', 'in', chunk).get();
    const batch = db.batch();
    snap.forEach((doc) => batch.delete(doc.ref));
    if (!snap.empty) {
      await batch.commit();
    }
  }
}

async function run() {
  initFirebaseAdmin();

  const db = admin.firestore();
  const expo = new Expo();

  const latestSnap = await db
    .collection('articles')
    .orderBy('publishedAt', 'desc')
    .limit(1)
    .get();

  if (latestSnap.empty) {
    console.log('[push-cron] No article found.');
    return;
  }

  const latestDoc = latestSnap.docs[0];
  const latestArticleId = latestDoc.id;
  const latestData = latestDoc.data() || {};
  const latestTitle = latestData.title || 'Shine medee nemegdlee';

  const stateRef = db.collection('system').doc('pushSenderState');
  const stateSnap = await stateRef.get();
  const lastSentArticleId = stateSnap.exists ? stateSnap.data().lastSentArticleId : null;

  if (lastSentArticleId === latestArticleId) {
    console.log('[push-cron] Already sent for latest article:', latestArticleId);
    return;
  }

  const tokenSnap = await db.collection('pushTokens').get();
  const validTokens = [];

  tokenSnap.forEach((doc) => {
    const token = doc.data()?.token;
    if (token && Expo.isExpoPushToken(token)) {
      validTokens.push(token);
    }
  });

  if (!validTokens.length) {
    console.log('[push-cron] No valid Expo push tokens found.');
    await stateRef.set(
      {
        lastSentArticleId: latestArticleId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        reason: 'no_tokens',
      },
      { merge: true }
    );
    return;
  }

  const messages = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title: 'NEWSAP - Shine medee',
    body: latestTitle,
    data: {
      type: 'new_articles',
      articleId: latestArticleId,
    },
    channelId: 'news',
    priority: 'high',
  }));

  const tickets = [];
  const receiptIdToToken = new Map();

  for (const chunk of expo.chunkPushNotifications(messages)) {
    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
    ticketChunk.forEach((ticket, idx) => {
      if (ticket?.id) {
        receiptIdToToken.set(ticket.id, chunk[idx].to);
      }
    });
    tickets.push(...ticketChunk);
  }

  const receiptIds = tickets.filter((t) => t?.id).map((t) => t.id);
  const invalidTokens = [];

  for (const receiptChunk of expo.chunkPushNotificationReceiptIds(receiptIds)) {
    const receipts = await expo.getPushNotificationReceiptsAsync(receiptChunk);
    for (const [receiptId, receipt] of Object.entries(receipts)) {
      if (receipt?.status === 'error' && receipt?.details?.error === 'DeviceNotRegistered') {
        const token = receiptIdToToken.get(receiptId);
        if (token) {
          invalidTokens.push(token);
        }
      }
    }
  }

  if (invalidTokens.length) {
    await deleteInvalidTokens(db, invalidTokens);
  }

  await stateRef.set(
    {
      lastSentArticleId: latestArticleId,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      tokenCount: validTokens.length,
      invalidTokenCount: invalidTokens.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log('[push-cron] Sent notification for article:', latestArticleId, 'tokens:', validTokens.length);
}

run().catch((err) => {
  console.error('[push-cron] Failed:', err);
  process.exit(1);
});
