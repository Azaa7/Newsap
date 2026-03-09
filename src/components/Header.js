import React from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '../theme/tokens';
import { t } from '../i18n/strings';

export const Header = ({ title = 'NEWSAP', subtitle, onProfilePress, onBackPress, onTitlePress, language = 'mn' }) => {
  const topInset = StatusBar.currentHeight || 0;

  return (
    <View style={[styles.container, { paddingTop: topInset + spacing.sm }]}> 
      {onBackPress ? (
        <TouchableOpacity style={styles.backButton} onPress={onBackPress} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.leftWrap}>
        {onTitlePress ? (
          <TouchableOpacity onPress={onTitlePress} style={styles.titleButton} accessibilityRole="button">
            <Text style={styles.title}>{title}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.title}>{title}</Text>
        )}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {onProfilePress ? (
        <TouchableOpacity style={styles.profileButton} onPress={onProfilePress}>
          <Text style={styles.profileText}>{t(language, 'profile')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    minHeight: 72,
    backgroundColor: colors.background,
  },
  leftWrap: {
    flex: 1,
  },
  titleButton: {
    alignSelf: 'flex-start',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  backArrow: {
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  title: {
    ...typography.h2,
    color: colors.primary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  profileButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
