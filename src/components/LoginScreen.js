import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

export const LoginScreen = ({
  mode,
  values,
  onChange,
  onSubmit,
  onToggleMode,
  onGoogleSignIn,
  loading,
  error,
}) => {
  const isSignUp = mode === 'signup';

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.card}>
        <Text style={styles.logo}>NEWSAP</Text>

        {isSignUp ? (
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor={colors.textMuted}
            value={values.name}
            onChangeText={(value) => onChange('name', value)}
            autoCapitalize="words"
            accessibilityLabel="Full name"
          />
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          value={values.email}
          onChangeText={(value) => onChange('email', value)}
          keyboardType="email-address"
          autoCapitalize="none"
          accessibilityLabel="Email address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          value={values.password}
          onChangeText={(value) => onChange('password', value)}
          secureTextEntry
          accessibilityLabel="Password"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={onSubmit}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={isSignUp ? 'Create account' : 'Sign in'}
        >
          {loading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.submitButtonText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onToggleMode}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={isSignUp ? 'Switch to sign in' : 'Switch to sign up'}
        >
          <Text style={styles.modeText}>
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Sign-In */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={onGoogleSignIn}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
  },
  logo: {
    ...typography.h1,
    color: colors.primary,
    textAlign: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 50,
  },
  submitButton: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  modeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textMuted,
    marginHorizontal: spacing.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dadce0',
    gap: spacing.sm,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3c4043',
  },
});
