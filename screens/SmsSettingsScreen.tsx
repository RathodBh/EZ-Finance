import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Text, Card, Button, IconButton, Switch, List } from 'react-native-paper';
import { useAppStore } from '../store/appStore';
import { ThemeColors } from '../styles/theme';
import { useRouter } from 'expo-router';
import { SmsRepository } from '../db/repositories';

export default function SmsSettingsScreen() {
  const router = useRouter();
  const {
    theme,
    smsSettings,
    updateSmsSettings,
    refreshSmsData,
  } = useAppStore();

  const activeColors = ThemeColors[theme];

  // Local settings states
  const [isEnabled, setIsEnabled] = useState(true);
  const [autoSaveThreshold, setAutoSaveThreshold] = useState(98);
  const [autoSuggestThreshold, setAutoSuggestThreshold] = useState(80);
  const [reviewThreshold, setReviewThreshold] = useState(60);

  useEffect(() => {
    refreshSmsData();
  }, []);

  useEffect(() => {
    if (smsSettings) {
      setIsEnabled(!!smsSettings.isEnabled);
      setAutoSaveThreshold(smsSettings.autoSaveThreshold);
      setAutoSuggestThreshold(smsSettings.autoSuggestThreshold);
      setReviewThreshold(smsSettings.reviewThreshold);
    }
  }, [smsSettings]);

  const handleSave = async () => {
    await updateSmsSettings({
      isEnabled,
      autoSaveThreshold,
      autoSuggestThreshold,
      reviewThreshold,
    });
    router.back();
  };

  const handleResetDb = async () => {
    const confirmReset = await new Promise((resolve) => {
      if (Platform.OS === 'web') {
        resolve(window.confirm('Reset Rules Engine?\n\nThis will delete all learned merchant patterns, UPI matches, bank mappings, and pending review transactions. This action cannot be undone.'));
      } else {
        Alert.alert(
          'Reset Engine Data',
          'This will delete all learned rules, merchant mappings, and pending review transactions. This cannot be undone.',
          [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Reset All', onPress: () => resolve(true), style: 'destructive' },
          ]
        );
      }
    });

    if (confirmReset) {
      try {
        await SmsRepository.resetAllRulesAndData();
        await refreshSmsData();
        Alert.alert('Reset Complete', 'Rules engine data has been successfully cleared.');
      } catch (err: any) {
        Alert.alert('Error', `Failed to reset: ${err.message}`);
      }
    }
  };

  const adjustThreshold = (type: 'save' | 'suggest' | 'review', dir: 'up' | 'down') => {
    const step = 5;
    if (type === 'save') {
      const next = dir === 'up' ? Math.min(100, autoSaveThreshold + step) : Math.max(80, autoSaveThreshold - step);
      setAutoSaveThreshold(next);
    } else if (type === 'suggest') {
      const next = dir === 'up' ? Math.min(95, autoSuggestThreshold + step) : Math.max(50, autoSuggestThreshold - step);
      setAutoSuggestThreshold(next);
    } else if (type === 'review') {
      const next = dir === 'up' ? Math.min(90, reviewThreshold + step) : Math.max(30, reviewThreshold - step);
      setReviewThreshold(next);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Header bar */}
      <View style={[styles.header, { borderBottomColor: activeColors.border }]}>
        <IconButton
          icon="arrow-left"
          iconColor={activeColors.text}
          onPress={() => router.back()}
        />
        <Text style={[styles.headerTitle, { color: activeColors.text }]}>STDE Settings</Text>
        <IconButton
          icon="check"
          iconColor={activeColors.primary}
          onPress={handleSave}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Toggle Panel */}
        <Card style={[styles.card, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
          <Card.Content style={styles.toggleRow}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={[styles.cardTitle, { color: activeColors.text }]}>Enable SMS Detection</Text>
              <Text style={[styles.cardDesc, { color: activeColors.textSecondary }]}>
                Automatically scan incoming messages and parse them into draft transactions offline.
              </Text>
            </View>
            <Switch
              value={isEnabled}
              onValueChange={setIsEnabled}
              color={activeColors.primary}
            />
          </Card.Content>
        </Card>

        {isEnabled && (
          <View>
            <Text style={[styles.sectionTitle, { color: activeColors.primary }]}>CONFIDENCE THRESHOLDS</Text>

            {/* Auto Save Card */}
            <Card style={[styles.card, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
              <Card.Content>
                <View style={styles.thresholdHeader}>
                  <Text style={[styles.cardTitle, { color: activeColors.text }]}>Auto-Save Threshold</Text>
                  <Text style={[styles.thresholdVal, { color: '#4caf50' }]}>{autoSaveThreshold}%</Text>
                </View>
                <Text style={[styles.cardDesc, { color: activeColors.textSecondary, marginBottom: 12 }]}>
                  Transactions matching rules with confidence at or above this score are approved and saved instantly without manual review.
                </Text>
                <View style={styles.adjustRow}>
                  <IconButton
                    icon="minus-circle-outline"
                    iconColor={activeColors.text}
                    size={28}
                    onPress={() => adjustThreshold('save', 'down')}
                  />
                  <IconButton
                    icon="plus-circle-outline"
                    iconColor={activeColors.text}
                    size={28}
                    onPress={() => adjustThreshold('save', 'up')}
                  />
                </View>
              </Card.Content>
            </Card>

            {/* Auto Suggest Card */}
            <Card style={[styles.card, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
              <Card.Content>
                <View style={styles.thresholdHeader}>
                  <Text style={[styles.cardTitle, { color: activeColors.text }]}>Auto-Suggest Threshold</Text>
                  <Text style={[styles.thresholdVal, { color: '#ff9800' }]}>{autoSuggestThreshold}%</Text>
                </View>
                <Text style={[styles.cardDesc, { color: activeColors.textSecondary, marginBottom: 12 }]}>
                  Transactions matching with confidence at or above this score will have their Category and Account fields pre-filled in the queue.
                </Text>
                <View style={styles.adjustRow}>
                  <IconButton
                    icon="minus-circle-outline"
                    iconColor={activeColors.text}
                    size={28}
                    onPress={() => adjustThreshold('suggest', 'down')}
                  />
                  <IconButton
                    icon="plus-circle-outline"
                    iconColor={activeColors.text}
                    size={28}
                    onPress={() => adjustThreshold('suggest', 'up')}
                  />
                </View>
              </Card.Content>
            </Card>

            {/* Review Filter Card */}
            <Card style={[styles.card, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
              <Card.Content>
                <View style={styles.thresholdHeader}>
                  <Text style={[styles.cardTitle, { color: activeColors.text }]}>Min Review Threshold</Text>
                  <Text style={[styles.thresholdVal, { color: activeColors.primary }]}>{reviewThreshold}%</Text>
                </View>
                <Text style={[styles.cardDesc, { color: activeColors.textSecondary, marginBottom: 12 }]}>
                  Parsed SMS messages with a matching score below this value will require full manual entry and are shown as unassigned.
                </Text>
                <View style={styles.adjustRow}>
                  <IconButton
                    icon="minus-circle-outline"
                    iconColor={activeColors.text}
                    size={28}
                    onPress={() => adjustThreshold('review', 'down')}
                  />
                  <IconButton
                    icon="plus-circle-outline"
                    iconColor={activeColors.text}
                    size={28}
                    onPress={() => adjustThreshold('review', 'up')}
                  />
                </View>
              </Card.Content>
            </Card>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: activeColors.error, marginTop: 12 }]}>DANGER ZONE</Text>

        <Card style={[styles.card, { backgroundColor: activeColors.surface, borderWidth: 1, borderColor: activeColors.error }]}>
          <Card.Content>
            <Text style={[styles.cardTitle, { color: activeColors.text }]}>Reset Engine Data</Text>
            <Text style={[styles.cardDesc, { color: activeColors.textSecondary, marginBottom: 16 }]}>
              Completely wipe out all learned rules, merchant counters, UPI profiles, and pending transactions.
            </Text>
            <Button
              mode="contained"
              onPress={handleResetDb}
              style={{ backgroundColor: activeColors.error }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
            >
              Reset Rules & Counters
            </Button>
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: activeColors.primary }]}
          labelStyle={{ color: activeColors.background, fontWeight: 'bold' }}
        >
          Save Settings
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 44 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardDesc: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginVertical: 12,
  },
  thresholdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thresholdVal: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  saveBtn: {
    marginTop: 20,
    borderRadius: 8,
    paddingVertical: 4,
    marginBottom: 40,
  },
});
