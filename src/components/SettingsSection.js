import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';
import { t } from '../i18n/strings';

const ToggleChip = ({ active, label, onPress }) => (
  <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export const SettingsSection = ({ settings, onSettingChange, onLogout, isAdmin = false, onAdminPress, language = 'mn' }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t(language, 'settings')}</Text>

      <Text style={styles.subTitle}>{t(language, 'language')}</Text>
      <View style={styles.langRow}>
        <ToggleChip
          label="English"
          active={settings.language === 'en'}
          onPress={() => onSettingChange('language', 'en')}
        />
        <ToggleChip
          label={language === 'en' ? 'Mongolian' : 'Монгол'}
          active={settings.language === 'mn'}
          onPress={() => onSettingChange('language', 'mn')}
        />
      </View>

      {isAdmin ? (
        <TouchableOpacity style={styles.adminButton} onPress={onAdminPress}>
          <Text style={styles.adminText}>{t(language, 'admin_panel')}</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.grayButton}>
        <Text style={styles.grayText}>{t(language, 'privacy_security')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.grayButton}>
        <Text style={styles.grayText}>{t(language, 'help')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>{t(language, 'logout')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  langRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  chip: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chipTextActive: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  adminButton: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  adminText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  grayButton: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  grayText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  logoutButton: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  logoutText: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: '700',
  },
});
