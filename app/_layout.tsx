import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '../store/appStore';
import { paperDarkTheme, paperLightTheme, ThemeColors } from '../styles/theme';

export default function RootLayout() {
  const { initApp, user, authLoading, theme, dbInitialized } = useAppStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize DB and session on boot
  useEffect(() => {
    initApp();
  }, []);

  // Handle routing redirects based on auth state
  useEffect(() => {
    if (authLoading || !dbInitialized) return;

    const inTabsGroup = segments[0] === '(tabs)' || segments.length === 0;

    if (!user && inTabsGroup) {
      // Not logged in -> redirect to onboarding login path
      router.replace('/login');
    } else if (user && segments[0] === 'login') {
      // Logged in -> redirect to dashboard
      router.replace('/');
    }
  }, [user, authLoading, dbInitialized, segments]);

  const activeColors = ThemeColors[theme];
  const paperTheme = theme === 'dark' ? paperDarkTheme : paperLightTheme;

  if (authLoading || !dbInitialized) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: ThemeColors.dark.background }]}>
        <ActivityIndicator size="large" color={ThemeColors.dark.primary} />
      </View>
    );
  }

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Slot />
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
