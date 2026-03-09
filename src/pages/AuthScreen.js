import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LoginScreen } from '../components';
import { authService, analyticsService } from '../services';
import { colors } from '../theme/tokens';

export const AuthScreen = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState('signin');
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleMode = () => {
    setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
    setError('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const session =
        mode === 'signin'
          ? await authService.signIn(values.email, values.password)
          : await authService.signUp(values);

      await analyticsService.track(mode === 'signin' ? 'auth_signin_success' : 'auth_signup_success', {
        email: values.email,
      });

      onAuthSuccess?.(session);
    } catch (submitError) {
      setError(submitError.message || 'Authentication failed.');
      await analyticsService.track('auth_error', {
        mode,
        message: submitError.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      const session = await authService.signInWithGoogle();
      await analyticsService.track('auth_google_success', { email: session.user.email });
      onAuthSuccess?.(session);
    } catch (err) {
      setError(err.message || 'Google нэвтрэх амжилтгүй боллоо.');
      await analyticsService.track('auth_google_error', { message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LoginScreen
        language="mn"
        mode={mode}
        values={values}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onToggleMode={handleToggleMode}
        onGoogleSignIn={handleGoogleSignIn}
        loading={loading}
        error={error}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
