/**
 * newsApiService.js
 *
 * Гадны мэдээний API-аас мэдээ татаж авч Firestore-д хадгалах сервис.
 *
 * Дэмжигдэх эх сурвалжууд:
 *   1. NewsAPI.org        — https://newsapi.org  (үнэгүй: 100 request/day)
 *   2. GNews              — https://gnews.io     (үнэгүй: 100 request/day)
 *   3. MediaStack          — https://mediastack.com
 *   4. RSS Feed (XML → JSON proxy) — rss2json.com ашиглан
 *
 * Хэрхэн ашиглах:
 *   1. NEWS_API_KEY-г өөрийн API key-ээр солино
 *   2. AdminScreen дээрх "Import" товчийг дарна
 *   3. Гадны мэдээнүүд таны Firestore articles collection-д хадгалагдана
 */

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { firestoreDb } from '../config/firebase';
import { notificationService } from './notificationService';

// ─── API KEY тохиргоо ──────────────────────────────────────────────
// NewsAPI.org дээр бүртгүүлж API key аваарай: https://newsapi.org/register
// GNews.io дээр бүртгүүлж API key аваарай: https://gnews.io/register
const NEWS_API_KEY = 'YOUR_NEWSAPI_KEY_HERE';
const GNEWS_API_KEY = 'YOUR_GNEWS_KEY_HERE';

// ─── Category mapping ──────────────────────────────────────────────
const CATEGORY_MAP = {
  sports: { id: 1, name: 'Sports' },
  sport: { id: 1, name: 'Sports' },
  business: { id: 2, name: 'Economy' },
  economy: { id: 2, name: 'Economy' },
  politics: { id: 3, name: 'Politics' },
  technology: { id: 4, name: 'Technology' },
  tech: { id: 4, name: 'Technology' },
  science: { id: 4, name: 'Technology' },
  health: { id: 5, name: 'Health' },
  world: { id: 6, name: 'World' },
  general: { id: 6, name: 'World' },
  entertainment: { id: 6, name: 'World' },
  nation: { id: 3, name: 'Politics' },
};

const resolveCategory = (rawCategory) => {
  const key = String(rawCategory || 'general').toLowerCase().trim();
  return CATEGORY_MAP[key] || { id: 6, name: 'World' };
};

// ─── Keyword-based auto-categorization ─────────────────────────────
// Монгол болон англи түлхүүр үгсээр мэдээний ангилал автоматаар тодорхойлно
const CATEGORY_KEYWORDS = {
  Sports: [
    // Монгол
    'спорт', 'тоглолт', 'тэмцээн', 'аварга', 'медаль', 'багийн', 'тамирчин',
    'тамирчид', 'хөл бөмбөг', 'сагсан бөмбөг', 'бөх', 'бөхийн', 'шигшээ',
    'олимп', 'дэлхийн аварга', 'лиг', 'тоглогч', 'дасгалжуулагч', 'оноо',
    'хожил', 'ялалт', 'тэмцээний', 'уралдаан', 'марафон', 'теннис',
    'шатар', 'хурдан морь', 'наадам', 'сур харваа', 'буудлага',
    'гол оруулав', 'шигшээ баг', 'дасгалжуулагч', 'тамирчин',
    // Англи
    'sport', 'football', 'basketball', 'athlete', 'championship', 'league',
    'tournament', 'medal', 'olympic', 'match', 'player', 'coach', 'goal',
    'fifa', 'nba', 'ufc', 'boxing', 'wrestling',
  ],
  Economy: [
    // Монгол
    'эдийн засаг', 'банк', 'зээл', 'хөрөнгө', 'төгрөг', 'ханш', 'валют',
    'инфляци', 'татвар', 'хувьцаа', 'бирж', 'хөрөнгө оруулалт', 'экспорт',
    'импорт', 'худалдаа', 'бизнес', 'компани', 'үнэ', 'өсөлт', 'бууралт',
    'орлого', 'зардал', 'төсөв', 'санхүүгийн', 'даатгал', 'ажилгүйдэл',
    'цалин', 'ашиг', 'нийлүүлэлт', 'эрэлт', 'уул уурхай', 'алт', 'зэс',
    'нүүрс', 'газрын тос', 'нефть', 'арилжаа', 'ипотек', 'зах зээл',
    'тэтгэлэг', 'тэтгэвэр', 'орон сууц', 'барилга', 'дэд бүтэц',
    'тээвэр', 'төмөр зам', 'нисэх', 'аялал жуулчлал', 'гааль',
    'бонд', 'хүү', 'хөтөлбөр', 'сангийн', 'эрчим хүч',
    // Англи
    'economy', 'economic', 'bank', 'finance', 'stock', 'market', 'gdp',
    'inflation', 'investment', 'trade', 'business', 'revenue', 'export',
    'import', 'tax', 'currency', 'mining', 'coal', 'gold', 'copper',
  ],
  Politics: [
    // Монгол — зөвхөн тодорхой улс төрийн үгс
    'улс төрийн', 'улс төр', 'сонгууль', 'сонгуулийн', 'намын',
    'ардчилсан нам', 'ардчилал', 'их хурлын', 'уих-ын',
    'авлига', 'авлигын', 'прокурор', 'прокурорын', 'ял шийтгэл',
    'импийчмент', 'огцруулах', 'жагсаал', 'эсэргүүцэл',
    'хилийн хориг', 'цагдаа', 'тагнуул', 'тагнуулын',
    'мөрдөн байцаалт', 'гэмт хэрэг', 'шүүхийн',
    // Англи
    'politics', 'political', 'election', 'vote', 'campaign',
    'opposition', 'parliament', 'corruption', 'impeach',
  ],
  Technology: [
    // Монгол
    'технологи', 'хиймэл оюун', 'оюун ухаан', 'програм', 'аппликейшн',
    'робот', 'интернет', 'сүлжээ', 'хакер', 'кибер', 'мэдээллийн',
    'инноваци', 'стартап', 'дижитал', 'цахим', 'электрон', 'ухаалаг',
    'мэдрэгч', 'сансар', 'хөтөч', 'вэб', 'софтвер', 'хардвер',
    'блокчейн', 'крипто', 'биткойн', 'чип', 'процессор',
    // Англи
    'technology', 'tech', 'software', 'hardware', 'ai', 'artificial intelligence',
    'robot', 'digital', 'internet', 'cyber', 'startup', 'innovation',
    'blockchain', 'crypto', 'app', 'smartphone', 'computer', 'data',
    'cloud', 'machine learning', 'programming', 'silicon',
  ],
  Health: [
    // Монгол
    'эрүүл мэнд', 'эмнэлэг', 'эмч', 'өвчин', 'вакцин', 'эмийн',
    'халдвар', 'тахал', 'ковид', 'covid', 'вирус', 'бактери', 'мэс засал',
    'оношилгоо', 'эмчилгээ', 'сувилал', 'нярай', 'жирэмсэн', 'донор',
    'цус', 'бөөр', 'зүрх', 'уушги', 'элэг', 'хавдар', 'хорт', 'хоол тэжээл',
    'амьсгал', 'сэтгэл', 'стресс', 'нойр', 'архаг', 'эмийн сан',
    // Англи
    'health', 'medical', 'hospital', 'doctor', 'disease', 'vaccine',
    'virus', 'pandemic', 'surgery', 'diagnosis', 'treatment', 'patient',
    'mental health', 'nutrition', 'cancer', 'diabetes', 'heart',
  ],
};

// ─── Гадаад мэдээ тодорхойлох түлхүүр үгс ────────────────────────
const WORLD_KEYWORDS = [
  // Explicit international context only (avoid over-triggering on country mentions)
  'гадаад мэдээ', 'олон улсын', 'олон улс', 'дэлхий дахин', 'геополитик',
  'олон улсын харилцаа', 'дипломат харилцаа', 'дипломат', 'элчин сайд',
  'нүб', 'нато', 'евро холбоо', 'европын холбоо', 'хориг арга хэмжээ',
  'энхтайвны хэлэлцээ', 'гадаад бодлого',
  // English
  'international', 'global', 'foreign policy', 'geopolitics',
  'united nations', 'nato', 'european union', 'sanctions', 'diplomacy',
];

/**
 * Мэдээний гарчиг, контент дээр тулгуурлан ангилал автоматаар тодорхойлох
 * @param {string} title - Мэдээний гарчиг
 * @param {string} content - Мэдээний агуулга
 * @returns {{ id: number, name: string }} - Тодорхойлсон ангилал
 */
const detectCategory = (title, content) => {
  const normalize = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[\u2018\u2019\u201C\u201D]/g, '"')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const titleLower = normalize(title);
  const contentLower = normalize(content);
  const text = `${titleLower} ${contentLower}`.trim();
  const scores = {};

  const keywordHitCount = (keywords, targetTitle, targetText) => {
    let score = 0;
    let hits = 0;
    const seen = new Set();

    for (const keyword of keywords) {
      const k = normalize(keyword);
      if (!k || seen.has(k)) continue;
      seen.add(k);

      if (targetTitle.includes(k)) {
        score += 3;
        hits += 1;
      } else if (targetText.includes(k)) {
        score += 1;
        hits += 1;
      }
    }

    return { score, hits };
  };

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const { score } = keywordHitCount(keywords, titleLower, text);
    scores[category] = score;
  }

  // World category is intentionally stricter to reduce false positives.
  const { score: worldScore, hits: worldHits } = keywordHitCount(WORLD_KEYWORDS, titleLower, text);

  // Хамгийн өндөр оноотой ангилал
  let bestCategory = null;
  let bestScore = 0;

  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  const CAT_IDS = { Sports: 1, Economy: 2, Politics: 3, Technology: 4, Health: 5, World: 6 };

  // World category only when international signal is clearly dominant.
  if (worldScore > bestScore && worldScore >= 4 && worldHits >= 2) {
    return { id: 6, name: 'World' };
  }

  // 2+ оноотой бол тухайн ангилалыг шууд авна (Politics ч бай бусад ч бай)
  if (bestCategory && bestScore >= 2) {
    return { id: CAT_IDS[bestCategory] || 2, name: bestCategory };
  }

  // Fallback:
  // 1) if there is some international signal, map to World
  if (worldScore >= 2 || worldHits >= 1) {
    return { id: 6, name: 'World' };
  }

  // 2) otherwise default to Politics for local generic headlines
  return { id: 3, name: 'Politics' };
};

// ─── HTML tag, style зэргийг цэвэрлэх ─────────────────────────────
const stripHtml = (text) => {
  if (!text) return '';

  return text
    // CDATA хаалт арилгах
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    // style="..." attribute бүхэлд нь арилгах
    .replace(/\s*style\s*=\s*"[^"]*"/gi, '')
    .replace(/\s*style\s*=\s*'[^']*'/gi, '')
    // class="..." attribute арилгах
    .replace(/\s*class\s*=\s*"[^"]*"/gi, '')
    .replace(/\s*class\s*=\s*'[^']*'/gi, '')
    // <br>, <br/> → мөр шилжүүлэх
    .replace(/<br\s*\/?>/gi, '\n')
    // <p>...</p> → мөр шилжүүлэх
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    // <div>...</div> → мөр шилжүүлэх
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    // <li> → bullet
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    // Бусад бүх HTML tag арилгах
    .replace(/<[^>]+>/g, '')
    // HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#\d+;/gi, '')
    .replace(/&[a-z]+;/gi, ' ')
    // Олон хоосон мөр → нэг
    .replace(/\n{3,}/g, '\n\n')
    // Мөрийн эхний хоосон зай
    .replace(/^\s+/gm, '')
    // Олон хоосон зай → нэг
    .replace(/ {2,}/g, ' ')
    .trim();
};

// ─── Normalize helpers ─────────────────────────────────────────────
const normalizeNewsApiArticle = (raw, categoryHint) => {
  const cat = resolveCategory(categoryHint || raw.category);
  return {
    title: stripHtml(raw.title || ''),
    content: stripHtml(raw.content || raw.description || ''),
    summary: stripHtml(raw.description || '').slice(0, 180),
    author: raw.source?.name || raw.author || 'External',
    category: cat.name,
    categoryId: cat.id,
    image: raw.urlToImage || raw.image || null,
    publishedAt: raw.publishedAt ? new Date(raw.publishedAt).getTime() : Date.now(),
    publishedDate: raw.publishedAt
      ? new Date(raw.publishedAt).toLocaleDateString()
      : 'now',
    sourceUrl: raw.url || null,
    sourceName: raw.source?.name || 'External',
    likesCount: 0,
    commentsCount: 0,
    importedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
};

const normalizeGNewsArticle = (raw, categoryHint) => {
  const cat = resolveCategory(categoryHint || 'general');
  return {
    title: stripHtml(raw.title || ''),
    content: stripHtml(raw.content || raw.description || ''),
    summary: stripHtml(raw.description || '').slice(0, 180),
    author: raw.source?.name || 'External',
    category: cat.name,
    categoryId: cat.id,
    image: raw.image || null,
    publishedAt: raw.publishedAt ? new Date(raw.publishedAt).getTime() : Date.now(),
    publishedDate: raw.publishedAt
      ? new Date(raw.publishedAt).toLocaleDateString()
      : 'now',
    sourceUrl: raw.url || null,
    sourceName: raw.source?.name || 'External',
    likesCount: 0,
    commentsCount: 0,
    importedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
};

const normalizeRssItem = (item, categoryHint) => {
  const cleanTitle = stripHtml(item.title || '');
  const cleanContent = stripHtml(item.content || item.description || item.contentSnippet || '');
  const cleanSummary = stripHtml(item.contentSnippet || item.description || '').slice(0, 180);

  // Түлхүүр үгсээр ангилал автоматаар тодорхойлох
  const cat = detectCategory(cleanTitle, cleanContent);

  return {
    title: cleanTitle,
    content: cleanContent,
    summary: cleanSummary,
    author: stripHtml(item.creator || item.author || item.feedTitle || 'External'),
    category: cat.name,
    categoryId: cat.id,
    image: item.enclosure?.link || item.thumbnail || null,
    publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
    publishedDate: item.pubDate
      ? new Date(item.pubDate).toLocaleDateString()
      : 'now',
    sourceUrl: item.link || null,
    sourceName: stripHtml(item.feedTitle || 'RSS Feed'),
    likesCount: 0,
    commentsCount: 0,
    importedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
};

// ─── Duplicate check (in-memory cache) ─────────────────────────────
let _existingTitlesCache = null;
let _cacheTimestamp = 0;
const TITLE_CACHE_TTL = 60_000; // 1 минут
const normalizeTitleKey = (title) =>
  String(title || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const loadExistingTitles = async () => {
  const now = Date.now();
  if (_existingTitlesCache && now - _cacheTimestamp < TITLE_CACHE_TTL) {
    return _existingTitlesCache;
  }
  console.log('[IMPORT] Loading existing titles from Firestore...');
  const articlesRef = collection(firestoreDb, 'articles');
  const snapshot = await getDocs(articlesRef);
  const titles = new Map();
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const titleKey = normalizeTitleKey(data?.title);
    if (!titleKey) return;
    titles.set(titleKey, {
      id: docSnap.id,
      image: data?.image || data?.imageUrl || data?.thumbnail || data?.urlToImage || null,
      sourceUrl: data?.sourceUrl || data?.url || data?.link || null,
    });
  });
  _existingTitlesCache = titles;
  _cacheTimestamp = now;
  console.log('[IMPORT] Loaded', titles.size, 'existing titles');
  return titles;
};

const invalidateTitleCache = () => {
  _existingTitlesCache = null;
  _cacheTimestamp = 0;
};

const scoreImageUrl = (url) => {
  if (!url) return 0;
  const text = String(url).toLowerCase();

  // Obvious thumbnail markers.
  if (text.includes('thumbnail') || text.includes('/thumb') || text.includes('thumb_') || text.includes('thumb=')) {
    return 50;
  }
  if (text.includes('small') || text.includes('sm_') || text.includes('preview')) {
    return 100;
  }

  // Common filename/path patterns like:
  // - image-300x200.jpg, image_640x360.png
  // - ikon.mn style: tihkmt_800_x_400_ph.jpg
  // (often used by CMSs for resized thumbnails)
  const dimMatch =
    text.match(/(?:^|[^\d])(\d{2,4})x(\d{2,4})(?:[^\d]|$)/) ||
    text.match(/(?:^|[^\d])(\d{2,4})_x_(\d{2,4})(?:[^\d]|$)/);
  if (dimMatch) {
    const w = Number(dimMatch[1]);
    const h = Number(dimMatch[2]);
    const best = Math.max(Number.isFinite(w) ? w : 0, Number.isFinite(h) ? h : 0);
    if (best > 0) return Math.min(best, 2000);
  }

  // Try to infer requested width/height from common query params.
  try {
    const parsed = new URL(url);
    const w = Number(parsed.searchParams.get('w') || parsed.searchParams.get('width') || parsed.searchParams.get('sz'));
    const h = Number(parsed.searchParams.get('h') || parsed.searchParams.get('height'));
    const best = Math.max(Number.isFinite(w) ? w : 0, Number.isFinite(h) ? h : 0);
    if (best > 0) return Math.min(best, 2000);

    // fit=300,200 or fit=300x200
    const fit = parsed.searchParams.get('fit') || parsed.searchParams.get('resize') || parsed.searchParams.get('size');
    if (fit) {
      const fitText = String(fit).toLowerCase();
      const m = fitText.match(/(\d{2,4})[x,](\d{2,4})/);
      if (m) {
        const fw = Number(m[1]);
        const fh = Number(m[2]);
        const fbest = Math.max(Number.isFinite(fw) ? fw : 0, Number.isFinite(fh) ? fh : 0);
        if (fbest > 0) return Math.min(fbest, 2000);
      }
    }
  } catch {
    // ignore
  }

  // Unknown size: assume medium.
  return 600;
};

const looksLowRes = (url) => scoreImageUrl(url) > 0 && scoreImageUrl(url) < 500;

const isBetterImage = (candidateUrl, currentUrl) => {
  const candidateScore = scoreImageUrl(candidateUrl);
  const currentScore = scoreImageUrl(currentUrl);
  if (!candidateUrl) return false;
  if (!currentUrl) return true;
  if (String(candidateUrl) === String(currentUrl)) return false;
  return candidateScore > currentScore;
};

const resolveMaybeRelativeUrl = (maybeRelative, baseUrl) => {
  if (!maybeRelative) return null;
  const value = String(maybeRelative).trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) return value;
  if (!baseUrl) return value;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
};

const isIkonUrl = (url) => {
  if (!url) return false;
  try {
    return new URL(url).hostname.toLowerCase().endsWith('ikon.mn');
  } catch {
    return String(url).toLowerCase().includes('ikon.mn');
  }
};

const isIkonFeedUrl = (url) => {
  if (!url) return false;
  try {
    return new URL(url).hostname.toLowerCase().endsWith('ikon.mn');
  } catch {
    return String(url).toLowerCase().includes('ikon.mn');
  }
};

const normalizeUrlForCompare = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url, 'https://ikon.mn');
    parsed.hash = '';
    parsed.search = '';
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.hostname.toLowerCase()}${path}`;
  } catch {
    return String(url || '').trim().toLowerCase().replace(/#.*$/, '').replace(/\?.*$/, '').replace(/\/+$/, '');
  }
};

const isLikelyIkonNewsPath = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(url, 'https://ikon.mn');
    return /^\/n\/[a-z0-9]+$/i.test(parsed.pathname);
  } catch {
    return /\/n\/[a-z0-9]+$/i.test(String(url));
  }
};

const extractIkonLatestLinksFromSslistHtml = (html) => {
  if (!html) return [];

  const links = [];
  const titleLinkRegex = /<div\s+class=["']sslist_title["'][\s\S]*?<a[^>]+href=["']([^"']+)["']/gi;
  let match;

  while ((match = titleLinkRegex.exec(html)) !== null) {
    const resolved = resolveMaybeRelativeUrl(match[1], 'https://ikon.mn');
    if (!resolved) continue;
    if (!isLikelyIkonNewsPath(resolved)) continue;
    links.push(resolved);
  }

  return unique(links);
};

const fetchIkonLatestLinkSet = async () => {
  try {
    const response = await fetch('https://ikon.mn/sslist', {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'mn,en-US;q=0.9,en;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const links = extractIkonLatestLinksFromSslistHtml(html);
    if (links.length === 0) return null;
    return new Set(links.map((link) => normalizeUrlForCompare(link)).filter(Boolean));
  } catch {
    return null;
  }
};

const filterIkonLatestOnly = (articles, ikonLatestLinkSet) => {
  if (!Array.isArray(articles) || articles.length === 0) return [];

  // Strict mode: only keep links present in the "ШИНЭ" page list.
  if (ikonLatestLinkSet && ikonLatestLinkSet.size > 0) {
    return articles.filter((article) => ikonLatestLinkSet.has(normalizeUrlForCompare(article?.sourceUrl)));
  }

  // Fallback mode: keep only real IKON news article paths (/n/{id}).
  return articles.filter((article) => isLikelyIkonNewsPath(article?.sourceUrl));
};

// Try to convert common resized thumbnail URLs into a larger variant.
// Examples:
// - https://site.com/image-300x200.jpg -> https://site.com/image.jpg
// - ...?w=320 -> ...?w=1200
const upgradeImageUrl = (url) => {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;

  // Strip common CMS size suffixes in filename.
  // WordPress pattern: -300x200.jpg / _300x200.jpg
  // ikon.mn/content.ikon.mn: _800_x_400_
  const stripped = raw
    .replace(/([\-_])\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp|gif)(?:\?|$))/i, '')
    .replace(/_\d{2,4}_x_\d{2,4}_/i, '_');

  // Bump common query params if present.
  try {
    const parsed = new URL(stripped);
    const maybeBump = (key, target) => {
      const v = Number(parsed.searchParams.get(key));
      if (Number.isFinite(v) && v > 0 && v < target) parsed.searchParams.set(key, String(target));
    };
    maybeBump('w', 1200);
    maybeBump('width', 1200);
    maybeBump('sz', 1200);
    maybeBump('h', 800);
    maybeBump('height', 800);

    return parsed.toString();
  } catch {
    return stripped;
  }
};

const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));

const withTimeout = async (promise, timeoutMs = 3500) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const probeUrlOk = async (url) => {
  if (!url) return false;
  try {
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    };
    if (isIkonUrl(url)) {
      headers['Referer'] = 'https://ikon.mn/';
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const request = fetch(url, {
      method: 'HEAD',
      signal: controller?.signal,
      headers,
    });

    const res = await withTimeout(request, 3500);
    // Some CDNs don't allow HEAD (405). In that case, allow it and let Image do GET.
    if (res.status === 405) return true;
    return res.ok;
  } catch {
    return false;
  }
};

const buildIkonImageCandidates = (url) => {
  if (!url) return [];
  const raw = String(url);
  const lower = raw.toLowerCase();
  if (!lower.includes('ikon.mn')) return [];

  const candidates = [];

  // ikon style: _800_x_400_
  const m = lower.match(/_(\d{2,4})_x_(\d{2,4})_/);
  if (m) {
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      // Prefer removing the size marker first (often maps to original), then try larger common sizes.
      candidates.push(raw.replace(/_\d{2,4}_x_\d{2,4}_/i, '_'));

      // Try 1200 and 1600 variants while keeping aspect ratio.
      const ratio = w / h;
      const w1200 = 1200;
      const h1200 = Math.max(1, Math.round(w1200 / ratio));
      candidates.push(raw.replace(/_\d{2,4}_x_\d{2,4}_/i, `_${w1200}_x_${h1200}_`));

      const w1600 = 1600;
      const h1600 = Math.max(1, Math.round(w1600 / ratio));
      candidates.push(raw.replace(/_\d{2,4}_x_\d{2,4}_/i, `_${w1600}_x_${h1600}_`));
    }
  }

  // Also include the generic upgrade (strip -300x200, bump ?w=)
  candidates.push(upgradeImageUrl(raw));

  return unique(candidates);
};

const pickBestReachableImage = async (currentUrl) => {
  const candidates = buildIkonImageCandidates(currentUrl);
  if (candidates.length === 0) return null;

  // Try highest score first.
  const ordered = [...candidates].sort((a, b) => scoreImageUrl(b) - scoreImageUrl(a));
  for (const candidate of ordered) {
    if (candidate === currentUrl) continue;
    const ok = await probeUrlOk(candidate);
    if (ok) return candidate;
  }
  return null;
};

// ─── Simple XML RSS parser (no library needed) ────────────────────
const extractTagContent = (xml, tag) => {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const matches = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
};

const extractCdata = (text) => {
  if (!text) return '';
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
};

const extractImage = (itemXml) => {
  // Try <media:content url="...">
  const mediaMatch = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mediaMatch) return mediaMatch[1];

  // Try <enclosure url="...">
  const enclosureMatch = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enclosureMatch) return enclosureMatch[1];

  // Try <media:thumbnail url="...">
  const thumbMatch = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (thumbMatch) return thumbMatch[1];

  // Try <img src="..."> inside content
  const imgMatch = itemXml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];

  return null;
};

// ─── OG Image fetcher (мэдээний хуудаснаас og:image татах) ────────
const fetchOgImage = async (url) => {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: {
        // Some publishers return different HTML (or block) based on headers.
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'mn,en-US;q=0.9,en;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) return null;
    const html = await response.text();

    const candidates = [];

    // og:image
    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch) candidates.push(resolveMaybeRelativeUrl(ogMatch[1], url));

    // twitter:image
    const twMatch =
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twMatch) candidates.push(resolveMaybeRelativeUrl(twMatch[1], url));

    // srcset: pick the largest candidate.
    const srcsetRegex = /\ssrcset=["']([^"']+)["']/gi;
    let srcsetMatch;
    while ((srcsetMatch = srcsetRegex.exec(html)) !== null) {
      const srcset = srcsetMatch[1];
      const parts = srcset
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      for (const part of parts) {
        // format: url 800w OR url 2x
        const segs = part.split(/\s+/).filter(Boolean);
        const candidateUrl = resolveMaybeRelativeUrl(segs[0], url);
        if (candidateUrl) candidates.push(candidateUrl);
      }
    }

    // As a fallback, also scan a few <img src="..."> in case srcset is absent.
    // Keep it conservative to avoid logos/icons.
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch;
    let imgCount = 0;
    while ((imgMatch = imgRegex.exec(html)) !== null && imgCount < 25) {
      imgCount += 1;
      const src = resolveMaybeRelativeUrl(imgMatch[1], url);
      if (!src) continue;
      const srcLower = src.toLowerCase();
      if (srcLower.includes('logo') || srcLower.includes('icon') || srcLower.includes('sprite')) continue;
      // Prefer publisher/content domains.
      if (srcLower.includes('ikon.mn')) candidates.push(src);
    }

    const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));
    let best = null;
    for (const candidate of uniqueCandidates) {
      if (isBetterImage(candidate, best)) best = candidate;
    }
    return best;
  } catch {
    return null;
  }
};

const ensureBestImage = async (article) => {
  if (!article) return article;

  const currentImage = article.image || null;
  const sourceUrl = article.sourceUrl || null;

  if (!sourceUrl) return article;

  // First: ikon.mn often ships resized images like *_800_x_400_*. Try to upgrade safely.
  if (currentImage && isIkonUrl(sourceUrl)) {
    const ikonUpgrade = await pickBestReachableImage(currentImage);
    if (isBetterImage(ikonUpgrade, currentImage)) {
      return { ...article, image: ikonUpgrade };
    }
  }

  // Next: try upgrading the existing image URL itself (common resized URL patterns).
  const upgradedCurrent = upgradeImageUrl(currentImage);
  if (isBetterImage(upgradedCurrent, currentImage)) {
    return { ...article, image: upgradedCurrent };
  }

  // If missing OR looks like a low-res thumbnail, try upgrading via og:image.
  // On high-DPI devices, even "800px wide" can look blurry in cards.
  // For ikon.mn, be more eager to upgrade when width is not clearly large.
  const ikonHeuristic = isIkonUrl(sourceUrl) && scoreImageUrl(currentImage) <= 900;
  if (!currentImage || looksLowRes(currentImage) || ikonHeuristic) {
    const ogImgRaw = await fetchOgImage(sourceUrl);
    const ogImg = upgradeImageUrl(ogImgRaw);
    if (isBetterImage(ogImg, currentImage)) {
      return { ...article, image: ogImg };
    }
  }

  return article;
};

const parseRssXml = (xml, feedUrl) => {
  const items = [];

  // Extract channel title
  const channelTitleMatch = xml.match(/<channel>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i);
  const feedTitle = channelTitleMatch ? extractCdata(channelTitleMatch[1]) : feedUrl;

  // Split items
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1];

    const titleArr = extractTagContent(itemXml, 'title');
    const descArr = extractTagContent(itemXml, 'description');
    const linkArr = extractTagContent(itemXml, 'link');
    const pubDateArr = extractTagContent(itemXml, 'pubDate');
    const creatorArr = extractTagContent(itemXml, 'dc:creator');
    const authorArr = extractTagContent(itemXml, 'author');
    const contentArr = extractTagContent(itemXml, 'content:encoded');

    items.push({
      title: extractCdata(titleArr[0] || ''),
      description: extractCdata(descArr[0] || ''),
      content: extractCdata(contentArr[0] || descArr[0] || ''),
      link: (linkArr[0] || '').replace(/<[^>]*>/g, '').trim(),
      pubDate: pubDateArr[0] || '',
      creator: extractCdata(creatorArr[0] || authorArr[0] || ''),
      thumbnail: extractImage(itemXml),
      feedTitle,
    });
  }

  return items;
};

// ─── Public API ────────────────────────────────────────────────────
export const newsApiService = {
  /**
   * NewsAPI.org-аас мэдээ татах
   * @param {string} category - sports, business, technology, health, science, general
   * @param {string} country - us, gb, mn гэх мэт (default: us)
   * @param {number} pageSize - хэдэн мэдээ авах (default: 10)
   */
  async fetchFromNewsApi({ category = 'general', country = 'us', pageSize = 10 } = {}) {
    const url =
      `https://newsapi.org/v2/top-headlines?` +
      `category=${category}&country=${country}&pageSize=${pageSize}&apiKey=${NEWS_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`NewsAPI error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    if (data.status !== 'ok') {
      throw new Error(data.message || 'NewsAPI returned an error.');
    }

    return (data.articles || []).map((raw) => normalizeNewsApiArticle(raw, category));
  },

  /**
   * GNews.io-аас мэдээ татах
   * @param {string} category - general, world, nation, business, technology, entertainment, sports, science, health
   * @param {string} lang - en, mn гэх мэт (default: en)
   * @param {number} max - хэдэн мэдээ авах (default: 10)
   */
  async fetchFromGNews({ category = 'general', lang = 'en', max = 10 } = {}) {
    const url =
      `https://gnews.io/api/v4/top-headlines?` +
      `category=${category}&lang=${lang}&max=${max}&apikey=${GNEWS_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GNews error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    return (data.articles || []).map((raw) => normalizeGNewsArticle(raw, category));
  },

  /**
   * RSS Feed-ээс мэдээ татах
   * Эхлээд шууд RSS XML татаж parse хийнэ, амжилтгүй бол proxy ашиглана
   * @param {string} feedUrl - RSS feed URL
   * @param {string} categoryHint - Энэ feed ямар ангилалд хамаарах
   */
  async fetchFromRss({ feedUrl, categoryHint = 'general' } = {}) {
    const errors = [];
    const isIkonFeed = isIkonFeedUrl(feedUrl);
    const ikonLatestLinkSet = isIkonFeed ? await fetchIkonLatestLinkSet() : null;

    // ── Арга 1: Шууд RSS XML татах ──
    try {
      const directResponse = await fetch(feedUrl, {
        headers: {
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'User-Agent': 'NEWSAP/1.0',
        },
      });

      if (directResponse.ok) {
        const xml = await directResponse.text();
        if (xml.includes('<item>') || xml.includes('<entry>')) {
          const items = parseRssXml(xml, feedUrl);
          if (items.length > 0) {
            const normalized = items.map((item) =>
              normalizeRssItem(item, categoryHint)
            );
            return isIkonFeed ? filterIkonLatestOnly(normalized, ikonLatestLinkSet) : normalized;
          }
        }
      }
    } catch (e) {
      errors.push(`Direct: ${e.message}`);
    }

    // ── Арга 2: rss2json.com proxy ──
    try {
      const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
      const proxyResponse = await fetch(proxyUrl);

      if (proxyResponse.ok) {
        const data = await proxyResponse.json();
        if (data.status === 'ok' && data.items?.length) {
          const normalized = data.items.map((item) =>
            normalizeRssItem({ ...item, feedTitle: data.feed?.title }, categoryHint)
          );
          return isIkonFeed ? filterIkonLatestOnly(normalized, ikonLatestLinkSet) : normalized;
        }
      }
    } catch (e) {
      errors.push(`rss2json: ${e.message}`);
    }

    // ── Арга 3: allorigins.win CORS proxy ──
    try {
      const corsProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
      const corsResponse = await fetch(corsProxyUrl);

      if (corsResponse.ok) {
        const xml = await corsResponse.text();
        if (xml.includes('<item>') || xml.includes('<entry>')) {
          const items = parseRssXml(xml, feedUrl);
          if (items.length > 0) {
            const normalized = items.map((item) =>
              normalizeRssItem(item, categoryHint)
            );
            return isIkonFeed ? filterIkonLatestOnly(normalized, ikonLatestLinkSet) : normalized;
          }
        }
      }
    } catch (e) {
      errors.push(`allorigins: ${e.message}`);
    }

    throw new Error(`RSS татах боломжгүй байна.\n${errors.join('\n')}`);
  },

  /**
   * Татаж авсан мэдээнүүдийг Firestore-д хадгалах (давхардлыг шалгана)
   * @param {Array} articles - normalizeApiArticle-аар бэлтгэсэн мэдээнүүд
   * @returns {{ imported: number, skipped: number }}
   */
  async saveToFirestore(articles) {
    const articlesRef = collection(firestoreDb, 'articles');
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    const importedTitles = [];

    // Бүх title-уудыг нэг удаа ачаалах (1 query)
    const existingTitles = await loadExistingTitles();

    for (const article of articles) {
      if (!article.title || article.title === '[Removed]') {
        skipped++;
        continue;
      }

      const titleKey = normalizeTitleKey(article.title);
      if (!titleKey) {
        skipped++;
        continue;
      }

      const existing = existingTitles.get(titleKey);

      // Try to improve the image before deciding what to do.
      const normalized = await ensureBestImage(article);

      if (existing) {
        // If already exists, upgrade its stored image when possible.
        if (existing.id && isBetterImage(normalized.image, existing.image)) {
          await setDoc(
            doc(firestoreDb, 'articles', existing.id),
            { image: normalized.image },
            { merge: true }
          );
          updated++;
          // Update cache copy as well.
          existingTitles.set(titleKey, { ...existing, image: normalized.image });
        }

        skipped++;
        continue;
      }

      await addDoc(articlesRef, normalized);
      existingTitles.set(titleKey, {
        id: null,
        image: normalized.image || null,
        sourceUrl: normalized.sourceUrl || null,
      });
      imported++;
      importedTitles.push(normalized.title);
    }

    // Шинэ мэдээ нэмэгдсэн бол cache-г цэвэрлэх
    if (imported > 0 || updated > 0) invalidateTitleCache();

    return { imported, skipped, updated, importedTitles };
  },

  /**
   * Нэг товчоор мэдээ татаж Firestore-д хадгалах (NewsAPI)
   */
  async importFromNewsApi(options = {}) {
    const articles = await this.fetchFromNewsApi(options);
    return this.saveToFirestore(articles);
  },

  /**
   * Нэг товчоор мэдээ татаж Firestore-д хадгалах (GNews)
   */
  async importFromGNews(options = {}) {
    const articles = await this.fetchFromGNews(options);
    return this.saveToFirestore(articles);
  },

  /**
   * Нэг товчоор RSS feed-ээс мэдээ татаж Firestore-д хадгалах
   */
  async importFromRss(options = {}) {
    const articles = await this.fetchFromRss(options);
    return this.saveToFirestore(articles);
  },

  /**
   * Олон ангилалаас мэдээ татах (bulk import)
   * @param {string} source - 'newsapi' | 'gnews'
   * @param {string[]} categories - ['sports', 'technology', 'business', ...]
   * @param {number} perCategory - ангилал тус бүрээс хэдийг авах
   */
  async bulkImport({ source = 'newsapi', categories = ['general'], perCategory = 5 } = {}) {
    let totalImported = 0;
    let totalSkipped = 0;
    const errors = [];

    for (const category of categories) {
      try {
        let result;
        if (source === 'gnews') {
          result = await this.importFromGNews({ category, max: perCategory });
        } else {
          result = await this.importFromNewsApi({ category, pageSize: perCategory });
        }
        totalImported += result.imported;
        totalSkipped += result.skipped;
      } catch (error) {
        errors.push(`${category}: ${error.message}`);
      }
    }

    return { imported: totalImported, skipped: totalSkipped, errors };
  },

  /**
   * Тодорхой Монгол мэдээний сайтуудын RSS feed-ээс мэдээ татах
   * Та доорх жагсаалтад өөрийн мэдээний сайтуудынхаа RSS URL-ийг нэмнэ
   */
  mongolianFeeds: [
    // ── IKON.mn (бүх мэдээ, ангилал автоматаар тодорхойлогдоно) ──
    { url: 'https://ikon.mn/rss', category: 'auto', name: 'IKON.mn' },
    // ── Olloo.mn ──
    { url: 'https://olloo.mn/feed', category: 'auto', name: 'Olloo.mn' },
  ],

  /**
   * Бүх Монгол мэдээний RSS feed-ээс мэдээ татах
   */
  async importMongolianFeeds() {
    let totalImported = 0;
    let totalSkipped = 0;
    const errors = [];
    const importedTitles = [];

    for (const feed of this.mongolianFeeds) {
      try {
        const articles = await this.fetchFromRss({
          feedUrl: feed.url,
          categoryHint: feed.category,
        });
        const result = await this.saveToFirestore(articles);
        totalImported += result.imported;
        totalSkipped += result.skipped;
        if (Array.isArray(result.importedTitles) && result.importedTitles.length > 0) {
          importedTitles.push(...result.importedTitles);
        }
      } catch (error) {
        errors.push(`${feed.name}: ${error.message}`);
      }
    }

    console.log('[IMPORT] totalImported:', totalImported, 'totalSkipped:', totalSkipped);
    return {
      imported: totalImported,
      skipped: totalSkipped,
      errors,
      firstImportedTitle: importedTitles[0] || null,
    };
  },

  /**
   * Firestore дахь бүх мэдээг дахин ангилах
   * detectCategory() ашиглан title, content дээр тулгуурлан categoryId, category шинэчилнэ
   */
  async reCategorizeAll() {
    const articlesRef = collection(firestoreDb, 'articles');
    const snapshot = await getDocs(articlesRef);
    let updated = 0;
    let skipped = 0;
    const summary = {};

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const title = data.title || '';
      const content = data.content || data.summary || '';

      if (!title) {
        skipped++;
        continue;
      }

      const cat = detectCategory(title, content);

      // Зөвхөн өөрчлөгдсөн бол шинэчлэх
      if (data.categoryId !== cat.id || data.category !== cat.name) {
        await setDoc(
          doc(firestoreDb, 'articles', docSnap.id),
          { category: cat.name, categoryId: cat.id },
          { merge: true }
        );
        updated++;
      } else {
        skipped++;
      }

      summary[cat.name] = (summary[cat.name] || 0) + 1;
    }

    return { total: snapshot.size, updated, skipped, summary };
  },
};
