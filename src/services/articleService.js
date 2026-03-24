import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
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
const normalizeComparable = (text) => String(text || '').toLowerCase().trim().replace(/\s+/g, ' ');

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
    if (!dedupeKey || seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    result.push(article);
  }

  return result;
};

// ─── In-memory cache ─────────────────────────────────────────────────────
const cache = {
  feed: { data: null, key: '', ts: 0 },
  savedIds: { data: null, userId: '', ts: 0 },
  savedArticles: { data: null, key: '', ts: 0 },
  likedIds: { data: null, userId: '', ts: 0 },
  likedCategories: { data: null, userId: '', ts: 0 },
  history: { data: null, userId: '', ts: 0 },
  readCount: { data: null, key: '', ts: 0 },
};
const CACHE_TTL = 30_000; // 30 seconds
const localInteractionOverrides = {
  liked: new Map(),
  saved: new Map(),
  likesCount: new Map(),
};

const isCacheValid = (entry, matchKey) =>
  entry.data !== null && entry.key === matchKey && Date.now() - entry.ts < CACHE_TTL;

const invalidateCache = (name) => {
  if (name) {
    cache[name] = { data: null, key: '', ts: 0 };
  } else {
    Object.keys(cache).forEach((k) => (cache[k] = { data: null, key: '', ts: 0 }));
  }
};

const toArticleKey = (articleId) => String(articleId ?? '');

const applyInteractionOverrides = (articles = []) =>
  articles.map((article) => {
    const key = toArticleKey(article?.id);
    const hasLiked = localInteractionOverrides.liked.has(key);
    const hasSaved = localInteractionOverrides.saved.has(key);
    const hasLikesCount = localInteractionOverrides.likesCount.has(key);

    return {
      ...article,
      ...(hasLiked ? { isLiked: localInteractionOverrides.liked.get(key) } : null),
      ...(hasSaved ? { isSaved: localInteractionOverrides.saved.get(key) } : null),
      ...(hasLikesCount ? { likesCount: localInteractionOverrides.likesCount.get(key) } : null),
    };
  });

const applyInteractionOverrideToOne = (article = null) => {
  if (!article) return article;
  return applyInteractionOverrides([article])[0];
};

const categoryNameToId = {
  all: 0,
  sports: 1,
  sport: 1,
  'спорт': 1,
  economy: 2,
  economics: 2,
  business: 2,
  'эдийн засаг': 2,
  'эдийнзасаг': 2,
  politics: 3,
  political: 3,
  'улс төр': 3,
  'улстөр': 3,
  technology: 4,
  tech: 4,
  'технологи': 4,
  health: 5,
  'эрүүл мэнд': 5,
  'эрүүлмэнд': 5,
  world: 6,
  international: 6,
  'дэлхий': 6,
};

const categoryIdToName = {
  0: 'All',
  1: 'Sports',
  2: 'Economy',
  3: 'Politics',
  4: 'Technology',
  5: 'Health',
  6: 'World',
};

const resolveCategoryIdFromName = (categoryName) => {
  const text = toSearchable(categoryName).trim();
  if (!text) return 0;
  if (categoryNameToId[text] !== undefined) return categoryNameToId[text];

  if (text.includes('спорт')) return 1;
  if (text.includes('эдийн') || text.includes('business') || text.includes('econom')) return 2;
  if (text.includes('улс') || text.includes('polit')) return 3;
  if (text.includes('тех') || text.includes('tech')) return 4;
  if (text.includes('эрүүл') || text.includes('health')) return 5;
  if (text.includes('дэлхий') || text.includes('world') || text.includes('internat')) return 6;

  return 0;
};

const scoreArticle = (article, context) => {
  const { interestIds = [], history = [], readArticleIds = [], likedCategoryStats = {} } = context;
  let score = 0;

  // Хэрэглэгчийн сонирхолтой ангилалд +4
  if (interestIds.includes(article.categoryId)) {
    score += 4;
  }

  // Тухайн ангилалаас хэдийг уншсан (их уншсан = илүү сонирхолтой)
  const historyByCategory = history.filter((item) => item.categoryId === article.categoryId).length;
  score += Math.min(historyByCategory, 4);

  // Like дарсан мэдээний ангилалд ижил бол recommendation-ийг хүчтэй өсгөнө
  const likedInCategory = likedCategoryStats[article.categoryId] || 0;
  score += Math.min(likedInCategory, 4) * 1;

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

const normalizeCategoryIdValue = (value, fallbackCategory) => {
  if (Number.isFinite(value)) {
    return value;
  }

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  return resolveCategoryIdFromName(fallbackCategory || '');
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
  const fallbackCategoryId = resolveCategoryIdFromName(normalizedCategoryName);
  const normalizedCategoryId = Number.isFinite(data.categoryId)
    ? data.categoryId
    : Number.isFinite(Number(data.categoryId))
      ? Number(data.categoryId)
      : fallbackCategoryId;
  const canonicalCategoryName = categoryIdToName[normalizedCategoryId] || data.category || 'General';

  return {
    id: data.id ?? snapshot.id,
    title: data.title || '',
    content: data.content || data.summary || '',
    author: data.author || data.sourceName || 'Unknown source',
    category: canonicalCategoryName,
    categoryId: normalizedCategoryId,
    createdAt,
    publishedAt,
    publishedDate: data.publishedDate || 'now',
    image: normalizeImage(data),
    sourceUrl: data.sourceUrl || data.url || data.link || null,
    sourceName: data.sourceName || data.source || data.author || null,
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

const buildSavedArticlePayload = (article) => {
  if (!article) return null;
  return {
    id: article.id,
    title: article.title || '',
    content: article.content || '',
    author: article.author || 'Unknown source',
    category: article.category || 'General',
    categoryId: article.categoryId ?? 0,
    publishedAt: article.publishedAt || Date.now(),
    publishedDate: article.publishedDate || 'now',
    image: article.image || null,
    sourceUrl: article.sourceUrl || null,
    sourceName: article.sourceName || null,
    likesCount: article.likesCount ?? 0,
    commentsCount: article.commentsCount ?? 0,
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

    // Legacy fallback: some old docs may not have categoryId indexed/stored.
    // Fetch a larger pool and apply normalized category filter in memory.
    if (categoryId !== 0) {
      const broadSnapshot = await getDocs(query(articlesRef, limit(Math.max(limitCount * 4, 200))));
      const normalized = broadSnapshot.docs.map(normalizeArticle);
      const filtered = normalized.filter((item) => item.categoryId === categoryId);
      if (filtered.length > 0) {
        return filtered.slice(0, limitCount);
      }

      // Keep category strict: if selected category has no matching rows, return empty.
      return [];
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
      if (categoryId !== 0) {
        // If composite index/orderBy fails, fallback to category-only query (strict filter).
        const strictSnapshot = await getDocs(
          query(articlesRef, where('categoryId', '==', categoryId), limit(limitCount))
        );
        return strictSnapshot.docs
          .map(normalizeArticle)
          .sort((a, b) => b.publishedAt - a.publishedAt)
          .slice(0, limitCount);
      }

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

  async getLikedIds(userId) {
    if (!userId) return [];

    if (isCacheValid(cache.likedIds, userId)) {
      return cache.likedIds.data;
    }

    const likesRef = collection(firestoreDb, 'likes');
    const likesQuery = query(likesRef, where('userId', '==', userId));
    const snapshot = await getDocs(likesQuery);
    const ids = snapshot.docs.map((item) => item.data().articleId);
    cache.likedIds = { data: ids, key: userId, ts: Date.now() };
    return ids;
  },

  async toggleLikeArticle(userId, articleId, article = null) {
    if (!userId || !articleId) {
      return false;
    }

    const normalizedArticleId = String(articleId);
    const likeId = `${userId}_${normalizedArticleId}`;
    const likeDoc = doc(firestoreDb, 'likes', likeId);
    const existing = await getDoc(likeDoc);

    if (existing.exists()) {
      await deleteDoc(likeDoc);

      // Non-admin user rules-аас болж likesCount update fail болох боломжтой тул best-effort.
      try {
        await setDoc(
          doc(firestoreDb, 'articles', normalizedArticleId),
          {
            likesCount: increment(-1),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch {
      }

      try {
        analyticsService.track('unlike_article', { userId, articleId });
      } catch {
      }
      invalidateCache('likedIds');
      invalidateCache('likedCategories');
      localInteractionOverrides.liked.set(toArticleKey(normalizedArticleId), false);
      const previousCount = Number(article?.likesCount) || 0;
      localInteractionOverrides.likesCount.set(toArticleKey(normalizedArticleId), Math.max(0, previousCount - 1));
      return false;
    }

    const categoryId = normalizeCategoryIdValue(article?.categoryId, article?.category);
    await setDoc(likeDoc, {
      userId,
      articleId: normalizedArticleId,
      categoryId,
      createdAt: serverTimestamp(),
    });

    // Non-admin user rules-аас болж likesCount update fail болох боломжтой тул best-effort.
    try {
      await setDoc(
        doc(firestoreDb, 'articles', normalizedArticleId),
        {
          likesCount: increment(1),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
    }

    // Queue/analytics алдаа нь үндсэн like үйлдлийг rollback хийх шалтгаан биш.
    try {
      await offlineQueueService.enqueue('sync-like', { userId, articleId: normalizedArticleId, liked: true });
    } catch {
    }

    try {
      analyticsService.track('like_article', { userId, articleId });
    } catch {
    }

    invalidateCache('likedIds');
    invalidateCache('likedCategories');
    localInteractionOverrides.liked.set(toArticleKey(normalizedArticleId), true);
    const previousCount = Number(article?.likesCount) || 0;
    localInteractionOverrides.likesCount.set(toArticleKey(normalizedArticleId), Math.max(0, previousCount + 1));
    return true;
  },

  async getArticleLikeCount(articleId) {
    if (!articleId) return 0;

    const likesRef = collection(firestoreDb, 'likes');
    const stringId = String(articleId);
    const numericId = Number(articleId);

    const queries = [getDocs(query(likesRef, where('articleId', '==', stringId)))];
    if (Number.isFinite(numericId)) {
      queries.push(getDocs(query(likesRef, where('articleId', '==', numericId))));
    }

    const snapshots = await Promise.all(queries);
    const uniqueLikeDocIds = new Set();

    snapshots.forEach((snapshot) => {
      snapshot.docs.forEach((item) => {
        uniqueLikeDocIds.add(item.id);
      });
    });

    return uniqueLikeDocIds.size;
  },

  async getLikedCategoryStats(userId) {
    if (!userId) return {};

    if (isCacheValid(cache.likedCategories, userId)) {
      return cache.likedCategories.data;
    }

    const likesRef = collection(firestoreDb, 'likes');
    const likesQuery = query(likesRef, where('userId', '==', userId));
    const snapshot = await getDocs(likesQuery);

    const categoryStats = {};
    const unresolvedArticleIds = [];

    snapshot.docs.forEach((item) => {
      const data = item.data();
      const categoryId = normalizeCategoryIdValue(data?.categoryId, data?.category);
      if (categoryId > 0) {
        categoryStats[categoryId] = (categoryStats[categoryId] || 0) + 1;
      } else if (data?.articleId) {
        unresolvedArticleIds.push(String(data.articleId));
      }
    });

    if (unresolvedArticleIds.length > 0) {
      const uniqueIds = [...new Set(unresolvedArticleIds)];
      const snapshots = await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            return await getDoc(doc(firestoreDb, 'articles', id));
          } catch {
            return null;
          }
        })
      );

      snapshots.forEach((articleSnapshot) => {
        if (!articleSnapshot?.exists?.()) return;
        const data = articleSnapshot.data();
        const categoryId = normalizeCategoryIdValue(data?.categoryId, data?.category);
        if (categoryId > 0) {
          categoryStats[categoryId] = (categoryStats[categoryId] || 0) + 1;
        }
      });
    }

    cache.likedCategories = { data: categoryStats, key: userId, ts: Date.now() };
    return categoryStats;
  },

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

    return dedupeArticles(firestoreArticles)
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
    if (!userId) return [];

    if (isCacheValid(cache.savedArticles, userId)) {
      return cache.savedArticles.data;
    }

    const likedSnapshot = await getLikedRefs(userId);
    if (likedSnapshot.empty) {
      cache.savedArticles = { data: [], key: userId, ts: Date.now() };
      return [];
    }

    const articlesMap = new Map();
    const legacyIds = [];

    for (const docSnap of likedSnapshot.docs) {
      const data = docSnap.data();
      if (data.articleData && data.articleData.id && !articlesMap.has(data.articleData.id)) {
        articlesMap.set(data.articleData.id, {
          ...data.articleData,
          isSaved: true,
          _savedAt: normalizeTimestamp(data.createdAt),
        });
      } else if (data.articleId && !articlesMap.has(data.articleId)) {
        legacyIds.push(data.articleId);
      }
    }

    // Legacy fallback: хуучин format-тай doc-уудыг articles collection-оос татах
    if (legacyIds.length > 0) {
      for (const legacyId of legacyIds) {
        try {
          const articleDoc = await getDoc(doc(firestoreDb, 'articles', legacyId));
          if (articleDoc.exists()) {
            const normalized = normalizeArticle(articleDoc);
            articlesMap.set(legacyId, { ...normalized, isSaved: true });
          }
        } catch {
          // Article олдохгүй бол алгасна
        }
      }
    }

    const result = [...articlesMap.values()].sort((a, b) => (b._savedAt || b.publishedAt) - (a._savedAt || a.publishedAt));
    cache.savedArticles = { data: result, key: userId, ts: Date.now() };
    return result;
  },

  async getSavedCount(userId) {
    if (!userId) return 0;
    const savedArticles = await this.getSavedArticles(userId);
    return savedArticles.length;
  },

  async toggleSaveArticle(userId, articleId, article = null) {
    if (!userId || !articleId) {
      return false;
    }

    const likedRef = collection(firestoreDb, 'likedArticles');
    const existingQuery = query(likedRef, where('userId', '==', userId), where('articleId', '==', articleId));
    const existing = await getDocs(existingQuery);

    if (!existing.empty) {
      await deleteDoc(doc(firestoreDb, 'likedArticles', existing.docs[0].id));
      try {
        analyticsService.track('unsave_article', { userId, articleId });
      } catch {
      }
      invalidateCache('savedIds');
      invalidateCache('savedArticles');
      localInteractionOverrides.saved.set(toArticleKey(articleId), false);
      return false;
    }

    const payload = {
      userId,
      articleId,
      createdAt: serverTimestamp(),
    };

    const articleData = buildSavedArticlePayload(article);
    if (articleData) {
      payload.articleData = articleData;
    }

    await addDoc(likedRef, payload);

    // Queue/analytics алдаа нь save toggle-г rollback хийх шалтгаан биш.
    try {
      await offlineQueueService.enqueue('sync-save', { userId, articleId, saved: true });
    } catch {
    }

    try {
      analyticsService.track('save_article', { userId, articleId });
    } catch {
    }

    invalidateCache('savedIds');
    invalidateCache('savedArticles');
    localInteractionOverrides.saved.set(toArticleKey(articleId), true);
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
    invalidateCache('readCount');
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
    cache.readCount = { data: result.length, key: userId, ts: Date.now() };
    return result;
  },

  async getReadingHistoryCount(userId) {
    if (!userId) return 0;

    if (isCacheValid(cache.readCount, userId)) {
      return cache.readCount.data;
    }

    if (isCacheValid(cache.history, userId)) {
      return cache.history.data.length;
    }

    const readRef = collection(firestoreDb, 'readArticles');
    const snapshot = await getDocs(query(readRef, where('userId', '==', userId)));
    cache.readCount = { data: snapshot.size, key: userId, ts: Date.now() };
    return snapshot.size;
  },

  async getRecommendedArticles(user) {
    const feed = await this.getFeed({ limit: 100 });

    if (!user?.id) {
      return feed.slice(0, 10);
    }

    try {
      const history = await this.getReadingHistory(user.id);
      const likedCategoryStats = await this.getLikedCategoryStats(user.id);
      const interestNames = user.interests || [];

      // Interest нэрийг categoryId руу хөрвүүлэх
      const interestIds = interestNames.map((name) => categoryNameToId[name.toLowerCase()] ?? 0).filter((id) => id > 0);

      // Уншсан мэдээний ID жагсаалт
      const readArticleIds = history.map((h) => h.articleId);

      const ranked = [...feed]
        .map((article) => ({
          article,
          score: scoreArticle(article, { interestIds, history, readArticleIds, likedCategoryStats }),
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

  async enrichWithInteractions(userId, articles) {
    if (!userId) {
      return applyInteractionOverrides(articles.map((article) => ({
        ...article,
        isSaved: Boolean(article?.isSaved),
        isLiked: Boolean(article?.isLiked),
      })));
    }

    try {
      const [savedIds, likedIds] = await Promise.all([
        this.getSavedIds(userId),
        this.getLikedIds(userId),
      ]);

      const savedSet = new Set((savedIds || []).map((id) => String(id)));
      const likedSet = new Set((likedIds || []).map((id) => String(id)));

      return applyInteractionOverrides(articles.map((article) => {
        const articleId = String(article.id);
        return {
          ...article,
          isSaved: savedSet.has(articleId),
          isLiked: likedSet.has(articleId),
        };
      }));
    } catch {
      // likes/saved sync алдаа гарсан ч feed-ийг унагахгүй.
      return applyInteractionOverrides(articles.map((article) => ({
        ...article,
        isSaved: Boolean(article?.isSaved),
        isLiked: Boolean(article?.isLiked),
      })));
    }
  },

  setLocalInteractionOverride(articleId, patch = {}) {
    const key = toArticleKey(articleId);
    if (!key) return;

    if (patch.isLiked !== undefined) {
      localInteractionOverrides.liked.set(key, Boolean(patch.isLiked));
    }

    if (patch.isSaved !== undefined) {
      localInteractionOverrides.saved.set(key, Boolean(patch.isSaved));
    }

    if (patch.likesCount !== undefined && Number.isFinite(Number(patch.likesCount))) {
      localInteractionOverrides.likesCount.set(key, Math.max(0, Number(patch.likesCount)));
    }
  },

  getLocalInteractionOverride(articleId) {
    const key = toArticleKey(articleId);
    if (!key) return {};

    const result = {};
    if (localInteractionOverrides.liked.has(key)) {
      result.isLiked = localInteractionOverrides.liked.get(key);
    }
    if (localInteractionOverrides.saved.has(key)) {
      result.isSaved = localInteractionOverrides.saved.get(key);
    }
    if (localInteractionOverrides.likesCount.has(key)) {
      result.likesCount = localInteractionOverrides.likesCount.get(key);
    }
    return result;
  },

  applyLocalInteractionOverride(article) {
    return applyInteractionOverrideToOne(article);
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
