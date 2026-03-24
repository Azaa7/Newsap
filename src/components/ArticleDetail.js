import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { t } from '../i18n/strings';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_HEIGHT = 360;

const resolveImageSource = (image) => {
  if (!image) return null;
  if (typeof image === 'string') return { uri: image };
  if (typeof image === 'object') {
    const uri = image.uri || image.url || image.imageUrl;
    return uri ? { uri } : null;
  }
  return null;
};

// ─── Format date nicely ─────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Дөнгөж сая';
    if (diffMins < 60) return `${diffMins} мин өмнө`;
    if (diffHrs < 24) return `${diffHrs} цагийн өмнө`;
    if (diffDays < 7) return `${diffDays} өдрийн өмнө`;

    return d.toLocaleDateString('mn-MN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

// ─── Icon buttons ────────────────────────────────────────────────────────
const IconBtn = ({ icon, label, active, onPress, variant = 'default' }) => (
  <TouchableOpacity
    style={[
      styles.iconBtn,
      variant === 'primary' && styles.iconBtnPrimary,
      active && styles.iconBtnActive,
    ]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    activeOpacity={0.7}
  >
    <Text style={styles.iconBtnEmoji}>{icon}</Text>
    <Text
      style={[
        styles.iconBtnLabel,
        variant === 'primary' && styles.iconBtnLabelPrimary,
        active && styles.iconBtnLabelActive,
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const RecommendedCard = ({ item, onPress }) => {
  const imageSource = resolveImageSource(item?.image);

  return (
    <TouchableOpacity style={styles.recommendedCard} onPress={onPress} activeOpacity={0.85}>
      {imageSource ? (
        <Image source={imageSource} style={styles.recommendedImage} resizeMode="cover" resizeMethod="resize" />
      ) : (
        <View style={styles.recommendedPlaceholder}>
          <Text style={styles.recommendedPlaceholderIcon}>📰</Text>
        </View>
      )}
      <View style={styles.recommendedMetaRow}>
        <Text style={styles.recommendedCategory} numberOfLines={1}>{item?.category || 'General'}</Text>
        <Text style={styles.recommendedDate} numberOfLines={1}>{formatDate(item?.publishedDate)}</Text>
      </View>
      <Text style={styles.recommendedTitle} numberOfLines={2}>{item?.title || ''}</Text>
    </TouchableOpacity>
  );
};

export const ArticleDetail = ({
  article,
  onClose,
  onSave,
  onLike,
  language = 'mn',
  recommendedArticles = [],
  onOpenRecommended,
}) => {
  const [isSaved, setIsSaved] = useState(Boolean(article?.isSaved));
  const [isLiked, setIsLiked] = useState(Boolean(article?.isLiked));
  const scrollY = useRef(new Animated.Value(0)).current;
  const imageSource = resolveImageSource(article?.image);
  const topInset = StatusBar.currentHeight || 0;
  const niceDate = formatDate(article?.publishedDate);
  const likeCount = Math.max(0, Number(article?.likesCount) || 0);
  const likeCountLabel = `${likeCount} ${t(language, 'likes')}`;

  useEffect(() => {
    setIsSaved(Boolean(article?.isSaved));
    setIsLiked(Boolean(article?.isLiked));
  }, [article?.id, article?.isSaved, article?.isLiked]);

  const handleSave = () => {
    const next = !isSaved;
    setIsSaved(next);
    onSave?.(article.id, next);
  };

  const handleLike = () => {
    const next = !isLiked;
    setIsLiked(next);
    onLike?.(article.id, next);
  };

  // Parallax header opacity
  const headerBg = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT - 80],
    outputRange: ['transparent', colors.background],
    extrapolate: 'clamp',
  });

  const heroOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT - 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Split content into paragraphs
  const paragraphs = (article?.content || '')
    .split(/\n\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Floating header ── */}
      <Animated.View style={[styles.floatingHeader, { paddingTop: topInset + spacing.sm, backgroundColor: headerBg }]}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
          <View style={styles.backChevron} />
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleLike} style={styles.headerIconBtn} activeOpacity={0.7}>
            <Text style={styles.headerIcon}>{isLiked ? '♥' : '♡'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={styles.headerIconBtn} activeOpacity={0.7}>
            <Text style={styles.headerIcon}>{isSaved ? '★' : '☆'}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Scrollable content ── */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
      >
        {/* Hero image */}
        {imageSource ? (
          <Animated.View style={{ opacity: heroOpacity }}>
            <Image source={imageSource} style={styles.heroImage} resizeMode="cover" resizeMethod="resize" />
            <View style={styles.heroOverlay} />
          </Animated.View>
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroPlaceholderIcon}>📰</Text>
          </View>
        )}

        {/* Article body card */}
        <View style={styles.bodyCard}>
          {/* Category badge */}
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{article.category}</Text>
            </View>
            <View style={styles.metaStack}>
              <Text style={styles.likeCount}>♥ {likeCountLabel}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{article.title}</Text>

          {/* Author & date strip */}
          <View style={styles.authorStrip}>
            <View style={styles.authorAvatar}>
              <Text style={styles.authorAvatarText}>
                {(article.author || 'N')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{article.author || 'NEWSAP'}</Text>
              <Text style={styles.dateText}>{niceDate}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Body paragraphs */}
          {paragraphs.length > 0 ? (
            paragraphs.map((para, i) => (
              <Text key={i} style={styles.bodyText}>
                {i === 0 ? (
                  <>
                    <Text style={styles.dropCap}>{para[0]}</Text>
                    {para.slice(1)}
                  </>
                ) : (
                  para
                )}
              </Text>
            ))
          ) : (
            <Text style={styles.bodyText}>{article.content}</Text>
          )}

          {/* Source link */}
          {article.url ? (
            <View style={styles.sourceBox}>
              <Text style={styles.sourceLabel}>Эх сурвалж</Text>
              <Text style={styles.sourceUrl} numberOfLines={1}>
                {article.url}
              </Text>
            </View>
          ) : null}

          {recommendedArticles.length > 0 ? (
            <View style={styles.recommendedSection}>
              <Text style={styles.recommendedHeading}>{t(language, 'nav_recommended')}</Text>
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recommendedList}
              >
                {recommendedArticles.map((item) => (
                  <RecommendedCard
                    key={String(item.id)}
                    item={item}
                    onPress={() => onOpenRecommended?.(item)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* ── Bottom action bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: spacing.md }]}>
        <IconBtn
          icon={isLiked ? '♥' : '♡'}
          label={isLiked ? t(language, 'liked') : t(language, 'like')}
          active={isLiked}
          onPress={handleLike}
        />
        <IconBtn
          icon={isSaved ? '★' : '☆'}
          label={isSaved ? t(language, 'saved') : t(language, 'save')}
          active={isSaved}
          onPress={handleSave}
          variant="primary"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Floating header ──
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    width: 12,
    height: 12,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#fff',
    transform: [{ rotate: '45deg' }, { translateX: 1 }],
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 18,
    color: '#fff',
  },

  // ── Hero ──
  heroImage: {
    width: SCREEN_W,
    height: HERO_HEIGHT,
    backgroundColor: colors.surfaceMuted,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  heroPlaceholder: {
    width: SCREEN_W,
    height: HERO_HEIGHT * 0.6,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholderIcon: {
    fontSize: 56,
    opacity: 0.3,
  },

  // ── Body card ──
  bodyCard: {
    marginTop: -spacing.xxl,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    minHeight: 400,
  },

  // ── Category ──
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  categoryBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  categoryText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metaStack: {
    alignItems: 'flex-end',
    gap: 2,
  },
  likeCount: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },

  // ── Title ──
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },

  // ── Author strip ──
  authorStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  authorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  dateText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.xl,
    opacity: 0.5,
  },

  // ── Body text ──
  bodyText: {
    fontSize: 16.5,
    lineHeight: 28,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    letterSpacing: 0.2,
  },
  dropCap: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    color: colors.primary,
  },

  // ── Source box ──
  sourceBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  sourceLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  sourceUrl: {
    ...typography.bodySmall,
    color: colors.primary,
  },

  // ── Recommended ──
  recommendedSection: {
    marginTop: spacing.md,
  },
  recommendedHeading: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  recommendedList: {
    paddingRight: spacing.sm,
    gap: spacing.md,
  },
  recommendedCard: {
    width: Math.min(SCREEN_W * 0.72, 280),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  recommendedImage: {
    width: '100%',
    height: 120,
    backgroundColor: colors.surfaceMuted,
  },
  recommendedPlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendedPlaceholderIcon: {
    fontSize: 28,
    opacity: 0.4,
  },
  recommendedMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  recommendedCategory: {
    ...typography.caption,
    color: colors.primary,
    flex: 1,
    textTransform: 'uppercase',
  },
  recommendedDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  recommendedTitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },

  // ── Bottom bar ──
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background + 'F0',
    borderTopWidth: 1,
    borderTopColor: colors.border + '30',
  },

  // ── Icon buttons ──
  iconBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  iconBtnActive: {
    backgroundColor: colors.primary + '30',
    borderColor: colors.primary,
  },
  iconBtnEmoji: {
    fontSize: 16,
  },
  iconBtnLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  iconBtnLabelPrimary: {
    color: '#fff',
    fontWeight: '700',
  },
  iconBtnLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
