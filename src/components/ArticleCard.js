import React from 'react';
import { Image, PixelRatio, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '../theme/tokens';

const IMAGE_HEIGHT = 220;
const pixelRatio = PixelRatio.get();
const physicalWidth = Math.round(PixelRatio.getPixelSizeForLayoutSize(400));
const physicalHeight = Math.round(PixelRatio.getPixelSizeForLayoutSize(IMAGE_HEIGHT));
const highResWidth = Math.max(physicalWidth, 1800);
const highResHeight = Math.max(physicalHeight, 1200);

const isIkonImage = (url) => String(url || '').toLowerCase().includes('ikon.mn');

const upgradeLikelyThumbnailUrl = (url) => {
  const raw = String(url || '').trim();
  if (!raw) return raw;

  // ikon.mn style: _800_x_400_ → replace with larger size keeping aspect ratio
  let stripped = raw;
  const ikonDimMatch = raw.match(/_(\d{2,4})_x_(\d{2,4})_/i);
  if (ikonDimMatch) {
    const w = Number(ikonDimMatch[1]);
    const h = Number(ikonDimMatch[2]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      const ratio = w / h;
      const targetW = Math.max(w, 1600);
      const targetH = Math.max(1, Math.round(targetW / ratio));
      stripped = raw.replace(/_\d{2,4}_x_\d{2,4}_/i, `_${targetW}_x_${targetH}_`);
    }
  } else {
    // Common CMS thumbnail patterns — strip small dimensions from filename
    stripped = raw.replace(/([\-_])\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp|gif)(?:\?|$))/i, '');
  }

  try {
    const parsed = new URL(stripped);
    const bump = (key, target) => {
      const current = Number(parsed.searchParams.get(key));
      if (Number.isFinite(current) && current > 0 && current < target) {
        parsed.searchParams.set(key, String(target));
      }
    };

    bump('w', highResWidth);
    bump('width', highResWidth);
    bump('sz', highResWidth);
    bump('h', highResHeight);
    bump('height', highResHeight);

    return parsed.toString();
  } catch {
    return stripped;
  }
};

const resolveImageSource = (image) => {
  if (!image) {
    return null;
  }

  if (typeof image === 'string') {
    const uri = upgradeLikelyThumbnailUrl(image);
    if (!isIkonImage(uri)) {
      return { uri };
    }

    return {
      uri,
      headers: {
        Referer: 'https://ikon.mn/',
        'User-Agent': 'Mozilla/5.0',
      },
    };
  }

  if (typeof image === 'object') {
    const uri = image.uri || image.url || image.imageUrl;
    if (!uri) {
      return null;
    }

    const upgraded = upgradeLikelyThumbnailUrl(uri);
    if (!isIkonImage(upgraded)) {
      return { uri: upgraded };
    }

    return {
      uri: upgraded,
      headers: {
        Referer: 'https://ikon.mn/',
        'User-Agent': 'Mozilla/5.0',
      },
    };
  }

  return null;
};

const parseArticleTimestamp = (article) => {
  if (Number.isFinite(article?.publishedAt)) {
    return article.publishedAt;
  }

  const rawDate = article?.publishedDate || article?.date;
  const parsed = Date.parse(String(rawDate || ''));
  return Number.isNaN(parsed) ? null : parsed;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatDateLabel = ({ article, language = 'mn', showRelativeTodayTime = false }) => {
  const fallback = article?.publishedDate || article?.date || '';
  if (!showRelativeTodayTime) return fallback;

  const timestamp = parseArticleTimestamp(article);
  if (!Number.isFinite(timestamp)) return fallback;

  const now = new Date();
  const published = new Date(timestamp);
  if (!isSameDay(now, published)) {
    return fallback;
  }

  const diffMinutes = Math.max(1, Math.floor((now.getTime() - published.getTime()) / 60000));
  if (diffMinutes >= 120) {
    const diffHours = Math.max(2, Math.floor(diffMinutes / 60));
    return language === 'en' ? `${diffHours} hours ago` : `${diffHours} цагийн өмнө`;
  }

  return language === 'en' ? `${diffMinutes} min ago` : `${diffMinutes} минутын өмнө`;
};

export const ArticleCard = ({ article, onPress, variant = 'default', language = 'mn', showRelativeTodayTime = false }) => {
  const imageSource = resolveImageSource(article.image);
  const isTitleOnly = variant === 'titleOnly';
  const sourceLabel = article.source || article.sourceName || article.author;
  const dateLabel = formatDateLabel({ article, language, showRelativeTodayTime });
  const categoryLabel = article.category || 'General';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} accessibilityRole="button">
      {imageSource ? <Image source={imageSource} style={styles.image} resizeMode="cover" resizeMethod="scale" fadeDuration={120} /> : null}

      <View style={[styles.content, isTitleOnly ? styles.contentTitleOnly : null]}>
        <Text style={styles.category}>{categoryLabel}</Text>
        <Text style={styles.title} numberOfLines={isTitleOnly ? undefined : 2}>
          {article.title}
        </Text>

        {!isTitleOnly ? (
          <Text style={styles.contentText} numberOfLines={3}>
            {article.content}
          </Text>
        ) : null}

        <View style={[styles.footer, isTitleOnly ? styles.footerCompact : null]}>
          <Text style={styles.meta} numberOfLines={1}>
            {sourceLabel}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {dateLabel}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  image: {
    width: '100%',
    height: 220,
    backgroundColor: colors.surfaceMuted,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  contentTitleOnly: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  category: {
    ...typography.caption,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  contentText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  footerCompact: {
    marginTop: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
