import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Header, SearchBar, CategoryFilter, NewsFeed } from '../components';
import { articleService, analyticsService } from '../services';
import { colors, spacing, typography } from '../theme/tokens';
import { t, translateCategory } from '../i18n/strings';

const toSearchable = (value) => String(value || '').toLowerCase();

const matchesQuery = (article, searchText) => {
  const query = toSearchable(searchText).trim();
  if (!query) {
    return true;
  }

  const tokens = query.split(/\s+/g).filter(Boolean);
  const haystack = [article.title, article.content, article.author, article.category]
    .map(toSearchable)
    .join(' ');

  return tokens.every((token) => haystack.includes(token));
};

export const HomeScreen = ({ user, language = 'mn', onOpenArticle, onProfilePress }) => {
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [feedMode, setFeedMode] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const searchTimerRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const categories = articleService.categories;
  const translatedCategories = categories.map((category) => ({
    ...category,
    name: translateCategory(language, category),
  }));

  // Debounce search — 400ms хүлээнэ
  const handleSearch = useCallback((text) => {
    setSearchText(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(text), 400);
  }, []);

  const loadArticles = async ({ isRefresh = false } = {}) => {
    if (!isRefresh) {
      setLoading(true);
    }
    setError('');

    try {
      let sourceArticles = [];

      if (feedMode === 'recommended') {
        sourceArticles = await articleService.getRecommendedArticles(user);
      } else if (feedMode === 'world') {
        sourceArticles = await articleService.getFeed({ categoryId: 6, limit: 50 });
      } else {
        sourceArticles = await articleService.getFeed({
          categoryId: selectedCategory,
          searchText: debouncedSearch,
        });
      }

      const filteredArticles =
        feedMode === 'all'
          ? sourceArticles
          : sourceArticles.filter((article) => {
              const matchesCategory = selectedCategory === 0 || article.categoryId === selectedCategory;
              return matchesCategory && matchesQuery(article, debouncedSearch);
            });

      const withSaved = await articleService.enrichWithSaved(user?.id, filteredArticles);
      setArticles(withSaved);

      analyticsService.track('feed_loaded', {
        mode: feedMode,
        categoryId: selectedCategory,
        searchText: debouncedSearch,
        count: withSaved.length,
      });
    } catch (loadError) {
      setError('Unable to load articles. Pull to refresh and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, [feedMode, selectedCategory, debouncedSearch]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadArticles({ isRefresh: true });
  };

  const handleOpenArticle = (article) => {
    // Background-д уншсан гэж тэмдэглэх (navigate-г хүлээхгүй)
    articleService.markArticleRead(user?.id, article).catch(() => {});
    onOpenArticle?.(article);
  };

  const handleSave = useCallback(async (articleId) => {
    // Optimistic update — UI шууд шинэчлэх
    setArticles((prev) =>
      prev.map((a) => (a.id === articleId ? { ...a, isSaved: !a.isSaved } : a))
    );

    // Background-д Firestore руу хадгалах
    articleService.toggleSaveArticle(user?.id, articleId).catch(() => {
      // Revert on failure
      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, isSaved: !a.isSaved } : a))
      );
    });
  }, [user?.id]);

  const ListEmpty = () => (
    <View style={styles.stateContainer}>
      <Text style={styles.stateTitle}>{t(language, 'no_articles')}</Text>
      <Text style={styles.stateText}>{t(language, 'try_other_filters')}</Text>
    </View>
  );

  const ListError = () => (
    <View style={styles.stateContainer}>
      <Text style={styles.errorTitle}>{t(language, 'something_wrong')}</Text>
      <Text style={styles.stateText}>{error}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="NEWSAP" language={language} onProfilePress={onProfilePress} />
      <SearchBar language={language} onSearch={handleSearch} />
      <CategoryFilter
        categories={translatedCategories}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
        feedMode={feedMode}
        onFeedModeChange={setFeedMode}
        language={language}
      />

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.stateText}>{t(language, 'loading_articles')}</Text>
        </View>
      ) : error ? (
        <NewsFeed
          articles={[]}
          language={language}
          onArticlePress={handleOpenArticle}
          onSaveArticle={handleSave}
          ListHeaderComponent={<ListError />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        />
      ) : (
        <NewsFeed
          articles={articles}
          language={language}
          onArticlePress={handleOpenArticle}
          onSaveArticle={handleSave}
          ListEmptyComponent={<ListEmpty />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
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
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  stateTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  errorTitle: {
    ...typography.h3,
    color: colors.danger,
  },
  stateText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
