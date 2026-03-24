import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Header, SearchBar, CategoryFilter, NewsFeed } from '../components';
import { articleService } from '../services';
import { colors, spacing, typography } from '../theme/tokens';

export const ExploreScreen = ({ user, onOpenArticle }) => {
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const all = await articleService.getFeed({
      categoryId: selectedCategory,
      searchText,
    });
    const withSaved = await articleService.enrichWithSaved(user?.id, all);
    setArticles(withSaved);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedCategory, searchText]);

  const handleSave = async (articleId) => {
    const articleObj = articles.find((a) => a.id === articleId);
    await articleService.toggleSaveArticle(user?.id, articleId, articleObj);
    await load();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Explore" subtitle="Search topics and sources" />
      <SearchBar onSearch={setSearchText} placeholder="Search by title, author, keyword" />
      <CategoryFilter
        categories={articleService.categories}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Searching stories...</Text>
        </View>
      ) : (
        <NewsFeed
          articles={articles}
          onArticlePress={onOpenArticle}
          onSaveArticle={handleSave}
          ListEmptyComponent={<Text style={styles.emptyText}>No results found.</Text>}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
});
