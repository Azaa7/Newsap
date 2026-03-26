const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');

admin.initializeApp();

const db = admin.firestore();
const expo = new Expo();

async function getPushTokens() {
  const snap = await db.collection('pushTokens').get();
  const tokens = [];

  snap.forEach((doc) => {
    const data = doc.data() || {};
    if (data.token && Expo.isExpoPushToken(data.token)) {
      tokens.push({
        userId: doc.id,
        token: data.token,
      });
    }
  });

  return tokens;
}

async function cleanupInvalidTokens(receipts, receiptIdToToken) {
  const badTokens = [];

  Object.entries(receipts || {}).forEach(([receiptId, receipt]) => {
    if (receipt && receipt.status === 'error') {
      const details = receipt.details || {};
      if (details.error === 'DeviceNotRegistered') {
        const token = receiptIdToToken.get(receiptId);
        if (token) {
          badTokens.push(token);
        }
      }
    }
  });

  if (!badTokens.length) {
    return;
  }

  const uniqueTokens = [...new Set(badTokens)];
  for (let i = 0; i < uniqueTokens.length; i += 30) {
    const querySnapshot = await db
      .collection('pushTokens')
      .where('token', 'in', uniqueTokens.slice(i, i + 30))
      .get();

    const batch = db.batch();
    querySnapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function sendPushForArticle({
  articleId,
  title,
  dataType = 'new_articles',
}) {
  const pushTokens = await getPushTokens();
  if (!pushTokens.length) {
    logger.info('No push tokens found.');
    return;
  }

  const messages = pushTokens.map(({ token, userId }) => ({
    to: token,
    sound: 'default',
    title: 'NEWSAP - Шинэ мэдээ',
    body: title,
    data: {
      type: dataType,
      articleId,
      userId,
    },
    channelId: 'news',
    priority: 'high',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  const receiptIdToToken = new Map();

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      ticketChunk.forEach((ticket, idx) => {
        if (ticket && ticket.id) {
          receiptIdToToken.set(ticket.id, chunk[idx].to);
        }
      });
      tickets.push(...ticketChunk);
    } catch (err) {
      logger.error('Expo push send error', err);
    }
  }

  const receiptIds = tickets
    .filter((ticket) => ticket && ticket.id)
    .map((ticket) => ticket.id);

  if (!receiptIds.length) {
    logger.info('No receipt ids returned from Expo push API.');
    return;
  }

  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

  for (const chunk of receiptIdChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      await cleanupInvalidTokens(receipts, receiptIdToToken);
    } catch (err) {
      logger.error('Expo receipt fetch error', err);
    }
  }

  logger.info('Push notifications sent', {
    articleId,
    tokenCount: pushTokens.length,
    dataType,
  });
}

exports.notifyOnArticleCreated = onDocumentCreated(
  {
    document: 'articles/{articleId}',
    region: 'asia-east1',
    maxInstances: 5,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn('No snapshot data in article create event.');
      return;
    }

    const article = snapshot.data() || {};
    const articleId = event.params.articleId;
    const title = article.title || 'Шинэ мэдээ нэмэгдлээ';

    await sendPushForArticle({
      articleId,
      title,
      dataType: 'new_articles',
    });
  }
);

exports.sendArticleDigestCron = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'Asia/Ulaanbaatar',
    region: 'asia-east1',
    maxInstances: 1,
  },
  async () => {
    const latestArticleSnap = await db
      .collection('articles')
      .orderBy('publishedAt', 'desc')
      .limit(1)
      .get();

    if (latestArticleSnap.empty) {
      logger.info('No article found for digest cron.');
      return;
    }

    const latestDoc = latestArticleSnap.docs[0];
    const latestData = latestDoc.data() || {};

    await sendPushForArticle({
      articleId: latestDoc.id,
      title: latestData.title || 'Шинэ мэдээ нэмэгдлээ',
      dataType: 'digest_latest',
    });
  }
);
