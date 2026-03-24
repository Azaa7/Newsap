import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { ArticleDetail } from '../components';
import { articleService, analyticsService } from '../services';
import { colors } from '../theme/tokens';

export const ArticleDetailScreen = ({ navigation, route, language = 'mn', user }) => {
  const routeArticle = route?.params?.article || {
    id: 0,
    title: 'Article',
    content: 'No content available.',
    author: 'Unknown source',
    category: 'General',
    publishedDate: 'now',
    likesCount: 0,
    commentsCount: 0,
    isSaved: false,
    isLiked: false,
  };
  const initialArticle = articleService.applyLocalInteractionOverride(routeArticle);

  const [article, setArticle] = useState(initialArticle);
  const [recommendedArticles, setRecommendedArticles] = useState([]);

  useEffect(() => {
    setArticle(articleService.applyLocalInteractionOverride(initialArticle));
  }, [initialArticle?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadRecommended = async () => {
      try {
        const list = await articleService.getRecommendedArticles(user);
        if (!isMounted) return;

        const currentId = String(article?.id);
        const filtered = (list || [])
          .filter((item) => String(item?.id) !== currentId)
          .slice(0, 10)
          .map((item) => articleService.applyLocalInteractionOverride(item));

        setRecommendedArticles(filtered);
      } catch {
        if (!isMounted) return;
        setRecommendedArticles([]);
      }
    };

    loadRecommended();

    return () => {
      isMounted = false;
    };
  }, [article?.id, user?.id]);

  useEffect(() => {
    if (!user?.id || !article?.id) return;

    const localOverride = articleService.getLocalInteractionOverride(article.id);
    setArticle((prev) => ({
      ...prev,
      ...(localOverride.isLiked !== undefined ? { isLiked: localOverride.isLiked } : null),
      ...(localOverride.isSaved !== undefined ? { isSaved: localOverride.isSaved } : null),
    }));

    Promise.allSettled([
      articleService.getLikedIds(user.id),
      articleService.getSavedIds(user.id),
      articleService.getArticleLikeCount(article.id),
    ])
      .then(([likedResult, savedResult, likesCountResult]) => {
        const currentId = String(article.id);
        const likedSet = new Set(
          likedResult.status === 'fulfilled' ? (likedResult.value || []).map((id) => String(id)) : []
        );
        const savedSet = new Set(
          savedResult.status === 'fulfilled' ? (savedResult.value || []).map((id) => String(id)) : []
        );

        setArticle((prev) => {
          const nextState = { ...prev };

          if (likedResult.status === 'fulfilled') {
            nextState.isLiked = likedSet.has(currentId);
          }

          if (savedResult.status === 'fulfilled') {
            nextState.isSaved = savedSet.has(currentId);
          }

          if (likesCountResult.status === 'fulfilled' && Number.isFinite(likesCountResult.value)) {
            const localCount = Number(localOverride.likesCount);
            nextState.likesCount = Number.isFinite(localCount)
              ? Math.max(localCount, likesCountResult.value)
              : likesCountResult.value;
          }

          return nextState;
        });
      })
      .catch(() => {});
  }, [user?.id, article?.id]);

  const handleSave = (articleId, next) => {
    setArticle((prev) => ({ ...prev, isSaved: Boolean(next) }));
    articleService.setLocalInteractionOverride(articleId, { isSaved: Boolean(next) });

    articleService
      .toggleSaveArticle(user?.id, articleId, article)
      .then((actualSaved) => {
        const expectedSaved = Boolean(next);
        if (actualSaved !== expectedSaved) {
          setArticle((prev) => ({ ...prev, isSaved: actualSaved }));
          articleService.setLocalInteractionOverride(articleId, { isSaved: actualSaved });
        }
      })
      .catch(() => {
        // Backend алдаа гарсан ч UI дээр optimistic төлөвийг хадгална.
      });
    analyticsService.track('detail_toggle_save', {
      articleId,
    });
  };

  const handleLike = (articleId, next) => {
    const currentLikesCount = Number(article?.likesCount) || 0;
    const nextLikesCount = Math.max(0, currentLikesCount + (next ? 1 : -1));

    setArticle((prev) => {
      const previousLiked = Boolean(prev.isLiked);
      const nextLiked = Boolean(next);
      const delta = previousLiked === nextLiked ? 0 : nextLiked ? 1 : -1;
      return {
        ...prev,
        isLiked: nextLiked,
        likesCount: Math.max(0, (Number(prev.likesCount) || 0) + delta),
      };
    });
    articleService.setLocalInteractionOverride(articleId, {
      isLiked: Boolean(next),
      likesCount: nextLikesCount,
    });

    articleService
      .toggleLikeArticle(user?.id, articleId, article)
      .then((actualLiked) => {
        const expectedLiked = Boolean(next);
        if (actualLiked !== expectedLiked) {
          setArticle((prev) => {
            const correction = actualLiked ? 1 : -1;
            return {
              ...prev,
              isLiked: actualLiked,
              likesCount: Math.max(0, (Number(prev.likesCount) || 0) + correction),
            };
          });
          articleService.setLocalInteractionOverride(articleId, {
            isLiked: actualLiked,
            likesCount: Math.max(0, nextLikesCount + (actualLiked ? 1 : -1)),
          });
        }

        return articleService
          .getArticleLikeCount(articleId)
          .then((likesCount) => {
            if (!Number.isFinite(likesCount)) return;
            setArticle((prev) => ({ ...prev, likesCount }));
            articleService.setLocalInteractionOverride(articleId, { likesCount });
          })
          .catch(() => {
            // like count refresh алдаа гарсан ч isLiked state-г revert хийхгүй.
          });
      })
      .catch(() => {
        // Backend алдаа гарсан ч UI дээр optimistic төлөвийг хадгална.
      });

    analyticsService.track('detail_toggle_like', {
      articleId,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ArticleDetail
        article={article}
        recommendedArticles={recommendedArticles}
        language={language}
        onClose={() => navigation.goBack()}
        onOpenRecommended={(nextArticle) => {
          if (!nextArticle?.id) return;
          const mergedArticle = articleService.applyLocalInteractionOverride(nextArticle);
          articleService.markArticleRead(user?.id, mergedArticle).catch(() => {});
          navigation.push('ArticleDetail', { article: mergedArticle });
        }}
        onSave={handleSave}
        onLike={handleLike}
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
