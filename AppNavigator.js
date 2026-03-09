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
} from './src/pages';
import { authService } from './src/services';
import { notificationService } from './src/services';
import { autoImportService } from './src/services';
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

      // Push notification бүртгэх
      if (restored?.user?.id) {
        notificationService.registerForPushNotifications(restored.user.id);
      }

      // Автомат мэдээ импорт эхлүүлэх (foreground + background)
      autoImportService.startAutoImport();
    };

    bootstrap();
  }, []);

  // Notification listener-үүд
  useEffect(() => {
    if (!session?.user?.id) return;

    const cleanup = notificationService.addNotificationListeners({
      onNotificationReceived: (notification) => {
        console.log('Notification received:', notification.request.content.title);
      },
      onNotificationTapped: (data) => {
        console.log('Notification tapped:', data);
        // Цаашид: data.type === 'new_articles' бол тухайн ангилал руу navigate хийх
      },
    });

    return cleanup;
  }, [session?.user?.id]);

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
                  onNewsapPress={() => props.navigation.navigate('Home')}
                  onProfilePress={() => props.navigation.navigate('Profile')}
                  onAdminPress={() => props.navigation.navigate('Admin')}
                  onEditInterests={() => props.navigation.navigate('EditInterests')}
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
              {(props) => <ArticleDetailScreen {...props} language={language} />}
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
