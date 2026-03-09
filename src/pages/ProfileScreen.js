import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Header, ProfileCard, SettingsSection } from '../components';
import { articleService, analyticsService } from '../services';
import { UserSettings } from '../models';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestoreDb } from '../config/firebase';
import { t, translateCategory } from '../i18n/strings';

export const ProfileScreen = ({
  user,
  language = 'mn',
  onLanguageChange,
  onLogout,
  onProfilePress,
  onNewsapPress,
  onAdminPress,
  onEditInterests,
}) => {
  const [settings, setSettings] = useState(new UserSettings(user?.id));
  const [stats, setStats] = useState({
    readCount: 0,
    savedCount: 0,
    interestCount: user?.interests?.length || 0,
    followersCount: 0,
    followingCount: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      const [history, saved] = await Promise.all([
        articleService.getReadingHistory(user?.id),
        articleService.getSavedArticles(user?.id),
      ]);

      setStats({
        readCount: history.length,
        savedCount: saved.length,
        interestCount: user?.interests?.length || 0,
        followersCount: 0,
        followingCount: 0,
      });

      if (user?.id) {
        const profileRef = doc(firestoreDb, 'users', user.id);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const profile = profileSnap.data();
          setSettings((prev) => ({
            ...prev,
            language: profile.language || prev.language,
          }));

          if (profile.language) {
            onLanguageChange?.(profile.language);
          }
        }
      }
    };

    loadStats();
  }, [user?.id]);

  const handleSettingChange = async (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));

    if (key === 'language') {
      onLanguageChange?.(value);
    }

    await analyticsService.track('setting_changed', {
      userId: user?.id,
      key,
      value,
    });

    if (user?.id) {
      await setDoc(
        doc(firestoreDb, 'users', user.id),
        {
          [key]: value,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="NEWSAP" language={language} onTitlePress={onNewsapPress} onProfilePress={onProfilePress} />
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileCard user={user} language={language} onEditPress={() => {}} />

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{t(language, 'saved_news')}</Text>
            <Text style={styles.summaryValue}>{stats.savedCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{t(language, 'read')}</Text>
            <Text style={styles.summaryValue}>{stats.readCount}</Text>
          </View>
        </View>

        {user?.interests?.length > 0 && (
          <View style={styles.interestsSection}>
            <View style={styles.interestsHeader}>
              <Text style={styles.interestsSectionTitle}>{t(language, 'interests')}</Text>
              {onEditInterests && (
                <Pressable onPress={onEditInterests}>
                  <Text style={styles.interestsEditBtn}>{t(language, 'interests_edit')}</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.interestsChips}>
              {user.interests.map((interest, idx) => {
                const INTEREST_ICONS = {
                  Sports: '⚽', Economy: '💰', Politics: '🏛️',
                  Technology: '💻', Health: '🏥', World: '🌍',
                };
                return (
                  <View key={idx} style={styles.chip}>
                    <Text style={styles.chipIcon}>{INTEREST_ICONS[interest] || '📰'}</Text>
                    <Text style={styles.chipText}>
                      {t(language, `category_${interest.toLowerCase()}`) || interest}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <SettingsSection
          settings={settings}
          language={language}
          onSettingChange={handleSettingChange}
          onLogout={onLogout}
          isAdmin={user?.role === 'admin'}
          onAdminPress={onAdminPress}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xxxl,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    minHeight: 88,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  summaryTitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  readSection: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '600',
  },
  readValue: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  interestsSection: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  interestsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  interestsSectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  interestsEditBtn: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  interestsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  chipIcon: {
    fontSize: 16,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
