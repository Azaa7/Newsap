import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Header, NewsFeed } from '../components';
import { articleService } from '../services';
import { colors, spacing, typography } from '../theme/tokens';

export const SavedScreen = ({ user, onOpenArticle }) => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = async () => {
    setLoading(true);
    const list = await articleService.getSavedArticles(user?.id);
    const withSaved = await articleService.enrichWithSaved(user?.id, list);
    setArticles(withSaved);
    setLoading(false);
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const handleSave = async (articleId) => {
    await articleService.toggleSaveArticle(user?.id, articleId);
    await loadSaved();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Saved" subtitle="Your bookmarked articles" />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <NewsFeed
          articles={articles}
          onArticlePress={onOpenArticle}
          onSaveArticle={handleSave}
          ListEmptyComponent={<Text style={styles.emptyText}>No saved articles yet.</Text>}
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
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
});
