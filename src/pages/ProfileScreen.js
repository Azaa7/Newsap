import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, Pressable, TouchableOpacity } from 'react-native';
import { Header, ProfileCard, SettingsSection } from '../components';
import { analyticsService, articleService, profileService } from '../services';
import { UserSettings } from '../models';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestoreDb } from '../config/firebase';
import { t } from '../i18n/strings';

export const ProfileScreen = ({
  user,
  language = 'mn',
  onLanguageChange,
  onLogout,
  onProfilePress,
  onNewsapPress,
  onSavedPress,
  onAdminPress,
  onEditInterests,
  onUserUpdate,
}) => {
  const [settings, setSettings] = useState(new UserSettings(user?.id));
  const [stats, setStats] = useState({
    readCount: 0,
    savedCount: 0,
    interestCount: user?.interests?.length || 0,
    followersCount: 0,
    followingCount: 0,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name || '');
  const [avatarDraftUri, setAvatarDraftUri] = useState(user?.profileImage || null);
  const [avatarUrlDraft, setAvatarUrlDraft] = useState(user?.profileImage || '');
  const [avatarDraftBase64, setAvatarDraftBase64] = useState(null);
  const [avatarDraftMimeType, setAvatarDraftMimeType] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const canSaveProfile = useMemo(() => {
    if (isSavingProfile) return false;
    const nextName = String(nameDraft || '').trim();
    const nameChanged = nextName.length > 0 && nextName !== String(user?.name || '').trim();
    const normalizedUrlDraft = String(avatarUrlDraft || '').trim();
    const currentUrl = String(user?.profileImage || '').trim();
    const avatarChanged = Boolean(avatarDraftBase64) || (normalizedUrlDraft.length > 0 && normalizedUrlDraft !== currentUrl);
    return nameChanged || avatarChanged;
  }, [avatarDraftBase64, avatarUrlDraft, isSavingProfile, nameDraft, user?.name, user?.profileImage]);

  useEffect(() => {
    const loadStats = async () => {
      if (!user?.id) return;

      const profileRef = doc(firestoreDb, 'users', user.id);
      try {
        const [savedIds, readCount] = await Promise.all([
          articleService.getSavedCount(user.id),
          articleService.getReadingHistoryCount(user.id),
        ]);

        setStats((prev) => ({
          ...prev,
          readCount,
          savedCount: savedIds,
          interestCount: user?.interests?.length || 0,
        }));
      } catch {
      }

      try {
        const profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) return;

        const profile = profileSnap.data();

        setSettings((prev) => ({
          ...prev,
          language: profile.language || prev.language,
        }));

        if (typeof profile.name === 'string') {
          setNameDraft(profile.name);
        }
        if (typeof profile.profileImage === 'string') {
          setAvatarDraftUri(profile.profileImage);
          setAvatarUrlDraft(profile.profileImage);
        }

        if (profile.language) {
          onLanguageChange?.(profile.language);
        }
      } catch {
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

  const handlePickAvatar = async () => {
    try {
      let ImagePicker = null;
      try {
        // Lazy require so app does not crash on clients/builds that don't include this native module.
        ImagePicker = require('expo-image-picker');
      } catch {
        Alert.alert(
          t(language, 'something_wrong'),
          'Image picker native module байхгүй байна. Доорх URL талбарт зургийн линк оруулж хадгална уу.'
        );
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(t(language, 'something_wrong'), 'Зургийн эрх (permission) зөвшөөрнө үү.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setAvatarDraftUri(asset.uri);
      setAvatarUrlDraft(asset.uri);
      setAvatarDraftBase64(asset.base64 || null);
      setAvatarDraftMimeType(asset.mimeType || 'image/jpeg');
    } catch (error) {
      Alert.alert(t(language, 'something_wrong'), String(error?.message || error));
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    const nextName = String(nameDraft || '').trim();
    if (!nextName) {
      Alert.alert(t(language, 'something_wrong'), `${t(language, 'name')} оруулна уу.`);
      return;
    }

    setIsSavingProfile(true);
    try {
      const updated = await profileService.updateProfile({
        userId: user.id,
        name: nextName,
        avatarBase64: avatarDraftBase64,
        avatarMimeType: avatarDraftMimeType,
        avatarUrl: avatarDraftBase64 ? null : String(avatarUrlDraft || '').trim(),
      });

      onUserUpdate?.(updated);

      if (updated?.profileImage) {
        setAvatarDraftUri(updated.profileImage);
        setAvatarUrlDraft(updated.profileImage);
      }
      setAvatarDraftBase64(null);
      setAvatarDraftMimeType(null);
      setIsEditing(false);

      analyticsService.track('profile_updated', {
        userId: user.id,
        nameChanged: updated?.name ? true : false,
        avatarChanged: updated?.profileImage ? true : false,
      });
    } catch (error) {
      Alert.alert(t(language, 'something_wrong'), String(error?.message || error));
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="NEWSAP" language={language} onTitlePress={onNewsapPress} onProfilePress={onProfilePress} />
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileCard
          user={{
            ...user,
            name: String(nameDraft || '').trim() || user?.name,
            profileImage: avatarDraftUri || user?.profileImage || null,
          }}
          language={language}
          onEditPress={() => setIsEditing((prev) => !prev)}
        />

        {isEditing ? (
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>{t(language, 'edit_profile')}</Text>

            <View style={styles.editRow}>
              <View style={styles.editAvatar}>
                {avatarDraftUri ? (
                  <Image source={{ uri: avatarDraftUri }} style={styles.editAvatarImg} resizeMode="cover" />
                ) : (
                  <Text style={styles.editAvatarPlaceholder}>👤</Text>
                )}
              </View>

              <TouchableOpacity style={styles.photoButton} onPress={handlePickAvatar} disabled={isSavingProfile}>
                <Text style={styles.photoButtonText}>{t(language, 'choose_photo')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>{t(language, 'name')}</Text>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder={t(language, 'name')}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!isSavingProfile}
              />
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Profile image URL</Text>
              <TextInput
                value={avatarUrlDraft}
                onChangeText={(value) => {
                  setAvatarUrlDraft(value);
                  if (!avatarDraftBase64) {
                    setAvatarDraftUri(value);
                  }
                }}
                placeholder="https://..."
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!isSavingProfile}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, !canSaveProfile && styles.saveButtonDisabled]}
              onPress={handleSaveProfile}
              disabled={!canSaveProfile}
            >
              {isSavingProfile ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator color={colors.textPrimary} />
                  <Text style={styles.saveButtonText}>{t(language, 'saving')}</Text>
                </View>
              ) : (
                <Text style={styles.saveButtonText}>{t(language, 'save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.summaryRow}>
          <Pressable style={styles.summaryCard} onPress={onSavedPress}>
            <Text style={styles.summaryTitle}>{t(language, 'saved_news')}</Text>
            <Text style={styles.summaryValue}>{stats.savedCount}</Text>
          </Pressable>
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

  editCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  editTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  editAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarImg: {
    width: '100%',
    height: '100%',
  },
  editAvatarPlaceholder: {
    fontSize: 22,
  },
  photoButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  inputBlock: {
    gap: spacing.xs,
  },
  inputLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    ...typography.body,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
