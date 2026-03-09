import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { ArticleCard } from './ArticleCard';
import { colors, spacing } from '../theme/tokens';

export const NewsFeed = ({
  articles,
  onArticlePress,
  onSaveArticle,
  language = 'mn',
  ListEmptyComponent = null,
  ListHeaderComponent = null,
  refreshControl,
}) => {
  return (
    <FlatList
      data={articles}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <ArticleCard
          article={item}
          language={language}
          onPress={() => onArticlePress?.(item)}
          onSavePress={() => onSaveArticle?.(item.id)}
        />
      )}
      refreshControl={refreshControl}
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={ListHeaderComponent}
      contentContainerStyle={[
        styles.listContent,
        articles.length === 0 ? styles.listContentEmpty : undefined,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
});
