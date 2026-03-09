import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { t } from '../i18n/strings';

const modeList = ['all', 'recommended'];

export const CategoryFilter = ({
  categories,
  onCategorySelect,
  selectedCategory,
  feedMode = 'all',
  onFeedModeChange,
  language = 'mn',
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedCategoryName = useMemo(() => {
    const found = categories.find((item) => item.id === selectedCategory);
    return found?.name || t(language, 'category_all');
  }, [categories, selectedCategory, language]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.topNavRow}>
        <TouchableOpacity style={styles.menuButton} onPress={() => setDrawerOpen(true)} accessibilityRole="button">
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>

        <View style={styles.rightBalance} pointerEvents="none" />

        <View style={styles.modeTabs}>
          {modeList.map((mode) => {
            const isActive = mode === feedMode;
            const modeKey = mode === 'all' ? 'nav_all' : mode === 'world' ? 'nav_world' : 'nav_recommended';
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.modeTab, isActive && styles.modeTabActive]}
                onPress={() => onFeedModeChange?.(mode)}
                accessibilityRole="button"
              >
                <Text style={[styles.modeText, isActive && styles.modeTextActive]}>{t(language, modeKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.selectedCategoryBar}>
        <Text style={styles.selectedCategoryText}>{selectedCategoryName}</Text>
      </View>

      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.overlayRoot}>
          <Pressable style={styles.overlayBackdrop} onPress={() => setDrawerOpen(false)} />
          <View style={styles.drawerPanel}>
            {categories.map((category) => {
              const isActive = selectedCategory === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.drawerItem, isActive && styles.drawerItemActive]}
                  onPress={() => {
                    onCategorySelect(category.id);
                    setDrawerOpen(false);
                  }}
                >
                  <Text style={[styles.drawerItemText, isActive && styles.drawerItemTextActive]}>{category.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
  },
  topNavRow: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  menuButton: {
    position: 'absolute',
    left: spacing.lg,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  modeTabs: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightBalance: {
    position: 'absolute',
    right: spacing.lg,
    top: 0,
    width: 36,
    height: 36,
  },
  modeTab: {
    paddingHorizontal: spacing.md,
    minHeight: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modeTextActive: {
    color: colors.textPrimary,
  },
  selectedCategoryBar: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    minHeight: 30,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  selectedCategoryText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    textAlign: 'center',
  },
  overlayRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  drawerPanel: {
    width: '68%',
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  drawerItem: {
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  drawerItemActive: {
    backgroundColor: colors.primary,
  },
  drawerItemText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  drawerItemTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
