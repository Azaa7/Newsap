import React from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

export const CategorySidebar = ({ categories, selectedCategory, onCategorySelect }) => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.categoriesList}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryItem,
              selectedCategory === category.id && styles.activeCategoryItem,
            ]}
            onPress={() => onCategorySelect(category.id)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category.id && styles.activeCategoryText,
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 200,
    backgroundColor: colors.background,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  categoriesList: {
    paddingVertical: spacing.sm,
  },
  categoryItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  activeCategoryItem: {
    backgroundColor: colors.primary,
  },
  categoryText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: '500',
  },
  activeCategoryText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
