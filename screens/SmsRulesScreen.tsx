import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Text, Card, Button, Badge, IconButton, Switch, SegmentedButtons } from 'react-native-paper';
import { useAppStore } from '../store/appStore';
import { ThemeColors } from '../styles/theme';
import { useRouter } from 'expo-router';
import { SmsRepository } from '../db/repositories';

export default function SmsRulesScreen() {
  const router = useRouter();
  const {
    theme,
    smsRules,
    accounts,
    categories,
    deleteSmsRule,
    refreshSmsData,
  } = useAppStore();

  const activeColors = ThemeColors[theme];
  const [filterType, setFilterType] = useState<string>('ALL');

  useEffect(() => {
    refreshSmsData();
  }, []);

  const handleToggleRule = async (ruleId: string, currentEnabled: boolean) => {
    try {
      await SmsRepository.toggleRuleEnabled(ruleId, !currentEnabled);
      await refreshSmsData();
    } catch (e: any) {
      Alert.alert('Error', `Failed to toggle rule: ${e.message}`);
    }
  };

  const handleDelete = async (ruleId: string) => {
    const confirmDelete = await new Promise((resolve) => {
      if (Platform.OS === 'web') {
        resolve(window.confirm('Are you sure you want to delete this learning rule?'));
      } else {
        Alert.alert(
          'Delete Rule',
          'Are you sure you want to delete this rule? The system will have to relearn this pattern.',
          [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Delete', onPress: () => resolve(true), style: 'destructive' },
          ]
        );
      }
    });

    if (confirmDelete) {
      await deleteSmsRule(ruleId);
    }
  };

  const getAccountName = (id: string | null) => {
    if (!id) return 'N/A';
    return accounts.find((a) => a.id === id)?.name || 'Unknown Account';
  };

  const getCategoryName = (id: string | null) => {
    if (!id) return 'N/A';
    return categories.find((c) => c.id === id)?.name || 'Unknown Category';
  };

  const filteredRules = smsRules.filter((rule) => {
    if (filterType === 'ALL') return true;
    return rule.ruleType === filterType;
  });

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return '#4caf50'; // Green
    if (score >= 60) return '#ff9800'; // Amber
    return '#f44336'; // Red
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
        <Text style={[styles.headerTitle, { color: activeColors.text }]}>Learned Rules</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.segmentContainer}>
        <SegmentedButtons
          value={filterType}
          onValueChange={setFilterType}
          buttons={[
            { value: 'ALL', label: 'All' },
            { value: 'MERCHANT', label: 'Merchant' },
            { value: 'UPI', label: 'UPI' },
            { value: 'ACCOUNT', label: 'Bank' },
          ]}
          style={{ width: '100%' }}
          theme={{
            colors: {
              secondaryContainer: activeColors.primary,
              onSecondaryContainer: activeColors.background,
            },
          }}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {filteredRules.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconButton icon="brain" size={64} iconColor={activeColors.border} />
            <Text style={[styles.emptyTitle, { color: activeColors.text }]}>No Rules Found</Text>
            <Text style={[styles.emptySubtitle, { color: activeColors.textSecondary }]}>
              {filterType === 'ALL'
                ? 'Rules are automatically learned when you approve transactions in the SMS Review Queue.'
                : `No rules found matching type "${filterType}".`}
            </Text>
          </View>
        ) : (
          filteredRules.map((rule) => {
            const score = rule.confidence || 0;
            const isEnabled = !!rule.isEnabled;

            return (
              <Card
                key={rule.id}
                style={[
                  styles.ruleCard,
                  {
                    backgroundColor: activeColors.surface,
                    borderColor: activeColors.border,
                    borderWidth: 1,
                    opacity: isEnabled ? 1 : 0.6,
                  },
                ]}
              >
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <Badge style={[styles.typeBadge, { backgroundColor: activeColors.primary, color: activeColors.background }]}>
                      {rule.ruleType}
                    </Badge>
                    <View style={styles.headerRight}>
                      <Badge
                        style={{
                          backgroundColor: getConfidenceColor(score),
                          color: '#fff',
                          fontWeight: 'bold',
                          marginRight: 10,
                        }}
                      >
                        {`${score}% Confidence`}
                      </Badge>
                      <Switch
                        value={isEnabled}
                        onValueChange={() => handleToggleRule(rule.id, isEnabled)}
                        color={activeColors.primary}
                      />
                    </View>
                  </View>

                  <Text style={[styles.patternText, { color: activeColors.text }]}>
                    {rule.ruleType === 'MERCHANT' && `🛍️ Pattern: "${rule.merchantPattern}"`}
                    {rule.ruleType === 'UPI' && `💳 UPI Address: "${rule.upiId}"`}
                    {rule.ruleType === 'ACCOUNT' && `🏦 Account: "${rule.bankName}" (xx${rule.accountLast4})`}
                  </Text>

                  <View style={styles.mappingRow}>
                    <Text style={[styles.mappingText, { color: activeColors.textSecondary }]}>
                      📁 Category: <Text style={{ color: activeColors.text, fontWeight: 'bold' }}>{getCategoryName(rule.categoryId)}</Text>
                    </Text>
                    {rule.preferredAccountId && (
                      <Text style={[styles.mappingText, { color: activeColors.textSecondary }]}>
                        🏦 Account: <Text style={{ color: activeColors.text, fontWeight: 'bold' }}>{getAccountName(rule.preferredAccountId)}</Text>
                      </Text>
                    )}
                  </View>

                  <View style={[styles.statsRow, { borderTopColor: activeColors.border }]}>
                    <Text style={[styles.statItem, { color: activeColors.textSecondary }]}>
                      ✅ Accepted: <Text style={{ color: '#4caf50', fontWeight: 'bold' }}>{rule.acceptedCount || 0}</Text>
                    </Text>
                    <Text style={[styles.statItem, { color: activeColors.textSecondary }]}>
                      ✏️ Edited: <Text style={{ color: '#ff9800', fontWeight: 'bold' }}>{rule.editedCount || 0}</Text>
                    </Text>
                    <Text style={[styles.statItem, { color: activeColors.textSecondary }]}>
                      ❌ Rejected: <Text style={{ color: '#f44336', fontWeight: 'bold' }}>{rule.rejectedCount || 0}</Text>
                    </Text>
                    <IconButton
                      icon="delete-outline"
                      size={20}
                      iconColor={activeColors.error}
                      onPress={() => handleDelete(rule.id)}
                      style={{ margin: 0, padding: 0 }}
                    />
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}
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
  segmentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  ruleCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    fontWeight: 'bold',
    fontSize: 11,
    paddingHorizontal: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patternText: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  mappingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  mappingText: {
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  statItem: {
    fontSize: 12,
  },
});
