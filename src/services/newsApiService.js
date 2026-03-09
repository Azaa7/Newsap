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
  // Гадаад гэсэн шууд үгс
  'гадаад', 'олон улс', 'олон улсын', 'дэлхийн', 'дэлхий дахин',
  // Улсуудын нэр
  'орос', 'хятад', 'америк', 'ащ', 'ес', 'европ', 'япон', 'солонгос',
  'энэтхэг', 'их британи', 'англи', 'франц', 'герман', 'турк', 'израиль',
  'иран', 'ирак', 'украин', 'тайван', 'австрали', 'канад',
  'нато', 'нүб', 'оухб',
  // Олон улсын харилцаа
  'хоёр талт', 'дипломат', 'элчин сайд', 'гэрээ хэлэлцээр',
  'дайн', 'зэвсэгт', 'цэрэг', 'довтолгоо', 'хориг арга хэмжээ',
  'шүүмжил', 'хамтын ажиллагаа',
  // Англи
  'international', 'global', 'foreign', 'united nations', 'nato',
  'russia', 'china', 'usa', 'europe', 'japan', 'korea', 'india',
  'ukraine', 'iran', 'israel', 'war', 'sanctions', 'diplomacy',
  'middle east', 'asia', 'africa', 'latin america',
];

/**
 * Мэдээний гарчиг, контент дээр тулгуурлан ангилал автоматаар тодорхойлох
 * @param {string} title - Мэдээний гарчиг
 * @param {string} content - Мэдээний агуулга
 * @returns {{ id: number, name: string }} - Тодорхойлсон ангилал
 */
const detectCategory = (title, content) => {
  const titleLower = title.toLowerCase();
  const text = `${titleLower} ${content}`.toLowerCase();
  const scores = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        score += 3;
      } else if (text.includes(keyword)) {
        score += 1;
      }
    }
    scores[category] = score;
  }

  // Гадаад мэдээ эсэхийг шалгах
  let worldScore = 0;
  for (const keyword of WORLD_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      worldScore += 3;
    } else if (text.includes(keyword)) {
      worldScore += 1;
    }
  }

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

  // Гадаад мэдээний оноо хамгийн өндөр бол → World
  if (worldScore > bestScore && worldScore >= 2) {
    return { id: 6, name: 'World' };
  }

  // 2+ оноотой бол тухайн ангилалыг шууд авна (Politics ч бай бусад ч бай)
  if (bestCategory && bestScore >= 2) {
    return { id: CAT_IDS[bestCategory] || 2, name: bestCategory };
  }

  // Ямар ч ангилалд тохирохгүй бол → Economy (Монгол мэдээний ихэнх нь эдийн засаг/нийгмийн)
  return { id: 2, name: 'Economy' };
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

const loadExistingTitles = async () => {
  const now = Date.now();
  if (_existingTitlesCache && now - _cacheTimestamp < TITLE_CACHE_TTL) {
    return _existingTitlesCache;
  }
  console.log('[IMPORT] Loading existing titles from Firestore...');
  const articlesRef = collection(firestoreDb, 'articles');
  const snapshot = await getDocs(articlesRef);
  const titles = new Set();
  snapshot.forEach((doc) => {
    const t = doc.data().title;
    if (t) titles.add(t);
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
      headers: { 'User-Agent': 'NEWSAP/1.0' },
    });
    if (!response.ok) return null;
    const html = await response.text();
    // og:image
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch) return ogMatch[1];
    // twitter:image
    const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twMatch) return twMatch[1];
    return null;
  } catch {
    return null;
  }
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
            return items.map((item) =>
              normalizeRssItem(item, categoryHint)
            );
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
          return data.items.map((item) =>
            normalizeRssItem({ ...item, feedTitle: data.feed?.title }, categoryHint)
          );
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
            return items.map((item) =>
              normalizeRssItem(item, categoryHint)
            );
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

    // Бүх title-уудыг нэг удаа ачаалах (1 query)
    const existingTitles = await loadExistingTitles();

    for (const article of articles) {
      if (!article.title || article.title === '[Removed]') {
        skipped++;
        continue;
      }

      if (existingTitles.has(article.title)) {
        skipped++;
        continue;
      }

      // Зураг байхгүй бол мэдээний хуудаснаас og:image татах
      if (!article.image && article.sourceUrl) {
        try {
          const ogImg = await fetchOgImage(article.sourceUrl);
          if (ogImg) article.image = ogImg;
        } catch {}
      }

      await addDoc(articlesRef, article);
      existingTitles.add(article.title); // cache-д нэмэх
      imported++;
    }

    // Шинэ мэдээ нэмэгдсэн бол cache-г цэвэрлэх
    if (imported > 0) invalidateTitleCache();

    return { imported, skipped };
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

    for (const feed of this.mongolianFeeds) {
      try {
        const articles = await this.fetchFromRss({
          feedUrl: feed.url,
          categoryHint: feed.category,
        });
        const result = await this.saveToFirestore(articles);
        totalImported += result.imported;
        totalSkipped += result.skipped;
      } catch (error) {
        errors.push(`${feed.name}: ${error.message}`);
      }
    }

    console.log('[IMPORT] totalImported:', totalImported, 'totalSkipped:', totalSkipped);
    return { imported: totalImported, skipped: totalSkipped, errors };
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
