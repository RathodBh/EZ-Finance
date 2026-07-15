import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemeColors } from '../styles/theme';

interface CloudSyncLoadingOverlayProps {
  statusMessage?: string;
  theme?: 'light' | 'dark';
}

export const CloudSyncLoadingOverlay: React.FC<CloudSyncLoadingOverlayProps> = ({
  statusMessage = 'Syncing your data with Google Drive...',
  theme = 'dark',
}) => {
  const activeColors = ThemeColors[theme];
  
  // Animation refs
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Continuous rotation for outer sync ring
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Subtle pulsing effect for central card glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View 
      style={[
        styles.overlayContainer, 
        { backgroundColor: theme === 'dark' ? '#090D16' : '#F4F6FB', opacity: fadeValue }
      ]}
    >
      <Animated.View 
        style={[
          styles.glowCard, 
          { 
            backgroundColor: theme === 'dark' ? '#121929' : '#FFFFFF',
            borderColor: theme === 'dark' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.15)',
            transform: [{ scale: pulseValue }],
          }
        ]}
      >
        {/* Animated Icon Ring */}
        <View style={styles.iconWrapper}>
          <Animated.View style={[styles.spinnerRing, { transform: [{ rotate: spin }] }]}>
            <MaterialCommunityIcons name="sync" size={68} color="#6366F1" />
          </Animated.View>
          <View style={styles.cloudBadge}>
            <MaterialCommunityIcons name="google-drive" size={32} color="#4285F4" />
          </View>
        </View>

        {/* Dynamic Title */}
        <Text style={[styles.title, { color: activeColors.text }]}>
          Restoring Cloud Data
        </Text>

        {/* Dynamic Status Step */}
        <View style={styles.statusBadge}>
          <View style={styles.liveDot} />
          <Text style={[styles.statusText, { color: '#6366F1' }]} numberOfLines={2}>
            {statusMessage}
          </Text>
        </View>

        {/* Informative Explanation Box */}
        <View style={[styles.infoCard, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(99, 102, 241, 0.05)' }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={20} color="#10B981" style={{ marginRight: 8 }} />
          <Text style={[styles.infoText, { color: theme === 'dark' ? '#94A3B8' : '#64748B' }]}>
            Downloading your secure Google Drive backup to your device. This guarantees seamless offline access to all your records.
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  glowCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  iconWrapper: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  spinnerRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cloudBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(66, 133, 244, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
});
