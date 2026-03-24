import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Header, NewsFeed } from '../components';
import { articleService } from '../services';
import { colors, spacing, typography } from '../theme/tokens';
import { t } from '../i18n/strings';

export const SavedScreen = ({ user, language = 'mn', onBackPress, onOpenArticle }) => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = async () => {
    setLoading(true);
    const list = await articleService.getSavedArticles(user?.id);
    setArticles(list);
    setLoading(false);
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const handleSave = async (articleId) => {
    const articleObj = articles.find((a) => a.id === articleId);
    await articleService.toggleSaveArticle(user?.id, articleId, articleObj);
    await loadSaved();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={t(language, 'saved_news')}
        subtitle={language === 'en' ? 'Your bookmarked articles' : 'Таны хадгалсан нийтлэлүүд'}
        onBackPress={onBackPress}
      />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <NewsFeed
          articles={articles}
          onArticlePress={onOpenArticle}
          onSaveArticle={handleSave}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {language === 'en' ? 'No saved articles yet.' : 'Одоогоор хадгалсан мэдээ алга байна.'}
            </Text>
          }
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
