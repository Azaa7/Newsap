import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { firestoreDb } from '../config/firebase';
import { defaultCategories } from './mockData';
import { analyticsService } from './analyticsService';
import { offlineQueueService } from './offlineQueueService';

const toSearchable = (text) => String(text || '').toLowerCase();
const normalizeSearchQuery = (text) => toSearchable(text).trim().replace(/\s+/g, ' ');

// ─── In-memory cache ─────────────────────────────────────────────────────
const cache = {
  feed: { data: null, key: '', ts: 0 },
  savedIds: { data: null, userId: '', ts: 0 },
  history: { data: null, userId: '', ts: 0 },
};
const CACHE_TTL = 30_000; // 30 seconds

const isCacheValid = (entry, matchKey) =>
  entry.data !== null && entry.key === matchKey && Date.now() - entry.ts < CACHE_TTL;

const invalidateCache = (name) => {
  if (name) {
    cache[name] = { data: null, key: '', ts: 0 };
  } else {
    Object.keys(cache).forEach((k) => (cache[k] = { data: null, key: '', ts: 0 }));
  }
};

const categoryNameToId = {
  all: 0,
  sports: 1,
  economy: 2,
  economics: 2,
  politics: 3,
  technology: 4,
  health: 5,
  world: 6,
};

const scoreArticle = (article, context) => {
  const { interestIds = [], history = [], readArticleIds = [] } = context;
  let score = 0;

  // Хэрэглэгчийн сонирхолтой ангилалд +4
  if (interestIds.includes(article.categoryId)) {
    score += 4;
  }

  // Тухайн ангилалаас хэдийг уншсан (их уншсан = илүү сонирхолтой)
  const historyByCategory = history.filter((item) => item.categoryId === article.categoryId).length;
  score += Math.min(historyByCategory, 4);

  // Шинэ мэдээнд илүү оноо
  const recencyHours = Math.max(1, (Date.now() - article.publishedAt) / (1000 * 60 * 60));
  score += 3 / recencyHours;

  // Like тоо
  score += (article.likesCount || 0) / 200;

  // Аль хэдийн уншсан бол оноог бууруулах
  if (readArticleIds.includes(article.id)) {
    score -= 10;
  }

  return score;
};

const normalizeTimestamp = (value) => {
  if (!value) {
    return Date.now();
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }

  if (typeof value?.toMillis === 'function') {
    return value.toMillis();
  }

  return Date.now();
};

const normalizeImage = (data) => {
  const rawImage = data.image || data.imageUrl || data.thumbnail || data.urlToImage || null;

  if (!rawImage) {
    return null;
  }

  if (typeof rawImage === 'string') {
    return rawImage;
  }

  if (typeof rawImage === 'object') {
    return rawImage.uri || rawImage.url || rawImage.imageUrl || null;
  }

  return null;
};

const normalizeArticle = (snapshot) => {
  const data = snapshot.data();
  const publishedAt = normalizeTimestamp(data.publishedAt);
  const createdAt = normalizeTimestamp(data.createdAt || data.publishedAt);
  const normalizedCategoryName = toSearchable(data.category || 'general');
  const fallbackCategoryId = categoryNameToId[normalizedCategoryName] ?? 0;
  const normalizedCategoryId = Number.isFinite(data.categoryId)
    ? data.categoryId
    : Number.isFinite(Number(data.categoryId))
      ? Number(data.categoryId)
      : fallbackCategoryId;

  return {
    id: data.id ?? snapshot.id,
    title: data.title || '',
    content: data.content || data.summary || '',
    author: data.author || data.sourceName || 'Unknown source',
    category: data.category || 'General',
    categoryId: normalizedCategoryId,
    createdAt,
    publishedAt,
    publishedDate: data.publishedDate || 'now',
    image: normalizeImage(data),
    likesCount: data.likesCount ?? 0,
    commentsCount: data.commentsCount ?? 0,
    isSaved: false,
  };
};

const formatAdminArticlePayload = (input = {}) => {
  const normalizedCategoryId = Number.isFinite(input.categoryId)
    ? input.categoryId
    : Number.isFinite(Number(input.categoryId))
      ? Number(input.categoryId)
      : 0;

  const content = String(input.content || '').trim();
  const title = String(input.title || '').trim();

  if (!title) {
    throw new Error('Title is required.');
  }

  if (!content) {
    throw new Error('Content is required.');
  }

  return {
    title,
    content,
    summary: String(input.summary || content.slice(0, 180)).trim(),
    author: String(input.author || '').trim() || 'NEWSAP',
    category: String(input.category || 'General').trim() || 'General',
    categoryId: normalizedCategoryId,
    image: String(input.image || input.imageUrl || '').trim() || null,
    publishedDate: String(input.publishedDate || 'now').trim() || 'now',
    publishedAt: input.publishedAt || serverTimestamp(),
    likesCount: Number(input.likesCount) || 0,
    commentsCount: Number(input.commentsCount) || 0,
    updatedAt: serverTimestamp(),
  };
};

const getLikedRefs = async (userId) => {
  const likedRef = collection(firestoreDb, 'likedArticles');
  const likedQuery = query(likedRef, where('userId', '==', userId));
  return getDocs(likedQuery);
};

const getFirestoreArticles = async ({ categoryId = 0, limitCount = 50 } = {}) => {
  const articlesRef = collection(firestoreDb, 'articles');

  const constraints = [orderBy('publishedAt', 'desc'), limit(limitCount)];
  if (categoryId !== 0) {
    constraints.unshift(where('categoryId', '==', categoryId));
  }

  try {
    const articleQuery = query(articlesRef, ...constraints);
    const snapshot = await getDocs(articleQuery);
    const orderedArticles = snapshot.docs.map(normalizeArticle);
    if (orderedArticles.length > 0) {
      return orderedArticles;
    }

    const fallbackConstraints = [limit(limitCount)];
    if (categoryId !== 0) {
      fallbackConstraints.unshift(where('categoryId', '==', categoryId));
    }

    const fallbackQuery = query(articlesRef, ...fallbackConstraints);
    const fallbackSnapshot = await getDocs(fallbackQuery);
    return fallbackSnapshot.docs.map(normalizeArticle);
  } catch (error) {
    try {
      const safeQuery = query(articlesRef, limit(limitCount));
      const safeSnapshot = await getDocs(safeQuery);
      return safeSnapshot.docs.map(normalizeArticle);
    } catch (nestedError) {
      return [];
    }
  }
};

export const articleService = {
  categories: defaultCategories,

  async getFeed({ categoryId = 0, searchText = '', limit: itemLimit = 50 } = {}) {
    const queryText = normalizeSearchQuery(searchText);
    const queryTokens = queryText ? queryText.split(' ') : [];
    const cacheKey = `${categoryId}-${itemLimit}`;

    let firestoreArticles;
    if (isCacheValid(cache.feed, cacheKey)) {
      firestoreArticles = cache.feed.data;
    } else {
      firestoreArticles = await getFirestoreArticles({ categoryId, limitCount: itemLimit });
      cache.feed = { data: firestoreArticles, key: cacheKey, ts: Date.now() };
    }

    return firestoreArticles
      .filter((article) => {
        if (!queryTokens.length) return true;
        const haystack = [article.title, article.content, article.author, article.category]
          .map(toSearchable)
          .join(' ');
        return queryTokens.every((token) => haystack.includes(token));
      })
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, itemLimit);
  },

  async getSavedIds(userId) {
    if (!userId) return [];

    if (isCacheValid(cache.savedIds, userId)) {
      return cache.savedIds.data;
    }

    const likedSnapshot = await getLikedRefs(userId);
    const ids = likedSnapshot.docs.map((item) => item.data().articleId);
    cache.savedIds = { data: ids, key: userId, ts: Date.now() };
    return ids;
  },

  async getSavedArticles(userId) {
    const savedIds = await this.getSavedIds(userId);
    if (!savedIds.length) {
      return [];
    }

    const allArticles = await this.getFeed({ limit: 200 });
    return allArticles.filter((article) => savedIds.includes(article.id));
  },

  async toggleSaveArticle(userId, articleId) {
    if (!userId || !articleId) {
      return false;
    }

    const likedRef = collection(firestoreDb, 'likedArticles');
    const existingQuery = query(likedRef, where('userId', '==', userId), where('articleId', '==', articleId));
    const existing = await getDocs(existingQuery);

    if (!existing.empty) {
      await deleteDoc(doc(firestoreDb, 'likedArticles', existing.docs[0].id));
      analyticsService.track('unsave_article', { userId, articleId });
      invalidateCache('savedIds');
      return false;
    }

    await addDoc(likedRef, {
      userId,
      articleId,
      createdAt: serverTimestamp(),
    });

    await offlineQueueService.enqueue('sync-save', { userId, articleId, saved: true });
    analyticsService.track('save_article', { userId, articleId });
    invalidateCache('savedIds');
    return true;
  },

  async markArticleRead(userId, article) {
    if (!userId || !article?.id) {
      return;
    }

    const readRef = collection(firestoreDb, 'readArticles');
    const existingQuery = query(readRef, where('userId', '==', userId), where('articleId', '==', article.id), limit(1));
    const existing = await getDocs(existingQuery);

    const payload = {
      userId,
      articleId: article.id,
      categoryId: article.categoryId || 0,
      readAt: serverTimestamp(),
    };

    if (!existing.empty) {
      await setDoc(doc(firestoreDb, 'readArticles', existing.docs[0].id), payload, { merge: true });
    } else {
      await addDoc(readRef, payload);
    }

    analyticsService.track('view_article', {
      userId,
      articleId: article.id,
      categoryId: article.categoryId,
    });
    invalidateCache('history');
  },

  async getReadingHistory(userId) {
    if (!userId) return [];

    if (isCacheValid(cache.history, userId)) {
      return cache.history.data;
    }

    const readRef = collection(firestoreDb, 'readArticles');
    const snapshot = await getDocs(query(readRef, where('userId', '==', userId)));

    const result = snapshot.docs
      .map((item) => {
        const data = item.data();
        return {
          articleId: data.articleId,
          categoryId: data.categoryId || 0,
          readAt: normalizeTimestamp(data.readAt),
        };
      })
      .sort((a, b) => b.readAt - a.readAt);

    cache.history = { data: result, key: userId, ts: Date.now() };
    return result;
  },

  async getRecommendedArticles(user) {
    const feed = await this.getFeed({ limit: 100 });

    if (!user?.id) {
      return feed.slice(0, 10);
    }

    try {
      const history = await this.getReadingHistory(user.id);
      const interestNames = user.interests || [];

      // Interest нэрийг categoryId руу хөрвүүлэх
      const interestIds = interestNames.map((name) => categoryNameToId[name.toLowerCase()] ?? 0).filter((id) => id > 0);

      // Уншсан мэдээний ID жагсаалт
      const readArticleIds = history.map((h) => h.articleId);

      const ranked = [...feed]
        .map((article) => ({
          article,
          score: scoreArticle(article, { interestIds, history, readArticleIds }),
        }))
        .filter((item) => item.score > -5) // Уншсан мэдээг хасах
        .sort((a, b) => b.score - a.score)
        .map((item) => item.article);

      try {
        await offlineQueueService.flush({
          'sync-save': async () => Promise.resolve(),
        });
      } catch {
      }

      return ranked;
    } catch {
      return feed;
    }
  },

  async enrichWithSaved(userId, articles) {
    const savedIds = await this.getSavedIds(userId);
    return articles.map((article) => ({
      ...article,
      isSaved: savedIds.includes(article.id),
    }));
  },

  async getAdminArticles(limitCount = 200) {
    const articlesRef = collection(firestoreDb, 'articles');
    try {
      const snapshot = await getDocs(query(articlesRef, orderBy('createdAt', 'desc'), limit(limitCount)));
      return snapshot.docs.map(normalizeArticle).sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      const snapshot = await getDocs(query(articlesRef, limit(limitCount)));
      return snapshot.docs.map(normalizeArticle).sort((a, b) => b.createdAt - a.createdAt);
    }
  },

  async createAdminArticle(input, currentUser) {
    const payload = formatAdminArticlePayload({ ...input, author: input?.author || currentUser?.name || currentUser?.email });
    payload.createdAt = serverTimestamp();
    payload.createdBy = currentUser?.id || null;

    const ref = await addDoc(collection(firestoreDb, 'articles'), payload);
    return ref.id;
  },

  async updateAdminArticle(articleId, input) {
    if (!articleId) {
      throw new Error('Article id is required.');
    }

    const payload = formatAdminArticlePayload(input);
    await setDoc(doc(firestoreDb, 'articles', String(articleId)), payload, { merge: true });
  },

  async deleteAdminArticle(articleId) {
    if (!articleId) {
      throw new Error('Article id is required.');
    }

    await deleteDoc(doc(firestoreDb, 'articles', String(articleId)));
  },
};
