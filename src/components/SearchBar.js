import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { t } from '../i18n/strings';

export const SearchBar = ({ onSearch, placeholder, language = 'mn' }) => {
  const [searchText, setSearchText] = useState('');

  const handleClear = () => {
    setSearchText('');
    onSearch?.('');
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch?.(searchText);
    }, 450);

    return () => clearTimeout(timer);
  }, [searchText, onSearch]);

  return (
    <View style={styles.container}>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder={placeholder || t(language, 'search_news')}
          placeholderTextColor={colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          accessibilityLabel="Search news"
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.iconButton}
          onPress={searchText ? handleClear : undefined}
          accessibilityRole="button"
          accessibilityLabel="Search"
          activeOpacity={0.8}
        >
          <Text style={styles.iconText}>⌕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  inputWrap: {
    minHeight: 50,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.body,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  iconText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '700',
  },
});
