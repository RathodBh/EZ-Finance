import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAppStore } from '../store/appStore';
import { ThemeColors } from '../styles/theme';

const { width } = Dimensions.get('window');

export default function LockScreen() {
  const { setLocked, theme } = useAppStore();
  const [pin, setPin] = useState('');
  const activeColors = ThemeColors[theme];
  const CORRECT_PIN = '1234'; // Default fallback PIN for prototype, can be custom stored in SecureStore later

  useEffect(() => {
    triggerBiometrics();
  }, []);

  const triggerBiometrics = async () => {
    if (Platform.OS === 'web') {
      console.log('Biometric authentication is not supported in the web browser environment.');
      return;
    }
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock EZ Finance Vault',
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: false,
        });

        if (result.success) {
          setLocked(false);
        }
      }
    } catch (e) {
      console.warn('Biometric auth failed or skipped:', e);
    }
  };

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin === CORRECT_PIN) {
        setTimeout(() => setLocked(false), 200);
      } else if (newPin.length === 4) {
        // Clear wrong pin
        setTimeout(() => setPin(''), 600);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Title */}
      <View style={styles.header}>
        <IconButton icon="lock-outline" size={40} iconColor={activeColors.primary} />
        <Text style={[styles.title, { color: activeColors.text }]}>Vault Locked</Text>
        <Text style={[styles.subtitle, { color: activeColors.textSecondary }]}>
          Enter PIN to unlock your financial data
        </Text>
      </View>

      {/* Pin Indicators */}
      <View style={styles.indicatorContainer}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.indicatorDot,
              {
                borderColor: activeColors.primary,
                backgroundColor: pin.length > index ? activeColors.primary : 'transparent',
              },
            ]}
          />
        ))}
      </View>

      {/* Numeric Keypad */}
      <View style={styles.keypad}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['bio', '0', 'delete'],
        ].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((key) => {
              if (key === 'bio') {
                return (
                  <TouchableOpacity key={key} style={styles.key} onPress={triggerBiometrics}>
                    <IconButton icon="fingerprint" size={28} iconColor={activeColors.primary} />
                  </TouchableOpacity>
                );
              }
              if (key === 'delete') {
                return (
                  <TouchableOpacity key={key} style={styles.key} onPress={handleDelete}>
                    <IconButton icon="keyboard-backspace" size={28} iconColor={activeColors.text} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.key, { backgroundColor: activeColors.surface }]}
                  onPress={() => handleKeyPress(key)}
                >
                  <Text style={[styles.keyText, { color: activeColors.text }]}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 70,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  indicatorContainer: {
    flexDirection: 'row',
    marginVertical: 40,
    gap: 20,
  },
  indicatorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  keypad: {
    width: width * 0.85,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  key: {
    flex: 1,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 26,
    fontWeight: '600',
  },
});
