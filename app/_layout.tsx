import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { Provider as PaperProvider, Snackbar } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '../store/appStore';
import { paperDarkTheme, paperLightTheme, ThemeColors } from '../styles/theme';

export default function RootLayout() {
  const { initApp, user, authLoading, theme, dbInitialized, isBootstrapping, toast, hideToast } = useAppStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize DB and session on boot
  useEffect(() => {
    initApp();
  }, []);

  // Handle routing redirects based on auth state
  useEffect(() => {
    if (authLoading || !dbInitialized) return;

    const isLoggingIn = segments[0] === 'login';

    if (!user && !isLoggingIn) {
      // Not logged in -> redirect to onboarding login path
      router.replace('/login');
    } else if (user && isLoggingIn) {
      // Logged in -> redirect to dashboard
      router.replace('/');
    }
  }, [user, authLoading, dbInitialized, segments]);

  const activeColors = ThemeColors[theme];
  const paperTheme = theme === 'dark' ? paperDarkTheme : paperLightTheme;

  if (isBootstrapping || !dbInitialized) {
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
      <Snackbar
        visible={toast.visible}
        onDismiss={hideToast}
        duration={3000}
        style={{
          backgroundColor:
            toast.type === 'error'
              ? activeColors.error
              : toast.type === 'success'
              ? activeColors.secondary
              : activeColors.surfaceVariant,
        }}
        theme={{
          colors: {
            accent: activeColors.text,
          }
        }}
        action={{
          label: 'Dismiss',
          onPress: hideToast,
        }}
      >
        {toast.message}
      </Snackbar>
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
