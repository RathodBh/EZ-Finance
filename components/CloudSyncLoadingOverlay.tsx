import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';

interface CloudSyncLoadingOverlayProps {
  statusMessage?: string;
  theme?: 'light' | 'dark';
}

export const CloudSyncLoadingOverlay: React.FC<CloudSyncLoadingOverlayProps> = ({
  statusMessage = 'Syncing your data...',
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const fadeValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeValue, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View 
      style={[
        styles.overlayContainer, 
        { 
          backgroundColor: isDark ? 'rgba(9, 13, 22, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          opacity: fadeValue 
        }
      ]}
    >
      <View style={styles.contentContainer}>
        {/* Simple modern spinner */}
        <ActivityIndicator 
          size="large" 
          color="#6366F1" 
          style={styles.spinner} 
        />

        {/* Title */}
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#1E293B' }]}>
          Google Drive Sync
        </Text>

        {/* Status Message */}
        <Text style={[styles.statusText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          {statusMessage}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    padding: 24,
  },
  spinner: {
    marginBottom: 20,
    transform: [{ scale: 1.2 }],
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

