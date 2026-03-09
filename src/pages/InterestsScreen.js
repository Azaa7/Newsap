import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestoreDb } from '../config/firebase';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { t, translateCategory } from '../i18n/strings';
import { defaultCategories } from '../services/mockData';

const categories = defaultCategories.filter((c) => c.id !== 0);

const ICONS = {
  Sports: '⚽',
  Economy: '💰',
  Politics: '🏛️',
  Technology: '💻',
  Health: '🏥',
  World: '🌍',
};

export const InterestsScreen = ({ user, language = 'mn', onComplete }) => {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggleCategory = (categoryId) => {
    setSelected((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleContinue = async () => {
    if (selected.length === 0) return;

    setSaving(true);
    try {
      const selectedNames = categories
        .filter((c) => selected.includes(c.id))
        .map((c) => c.name);

      if (user?.id) {
        await setDoc(
          doc(firestoreDb, 'users', user.id),
          {
            interests: selectedNames,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      onComplete?.({
        ...user,
        interests: selectedNames,
      });
    } catch (err) {
      console.warn('Failed to save interests:', err);
      onComplete?.({
        ...user,
        interests: categories
          .filter((c) => selected.includes(c.id))
          .map((c) => c.name),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t(language, 'interests_title')}</Text>
          <Text style={styles.subtitle}>{t(language, 'interests_subtitle')}</Text>
        </View>

        <View style={styles.grid}>
          {categories.map((category) => {
            const isSelected = selected.includes(category.id);
            return (
              <Pressable
                key={category.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => toggleCategory(category.id)}
              >
                <Text style={styles.cardIcon}>{ICONS[category.name] || '📰'}</Text>
                <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                  {translateCategory(language, category)}
                </Text>
                {isSelected && <View style={styles.checkBadge}><Text style={styles.checkMark}>✓</Text></View>}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.hint}>
          {selected.length === 0
            ? t(language, 'interests_min')
            : `${selected.length} ${t(language, 'interests_selected')}`}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.continueBtn, selected.length === 0 && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={selected.length === 0 || saving}
        >
          <Text style={styles.continueBtnText}>
            {saving ? t(language, 'interests_saving') : t(language, 'interests_continue')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl + 20,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  card: {
    width: '47%',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    position: 'relative',
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  cardIcon: {
    fontSize: 32,
  },
  cardLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardLabelSelected: {
    color: colors.focus,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  continueBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueBtnText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
});
