import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { t } from '../i18n/strings';

export const ProfileCard = ({ user, onEditPress, language = 'mn' }) => {
  const initials = (user?.name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const avatarUri = user?.profileImage || user?.photoURL || null;

  return (
    <View style={styles.container}>
      <View style={styles.identityRow}>
        <View style={styles.avatar}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>
        <View style={styles.identityTextWrap}>
          <Text style={styles.name}>{user?.name || t(language, 'user')}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
        <Text style={styles.editButtonText}>{t(language, 'edit_profile')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.md,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  identityTextWrap: {
    flex: 1,
  },
  name: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  email: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  editButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  editButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },

});
