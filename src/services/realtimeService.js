/**
 * realtimeService.js
 *
 * Бүх realtime логикийг нэг дор багцалсан сервис:
 *   1. Firestore onSnapshot  — articles collection-д шинэ мэдээ нэмэгдэхэд UI автоматаар шинэчлэгдэнэ
 *   2. Auto-import polling   — 15 мин тутам RSS feed шалгаж шинэ мэдээ импортлох
 *   3. AppState listener     — апп foreground-руу буцахад шалгах
 *   4. Notification listeners — push/local notification хүлээн авах
 *
 * Хэрэглээ:
 *   realtimeService.start(userId)   — бүгдийг эхлүүлнэ
 *   realtimeService.stop()          — бүгдийг зогсооно
 *   realtimeService.onArticlesChanged(callback) — мэдээний жагсаалт өөрчлөгдөхөд дуудагдана
 */

import { AppState } from 'react-native';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  where,
} from 'firebase/firestore';
import { firestoreDb } from '../config/firebase';
import { newsApiService } from './newsApiService';
import { notificationService } from './notificationService';

// ─── Тохиргоо ────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 минут
const FOREGROUND_MIN_GAP_MS = 5 * 60 * 1000; // 5 мин

// ─── Дотоод state ─────────────────────────────────────────────────────────────
let _pollTimer = null;
let _appStateSub = null;
let _snapshotUnsub = null;
let _notifCleanup = null;
let _isImporting = false;
let _lastImportTime = 0;
let _articleCallbacks = [];
let _started = false;

// ─── Firestore article normalizer (onSnapshot-д зориулсан хөнгөн хувилбар) ──
const normalizeTimestamp = (value) => {
  if (!value) return Date.now();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  if (typeof value?.toMillis === 'function') return value.toMillis();
  return Date.now();
};

const normalizeImage = (data) => {
  const raw = data.image || data.imageUrl || data.thumbnail || data.urlToImage || null;
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') return raw.uri || raw.url || raw.imageUrl || null;
  return null;
};

const normalizeComparable = (value) => String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');

const buildArticleDedupKey = (article) => {
  const sourceUrl = normalizeComparable(article?.sourceUrl);
  if (sourceUrl) {
    return `url:${sourceUrl}`;
  }

  const title = normalizeComparable(article?.title);
  const author = normalizeComparable(article?.author);
  const categoryId = Number.isFinite(article?.categoryId) ? article.categoryId : 0;
  return `title:${title}|author:${author}|cat:${categoryId}`;
};

const dedupeArticles = (articles = []) => {
  const seen = new Set();
  const result = [];

  for (const article of articles) {
    const dedupeKey = buildArticleDedupKey(article);
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push(article);
  }

  return result;
};

const categoryIdToName = {
  0: 'All', 1: 'Sports', 2: 'Economy', 3: 'Politics',
  4: 'Technology', 5: 'Health', 6: 'World',
};

const normalizeSnapshotDoc = (docSnap) => {
  const data = docSnap.data();
  const publishedAt = normalizeTimestamp(data.publishedAt);
  const categoryId = Number.isFinite(data.categoryId) ? data.categoryId : 0;

  return {
    id: data.id ?? docSnap.id,
    title: data.title || '',
    content: data.content || data.summary || '',
    author: data.author || data.sourceName || 'Unknown source',
    category: categoryIdToName[categoryId] || data.category || 'General',
    categoryId,
    publishedAt,
    createdAt: normalizeTimestamp(data.createdAt || data.publishedAt),
    publishedDate: data.publishedDate || 'now',
    image: normalizeImage(data),
    sourceUrl: data.sourceUrl || data.url || data.link || null,
    sourceName: data.sourceName || data.source || data.author || null,
    likesCount: data.likesCount ?? 0,
    commentsCount: data.commentsCount ?? 0,
    isSaved: false,
  };
};

// ─── 1. Firestore onSnapshot ──────────────────────────────────────────────────
function startArticleListener() {
  if (_snapshotUnsub) return;

  const articlesRef = collection(firestoreDb, 'articles');
  const q = query(articlesRef, orderBy('publishedAt', 'desc'), limit(100));

  _snapshotUnsub = onSnapshot(
    q,
    (snapshot) => {
      const articles = dedupeArticles(snapshot.docs.map(normalizeSnapshotDoc));
      _articleCallbacks.forEach((cb) => {
        try { cb(articles); } catch (e) { console.warn('[REALTIME] callback error:', e); }
      });
    },
    (error) => {
      console.warn('[REALTIME] onSnapshot error:', error);
    }
  );

  console.log('[REALTIME] Firestore article listener started');
}

function stopArticleListener() {
  if (_snapshotUnsub) {
    _snapshotUnsub();
    _snapshotUnsub = null;
    console.log('[REALTIME] Firestore article listener stopped');
  }
}

// ─── 2. Auto-import polling ───────────────────────────────────────────────────
async function doAutoImport() {
  if (_isImporting) return null;

  _isImporting = true;
  _lastImportTime = Date.now();
  console.log('[REALTIME] Auto-import checking...');

  try {
    const result = await newsApiService.importMongolianFeeds();
    console.log('[REALTIME] Import done:', result.imported, 'new,', result.skipped, 'skipped');

    if (result.imported > 0) {
      try {
        await notificationService.notifyNewArticles(result.imported, result.firstImportedTitle || null);
      } catch (e) {
        console.warn('[REALTIME] notification error:', e);
      }
    }

    return result;
  } catch (err) {
    console.error('[REALTIME] import error:', err);
    return null;
  } finally {
    _isImporting = false;
  }
}

function startPolling() {
  if (_pollTimer) return;

  console.log('[REALTIME] Polling started (every 15 min)');
  doAutoImport();

  _pollTimer = setInterval(() => {
    if (AppState.currentState === 'active') {
      doAutoImport();
    }
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
    console.log('[REALTIME] Polling stopped');
  }
}

// ─── 3. AppState listener ─────────────────────────────────────────────────────
function startAppStateListener() {
  if (_appStateSub) return;

  _appStateSub = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      const elapsed = Date.now() - _lastImportTime;
      if (elapsed > FOREGROUND_MIN_GAP_MS) {
        console.log('[REALTIME] App returned to foreground, checking...');
        doAutoImport();
      }
    }
  });
}

function stopAppStateListener() {
  if (_appStateSub) {
    _appStateSub.remove();
    _appStateSub = null;
  }
}

// ─── 4. Notification listeners ────────────────────────────────────────────────
function startNotificationListeners(handlers = {}) {
  if (_notifCleanup) return;

  _notifCleanup = notificationService.addNotificationListeners({
    onNotificationReceived: (notification) => {
      console.log('[REALTIME] Notification received:', notification.request.content.title);
      handlers.onNotificationReceived?.(notification);
    },
    onNotificationTapped: (data) => {
      console.log('[REALTIME] Notification tapped:', data);
      handlers.onNotificationTapped?.(data);
    },
  });
}

function stopNotificationListeners() {
  if (_notifCleanup) {
    _notifCleanup();
    _notifCleanup = null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const realtimeService = {
  /**
   * Бүх realtime сервисүүдийг нэг дуудлагаар эхлүүлнэ.
   * @param {string} userId
   * @param {object} handlers  — { onNotificationReceived, onNotificationTapped }
   */
  start(userId, handlers = {}) {
    if (_started) return;
    _started = true;
    console.log('[REALTIME] Starting all realtime services...');

    startArticleListener();
    startPolling();
    startAppStateListener();

    if (userId) {
      startNotificationListeners(handlers);
      notificationService.registerForPushNotifications(userId);
    }
  },

  /** Бүгдийг зогсоох */
  stop() {
    if (!_started) return;
    _started = false;
    console.log('[REALTIME] Stopping all realtime services...');

    stopArticleListener();
    stopPolling();
    stopAppStateListener();
    stopNotificationListeners();
    _articleCallbacks = [];
  },

  /**
   * Firestore-д articles өөрчлөгдөхөд дуудагдах callback бүртгэх.
   * HomeScreen-д ашиглана.
   * @param {function} callback — (articles: Article[]) => void
   * @returns {function} unsubscribe
   */
  onArticlesChanged(callback) {
    _articleCallbacks.push(callback);
    return () => {
      _articleCallbacks = _articleCallbacks.filter((cb) => cb !== callback);
    };
  },

  /** Гараар шалгах (pull-to-refresh үед) */
  async checkNow() {
    return doAutoImport();
  },
};
