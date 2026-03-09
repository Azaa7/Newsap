import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { ArticleDetail } from '../components';
import { articleService, analyticsService } from '../services';
import { colors } from '../theme/tokens';

export const ArticleDetailScreen = ({ navigation, route, language = 'mn' }) => {
  const article = route?.params?.article || {
    id: 0,
    title: 'Article',
    content: 'No content available.',
    author: 'Unknown source',
    category: 'General',
    publishedDate: 'now',
    likesCount: 0,
    commentsCount: 0,
    isSaved: false,
  };

  const handleSave = () => {
    articleService.toggleSaveArticle(null, article.id).catch(() => {});
    analyticsService.track('detail_toggle_save', {
      articleId: article.id,
    });
  };

  const handleShare = () => {
    analyticsService.track('detail_share', {
      articleId: article.id,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ArticleDetail
        article={article}
        language={language}
        onClose={() => navigation.goBack()}
        onSave={handleSave}
        onShare={handleShare}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
