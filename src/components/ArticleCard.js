import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '../theme/tokens';
import { t } from '../i18n/strings';

const resolveImageSource = (image) => {
  if (!image) {
    return null;
  }

  if (typeof image === 'string') {
    return { uri: image };
  }

  if (typeof image === 'object') {
    const uri = image.uri || image.url || image.imageUrl;
    return uri ? { uri } : null;
  }

  return null;
};

export const ArticleCard = ({ article, onPress, onSavePress, language = 'mn' }) => {
  const imageSource = resolveImageSource(article.image);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} accessibilityRole="button">
      {imageSource ? <Image source={imageSource} style={styles.image} resizeMode="cover" /> : null}

      <View style={styles.content}>
        <Text style={styles.category}>{article.category}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={styles.contentText} numberOfLines={3}>
          {article.content}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.meta}>{article.author}</Text>
          <Text style={styles.meta}>{article.publishedDate}</Text>
        </View>

        <View style={styles.actions}>
          <View style={styles.actionGroup}>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionIcon}>♡</Text>
              <Text style={styles.actionCount}>{article.likesCount || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionIcon}>◇</Text>
              <Text style={styles.actionCount}>{article.commentsCount || 0}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, article.isSaved && styles.saveBtnActive]}
            onPress={onSavePress}
            accessibilityRole="button"
            accessibilityLabel="Save article"
          >
            <Text style={[styles.saveIcon, article.isSaved && styles.saveIconActive]}>
              {article.isSaved ? '★' : '☆'}
            </Text>
            <Text style={[styles.saveLabel, article.isSaved && styles.saveLabelActive]}>
              {article.isSaved ? t(language, 'saved') : t(language, 'save')}
            </Text>
          </TouchableOpacity>
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
    height: 190,
    backgroundColor: colors.surfaceMuted,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.md,
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
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border + '40',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionIcon: {
    fontSize: 16,
    color: colors.textMuted,
  },
  actionCount: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  saveBtnActive: {
    backgroundColor: colors.primary + '25',
  },
  saveIcon: {
    fontSize: 14,
    color: colors.textMuted,
  },
  saveIconActive: {
    color: colors.primary,
  },
  saveLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  saveLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
