import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Header } from '../components';
import { articleService, newsApiService, notificationService } from '../services';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { t } from '../i18n/strings';

const categoryOptions = articleService.categories.filter((item) => item.id !== 0);

const emptyForm = {
  title: '',
  content: '',
  image: '',
  categoryId: 1,
};

export const AdminScreen = ({ user, language = 'mn', onBackPress }) => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importCategory, setImportCategory] = useState('general');
  const [importCount, setImportCount] = useState('5');
  const [customRssUrl, setCustomRssUrl] = useState('');

  const isEditing = useMemo(() => Boolean(editingId), [editingId]);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const rows = await articleService.getAdminArticles();
      setArticles(rows);
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to load articles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSelectForEdit = (article) => {
    setEditingId(article.id);
    setForm({
      title: article.title || '',
      content: article.content || '',
      image: article.image || '',
      categoryId: article.categoryId || 1,
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (isEditing) {
        await articleService.updateAdminArticle(editingId, form);
      } else {
        await articleService.createAdminArticle(form, user);
      }

      await loadArticles();
      resetForm();
      Alert.alert('Success', isEditing ? 'Article updated.' : 'Article created.');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Unable to save article.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (article) => {
    Alert.alert('Delete article', 'Are you sure you want to delete this article?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await articleService.deleteAdminArticle(article.id);
            if (editingId === article.id) {
              resetForm();
            }
            await loadArticles();
          } catch (error) {
            Alert.alert('Error', error?.message || 'Failed to delete article.');
          }
        },
      },
    ]);
  };

  const handleImport = async (source) => {
    if (source === 'test_notif') {
      try {
        await notificationService.sendLocalNotification({
          title: 'NEWSAP — Тест',
          body: 'Энэ тест notification. Амжилттай ажиллаж байна!',
          data: { type: 'test' },
          channelId: 'news',
        });
        Alert.alert('Амжилттай', 'Test notification илгэгдлээ!');
      } catch (err) {
        Alert.alert('Алдаа', err?.message || 'Notification илгэж чадсангүй');
      }
      return;
    }
    setImporting(true);
    try {
      let result;

      if (source === 'rss_mn') {
        result = await newsApiService.importMongolianFeeds();
      } else if (source === 'custom_rss') {
        if (!customRssUrl.trim()) {
          Alert.alert('Error', 'RSS URL оруулна уу.');
          setImporting(false);
          return;
        }
        const articles = await newsApiService.fetchFromRss({
          feedUrl: customRssUrl.trim(),
          categoryHint: importCategory,
        });
        result = await newsApiService.saveToFirestore(articles);
      }

      setImportModalVisible(false);
      await loadArticles();

      const msg = t(language, 'import_result')
        .replace('{imported}', result.imported || 0)
        .replace('{skipped}', result.skipped || 0);

      Alert.alert(
        t(language, 'import_success'),
        msg + (result.errors?.length ? '\n\n' + result.errors.join('\n') : '')
      );
    } catch (error) {
      Alert.alert(t(language, 'import_error'), error?.message || 'Unknown error');
    } finally {
      setImporting(false);
    }
  };

  const importCategoryOptions = [
    { key: 'general', label: 'General / World' },
    { key: 'sports', label: 'Sports' },
    { key: 'business', label: 'Business / Economy' },
    { key: 'technology', label: 'Technology' },
    { key: 'health', label: 'Health' },
    { key: 'science', label: 'Science' },
    { key: 'entertainment', label: 'Entertainment' },
  ];

  const feedGroups = [
    {
      label: 'Монгол мэдээ',
      feeds: newsApiService.mongolianFeeds,
    },
  ];

  const handleImportSingleFeed = async (feed) => {
    setImporting(true);
    try {
      const articles = await newsApiService.fetchFromRss({
        feedUrl: feed.url,
        categoryHint: feed.category,
      });
      const result = await newsApiService.saveToFirestore(articles);
      await loadArticles();

      const msg = t(language, 'import_result')
        .replace('{imported}', result.imported)
        .replace('{skipped}', result.skipped);

      Alert.alert(t(language, 'import_success'), `${feed.name}\n${msg}`);
    } catch (error) {
      Alert.alert(t(language, 'import_error'), `${feed.name}: ${error?.message}`);
    } finally {
      setImporting(false);
    }
  };

  const renderImportModal = () => (
    <Modal
      visible={importModalVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setImportModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t(language, 'import_news')}</Text>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* ── Бүх feed-ээс татах ── */}
            <TouchableOpacity
              style={[styles.importBtn, styles.importAllBtn]}
              onPress={() => handleImport('rss_mn')}
              disabled={importing}
            >
              <Text style={styles.importBtnText}>
                {importing ? t(language, 'importing') : t(language, 'import_rss_mn') + ' — Бүгдийг татах'}
              </Text>
            </TouchableOpacity>

            {/* ── Feed бүрчлэн сонгох ── */}
            {feedGroups.map((group) => (
              <View key={group.label} style={styles.feedGroup}>
                <Text style={styles.feedGroupLabel}>{group.label}</Text>
                {group.feeds.map((feed) => (
                  <TouchableOpacity
                    key={feed.url}
                    style={styles.feedRow}
                    onPress={() => handleImportSingleFeed(feed)}
                    disabled={importing}
                  >
                    <View style={styles.feedInfo}>
                      <Text style={styles.feedName}>{feed.name}</Text>
                      <Text style={styles.feedCategory}>{feed.category}</Text>
                    </View>
                    <Text style={styles.feedImportIcon}>+</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* ── Custom RSS ── */}
            <View style={styles.feedGroup}>
              <Text style={styles.feedGroupLabel}>{t(language, 'import_custom_rss')}</Text>
              <TextInput
                value={customRssUrl}
                onChangeText={setCustomRssUrl}
                style={styles.input}
                placeholder="https://example.com/rss"
                placeholderTextColor={colors.textMuted}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.importChipScroll}>
                <View style={styles.importChipRow}>
                  {importCategoryOptions.map((opt) => {
                    const active = importCategory === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setImportCategory(opt.key)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
              {customRssUrl.trim() ? (
                <TouchableOpacity
                  style={styles.importBtn}
                  onPress={() => handleImport('custom_rss')}
                  disabled={importing}
                >
                  <Text style={styles.importBtnText}>{t(language, 'import_custom_rss')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {importing ? (
              <View style={styles.importingWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.importingText}>{t(language, 'importing')}</Text>
              </View>
            ) : null}

            {/* ── Test Notification ── */}
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: '#43A047', marginTop: spacing.lg }]}
              onPress={() => handleImport('test_notif')}
            >
              <Text style={styles.importBtnText}>🔔 Test Notification</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={styles.secondaryBtnWide}
            onPress={() => setImportModalVisible(false)}
            disabled={importing}
          >
            <Text style={styles.secondaryBtnText}>{t(language, 'back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderArticleRow = ({ item }) => (
    <View style={styles.articleRow}>
      <View style={styles.articleInfoInline}>
        <Text style={styles.articleTitle} numberOfLines={1}>
          {item.title}
        </Text>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity style={styles.secondaryBtnInline} onPress={() => handleSelectForEdit(item)}>
          <Text style={styles.secondaryBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerBtnInline} onPress={() => handleDelete(item)}>
          <Text style={styles.dangerBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title={t(language, 'admin_panel')} language={language} onBackPress={onBackPress} />

      {renderImportModal()}

      <FlatList
        data={articles}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderArticleRow}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* Import button */}
            <TouchableOpacity
              style={styles.importTriggerBtn}
              onPress={() => setImportModalVisible(true)}
            >
              <Text style={styles.importTriggerText}>{t(language, 'import_news')} +</Text>
            </TouchableOpacity>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>{isEditing ? 'Edit article' : 'Create article'}</Text>

              <TextInput
                value={form.title}
                onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
                placeholder="Title"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <TextInput
                value={form.content}
                onChangeText={(value) => setForm((prev) => ({ ...prev, content: value }))}
                placeholder="Content"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.textArea]}
                multiline
              />

              <TextInput
                value={form.image}
                onChangeText={(value) => setForm((prev) => ({ ...prev, image: value }))}
                placeholder="Image URL"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <View style={styles.chipRow}>
                {categoryOptions.map((category) => {
                  const active = form.categoryId === category.id;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setForm((prev) => ({ ...prev, categoryId: category.id }))}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{category.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.formActions}>
                {isEditing ? (
                  <TouchableOpacity style={styles.secondaryBtnWide} onPress={resetForm}>
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity style={styles.primaryBtnWide} onPress={handleSubmit} disabled={saving}>
                  <Text style={styles.primaryBtnText}>{saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No articles yet.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  formTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryBtnWide: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  secondaryBtnWide: {
    minWidth: 110,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
  },
  articleRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  articleInfoInline: {
    flex: 1,
  },
  articleTitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  secondaryBtnInline: {
    minHeight: 32,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
  },
  secondaryBtnText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  dangerBtnInline: {
    minHeight: 32,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
  },
  dangerBtnText: {
    ...typography.bodySmall,
    color: colors.danger,
    fontWeight: '700',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  importTriggerBtn: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success || '#22c55e',
    marginBottom: spacing.md,
  },
  importTriggerText: {
    ...typography.bodySmall,
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '85%',
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  importChipScroll: {
    maxHeight: 44,
  },
  importChipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  importBtnGroup: {
    gap: spacing.sm,
  },
  importBtn: {
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
  },
  importBtnText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  importingWrap: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  importingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  modalScroll: {
    maxHeight: 420,
  },
  importAllBtn: {
    backgroundColor: colors.success || '#22c55e',
    marginBottom: spacing.md,
  },
  feedGroup: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  feedGroupLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  feedInfo: {
    flex: 1,
  },
  feedName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  feedCategory: {
    ...typography.caption,
    color: colors.textMuted,
  },
  feedImportIcon: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
  },
});
