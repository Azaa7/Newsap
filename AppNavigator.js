import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  AuthScreen,
  HomeScreen,
  ProfileScreen,
  ArticleDetailScreen,
  AdminScreen,
  InterestsScreen,
  SavedScreen,
} from './src/pages';
import { authService } from './src/services';
import { realtimeService } from './src/services/realtimeService';
import { colors, spacing, typography } from './src/theme/tokens';

const RootStack = createNativeStackNavigator();

const BootScreen = () => (
  <View
    style={{
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
    }}
  >
    <ActivityIndicator color={colors.primary} size="large" />
    <Text style={{ ...typography.body, color: colors.textSecondary }}>Loading NEWSAP...</Text>
  </View>
);

export default function AppNavigator() {
  const [session, setSession] = useState(null);
  const [language, setLanguage] = useState('mn');
  const [isBooting, setIsBooting] = useState(true);
  const [showInterests, setShowInterests] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      const restored = await authService.restoreSession();
      setSession(restored);
      if (restored?.user?.language) {
        setLanguage(restored.user.language);
      }
      setIsBooting(false);

      // Бүх realtime сервисүүдийг нэг дуудлагаар эхлүүлэх
      realtimeService.start(restored?.user?.id, {
        onNotificationReceived: (notification) => {
          console.log('Notification received:', notification.request.content.title);
        },
        onNotificationTapped: (data) => {
          console.log('Notification tapped:', data);
        },
      });
    };

    bootstrap();

    return () => {
      realtimeService.stop();
    };
  }, []);

  const handleAuthSuccess = (nextSession) => {
    setSession(nextSession);
    setLanguage(nextSession?.user?.language || 'mn');

    const interests = nextSession?.user?.interests;
    if (!interests || interests.length === 0) {
      setShowInterests(true);
    }
  };

  const handleInterestsComplete = (updatedUser) => {
    setSession((prev) => ({
      ...prev,
      user: {
        ...prev.user,
        interests: updatedUser.interests || [],
      },
    }));
    setShowInterests(false);
  };

  const handleLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);
    setSession((prev) => {
      if (!prev?.user) {
        return prev;
      }

      return {
        ...prev,
        user: {
          ...prev.user,
          language: nextLanguage,
        },
      };
    });
  };

  const handleUserUpdate = (patch = {}) => {
    setSession((prev) => {
      if (!prev?.user) return prev;
      return {
        ...prev,
        user: {
          ...prev.user,
          ...patch,
        },
      };
    });
  };

  const handleLogout = async () => {
    await authService.signOut();
    setSession(null);
  };

  if (isBooting) {
    return <BootScreen />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <RootStack.Screen name="Auth">
            {() => <AuthScreen onAuthSuccess={handleAuthSuccess} />}
          </RootStack.Screen>
        ) : showInterests ? (
          <RootStack.Screen name="Interests">
            {() => (
              <InterestsScreen
                user={session.user}
                language={language}
                onComplete={handleInterestsComplete}
              />
            )}
          </RootStack.Screen>
        ) : (
          <>
            <RootStack.Screen name="Home">
              {(props) => (
                <HomeScreen
                  user={session.user}
                  language={language}
                  onOpenArticle={(article) => props.navigation.navigate('ArticleDetail', { article })}
                  onProfilePress={() => props.navigation.navigate('Profile')}
                />
              )}
            </RootStack.Screen>
            <RootStack.Screen name="Profile">
              {(props) => (
                <ProfileScreen
                  user={session.user}
                  language={language}
                  onLanguageChange={handleLanguageChange}
                  onLogout={handleLogout}
                  onUserUpdate={handleUserUpdate}
                  onNewsapPress={() => props.navigation.navigate('Home')}
                  onProfilePress={() => props.navigation.navigate('Home')}
                  onSavedPress={() => props.navigation.navigate('Saved')}
                  onAdminPress={() => props.navigation.navigate('Admin')}
                  onEditInterests={() => props.navigation.navigate('EditInterests')}
                />
              )}
            </RootStack.Screen>
            <RootStack.Screen name="Saved">
              {(props) => (
                <SavedScreen
                  user={session.user}
                  language={language}
                  onBackPress={() => props.navigation.goBack()}
                  onOpenArticle={(article) => props.navigation.navigate('ArticleDetail', { article })}
                />
              )}
            </RootStack.Screen>
            <RootStack.Screen name="Admin">
              {(props) => (
                <AdminScreen
                  user={session.user}
                  language={language}
                  onBackPress={() => props.navigation.goBack()}
                />
              )}
            </RootStack.Screen>
            <RootStack.Screen name="ArticleDetail">
              {(props) => <ArticleDetailScreen {...props} language={language} user={session.user} />}
            </RootStack.Screen>
            <RootStack.Screen name="EditInterests">
              {(props) => (
                <InterestsScreen
                  user={session.user}
                  language={language}
                  onComplete={(updatedUser) => {
                    handleInterestsComplete(updatedUser);
                    props.navigation.goBack();
                  }}
                />
              )}
            </RootStack.Screen>
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
