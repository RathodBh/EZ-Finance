import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Badge, IconButton, List } from 'react-native-paper';
import { useAppStore } from '../store/appStore';
import { ThemeColors } from '../styles/theme';
import { formatCurrency } from '../services/utils';
import { useRouter } from 'expo-router';
import SlideUpModal from '../components/SlideUpModal';

export default function SmsTransactionsScreen() {
  const router = useRouter();
  const {
    theme,
    pendingSmsTransactions,
    smsDailySummary,
    accounts,
    categories,
    smsProcessing,
    processSmsInbox,
    approveSmsTx,
    skipSmsTx,
    refreshSmsData,
  } = useAppStore();

  const activeColors = ThemeColors[theme];

  // Temp state for editing account/category selections on cards before approving
  const [selections, setSelections] = useState<Record<string, { accountId: string; categoryId: string }>>({});

  // SlideUpModal active selection states
  const [activeTxIdForAcc, setActiveTxIdForAcc] = useState<string | null>(null);
  const [activeTxIdForCat, setActiveTxIdForCat] = useState<string | null>(null);

  useEffect(() => {
    refreshSmsData();
  }, []);

  // Sync state selections when pending list changes
  useEffect(() => {
    const initialSelections: Record<string, { accountId: string; categoryId: string }> = {};
    pendingSmsTransactions.forEach((tx) => {
      const defaultAcc = tx.matchedAccountId || (accounts.length > 0 ? accounts[0].id : '');
      const defaultCat = tx.matchedCategoryId || (categories.length > 0 ? categories[0].id : '');
      initialSelections[tx.id] = {
        accountId: defaultAcc,
        categoryId: defaultCat,
      };
    });
    setSelections(initialSelections);
  }, [pendingSmsTransactions, accounts, categories]);

  const handleSelectAccount = (txId: string, accountId: string) => {
    setSelections((prev) => ({
      ...prev,
      [txId]: { ...prev[txId], accountId },
    }));
  };

  const handleSelectCategory = (txId: string, categoryId: string) => {
    setSelections((prev) => ({
      ...prev,
      [txId]: { ...prev[txId], categoryId },
    }));
  };

  const handleApprove = async (tx: any) => {
    const sel = selections[tx.id];
    if (!sel || !sel.accountId || !sel.categoryId) {
      Alert.alert('Required Fields', 'Please select both an Account and Category.');
      return;
    }
    await approveSmsTx(tx.id, sel.categoryId, sel.accountId);
  };

  const handleBulkApproveHighConfidence = async () => {
    const highConfTxs = pendingSmsTransactions.filter((tx) => (tx.confidence || 0) >= 80);
    if (highConfTxs.length === 0) {
      Alert.alert('No Match', 'No high-confidence (>= 80%) transactions found in queue.');
      return;
    }

    const proceed = await new Promise((resolve) => {
      if (Platform.OS === 'web') {
        resolve(window.confirm(`Approve ${highConfTxs.length} high-confidence transactions automatically?`));
      } else {
        Alert.alert(
          'Bulk Approve',
          `Approve all ${highConfTxs.length} transactions with confidence >= 80%?`,
          [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Approve All', onPress: () => resolve(true) },
          ]
        );
      }
    });

    if (!proceed) return;

    for (const tx of highConfTxs) {
      const sel = selections[tx.id];
      if (sel && sel.accountId && sel.categoryId) {
        await approveSmsTx(tx.id, sel.categoryId, sel.accountId);
      }
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return '#4caf50'; // Green
    if (score >= 60) return '#ff9800'; // Amber
    return '#f44336'; // Red
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 80) return 'High';
    if (score >= 60) return 'Medium';
    return 'Low';
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
        <Text style={[styles.headerTitle, { color: activeColors.text }]}>SMS Review Queue</Text>
        <IconButton
          icon="cog-outline"
          iconColor={activeColors.text}
          onPress={() => router.push('/sms-settings')}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Daily Summary Stats Panel */}
        <Card style={[styles.summaryCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
          <Card.Content>
            <Text style={[styles.summaryTitle, { color: activeColors.textSecondary }]}>TODAY'S ACTIVITY</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: activeColors.text }]}>
                  {smsDailySummary?.total || 0}
                </Text>
                <Text style={[styles.statLabel, { color: activeColors.textSecondary }]}>Sms Read</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: '#4caf50' }]}>
                  {smsDailySummary?.autoSaved || 0}
                </Text>
                <Text style={[styles.statLabel, { color: activeColors.textSecondary }]}>Auto Saved</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: activeColors.primary }]}>
                  {smsDailySummary?.pendingReview || 0}
                </Text>
                <Text style={[styles.statLabel, { color: activeColors.textSecondary }]}>Pending</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Action Controls */}
        <View style={styles.actionsBar}>
          <Button
            mode="contained"
            loading={smsProcessing}
            disabled={smsProcessing}
            icon="sync"
            onPress={() => processSmsInbox()}
            style={[styles.actionBtn, { backgroundColor: activeColors.primary }]}
            labelStyle={{ color: activeColors.background, fontWeight: 'bold' }}
          >
            Scan Inbox SMS
          </Button>

          {pendingSmsTransactions.length > 0 && (
            <Button
              mode="outlined"
              icon="checkbox-multiple-marked-outline"
              onPress={handleBulkApproveHighConfidence}
              style={[styles.actionBtnOutline, { borderColor: activeColors.primary }]}
              labelStyle={{ color: activeColors.primary, fontWeight: 'bold' }}
            >
              {"Approve High (>=80%)"}
            </Button>
          )}
        </View>

        {/* Empty State */}
        {pendingSmsTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconButton icon="message-draw" size={64} iconColor={activeColors.border} />
            <Text style={[styles.emptyTitle, { color: activeColors.text }]}>All Caught Up!</Text>
            <Text style={[styles.emptySubtitle, { color: activeColors.textSecondary }]}>
              There are no bank transaction messages in your review queue. Scan your inbox or simulate messages to start.
            </Text>
            <Button
              mode="contained-tonal"
              icon="play-circle-outline"
              onPress={() => processSmsInbox()}
              style={{ marginTop: 16 }}
              labelStyle={{ fontWeight: 'bold' }}
            >
              Test with Simulated SMS
            </Button>
          </View>
        ) : (
          <View>
            <Text style={[styles.sectionTitle, { color: activeColors.textSecondary }]}>
              PENDING REVIEW ({pendingSmsTransactions.length})
            </Text>

            {/* List of cards */}
            {pendingSmsTransactions.map((tx) => {
              const currentSel = selections[tx.id] || { accountId: '', categoryId: '' };
              const score = tx.confidence || 0;

              return (
                <Card
                  key={tx.id}
                  style={[
                    styles.txCard,
                    {
                      backgroundColor: activeColors.surface,
                      borderColor: activeColors.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Card.Content>
                    {/* Header: Amount + Confidence badge */}
                    <View style={styles.cardHeader}>
                      <Text style={[styles.amountText, { color: tx.transactionType === 'CREDIT' ? '#4caf50' : activeColors.text }]}>
                        {tx.transactionType === 'CREDIT' ? '+' : '-'}{formatCurrency(tx.amount, 'INR')}
                      </Text>
                      <Badge
                        style={{
                          backgroundColor: getConfidenceColor(score),
                          color: '#fff',
                          fontWeight: 'bold',
                          paddingHorizontal: 8,
                          height: 22,
                        }}
                      >
                        {`${score}% (${getConfidenceLabel(score)})`}
                      </Badge>
                    </View>

                    {/* Metadata */}
                    <View style={styles.metadataRow}>
                      <Text style={[styles.metaText, { color: activeColors.textSecondary }]}>
                        🏦 {tx.bankName || 'Unknown Bank'} ({tx.accountLast4 ? `xx${tx.accountLast4}` : 'N/A'})
                      </Text>
                      <Text style={[styles.metaText, { color: activeColors.textSecondary }]}>
                        📅 {new Date(tx.transactionDate).toLocaleDateString()} {new Date(tx.transactionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    {tx.merchant && (
                      <Text style={[styles.merchantText, { color: activeColors.text }]}>
                        🛍️ Merchant: <Text style={{ fontWeight: 'bold' }}>{tx.merchant}</Text>
                      </Text>
                    )}

                    {tx.upiId && (
                      <Text style={[styles.upiText, { color: activeColors.textSecondary }]}>
                        💳 UPI: {tx.upiId}
                      </Text>
                    )}

                    {/* Raw SMS Snippet */}
                    <View style={[styles.smsSnippet, { backgroundColor: theme === 'dark' ? '#1e1e1e' : '#f5f5f5' }]}>
                      <Text style={[styles.smsText, { color: activeColors.textSecondary }]} numberOfLines={2}>
                        "{tx.smsBody}"
                      </Text>
                    </View>

                    {/* Form Selectors */}
                    <View style={styles.formRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.formLabel, { color: activeColors.textSecondary }]}>Account</Text>
                        <TouchableOpacity
                          onPress={() => setActiveTxIdForAcc(tx.id)}
                          style={[styles.selectBox, { borderColor: activeColors.border, backgroundColor: theme === 'dark' ? '#121212' : '#fafafa' }]}
                        >
                          <Text style={{ color: activeColors.text, fontSize: 13 }} numberOfLines={1}>
                            {accounts.find((a) => a.id === currentSel.accountId)?.name || 'Select Account'}
                          </Text>
                          <IconButton icon="chevron-down" iconColor={activeColors.textSecondary} size={16} style={{ margin: 0 }} />
                        </TouchableOpacity>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.formLabel, { color: activeColors.textSecondary }]}>Category</Text>
                        <TouchableOpacity
                          onPress={() => setActiveTxIdForCat(tx.id)}
                          style={[styles.selectBox, { borderColor: activeColors.border, backgroundColor: theme === 'dark' ? '#121212' : '#fafafa' }]}
                        >
                          <Text style={{ color: activeColors.text, fontSize: 13 }} numberOfLines={1}>
                            {categories.find((c) => c.id === currentSel.categoryId)?.name || 'Select Category'}
                          </Text>
                          <IconButton icon="chevron-down" iconColor={activeColors.textSecondary} size={16} style={{ margin: 0 }} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Card.Content>

                  <Card.Actions style={[styles.cardActions, { borderTopColor: activeColors.border }]}>
                    <Button
                      mode="text"
                      icon="close-circle-outline"
                      textColor={activeColors.error}
                      onPress={() => skipSmsTx(tx.id)}
                    >
                      Skip
                    </Button>
                    <Button
                      mode="contained"
                      icon="check-circle-outline"
                      onPress={() => handleApprove(tx)}
                      style={{ backgroundColor: activeColors.primary }}
                      labelStyle={{ color: activeColors.background, fontWeight: 'bold' }}
                    >
                      Approve
                    </Button>
                  </Card.Actions>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Account SlideUpModal Picker */}
      <SlideUpModal
        visible={activeTxIdForAcc !== null}
        onClose={() => setActiveTxIdForAcc(null)}
        backgroundColor={activeColors.surface}
        indicatorColor={activeColors.border}
      >
        <View style={{ padding: 20, paddingBottom: 40 }}>
          <Text style={[styles.modalTitle, { color: activeColors.text }]}>Select Account</Text>
          <ScrollView>
            {accounts.map((acc) => (
              <List.Item
                key={acc.id}
                title={acc.name}
                description={`${acc.type} • ${formatCurrency(acc.balance, 'INR')}`}
                left={(props) => <List.Icon {...props} icon={acc.icon || 'wallet'} color={acc.color || activeColors.primary} />}
                onPress={() => {
                  if (activeTxIdForAcc) {
                    handleSelectAccount(activeTxIdForAcc, acc.id);
                  }
                  setActiveTxIdForAcc(null);
                }}
                titleStyle={{ color: activeColors.text }}
                descriptionStyle={{ color: activeColors.textSecondary }}
              />
            ))}
          </ScrollView>
        </View>
      </SlideUpModal>

      {/* Category SlideUpModal Picker */}
      <SlideUpModal
        visible={activeTxIdForCat !== null}
        onClose={() => setActiveTxIdForCat(null)}
        backgroundColor={activeColors.surface}
        indicatorColor={activeColors.border}
      >
        <View style={{ padding: 20, paddingBottom: 40 }}>
          <Text style={[styles.modalTitle, { color: activeColors.text }]}>Select Category</Text>
          <ScrollView>
            {categories.map((cat) => (
              <List.Item
                key={cat.id}
                title={cat.name}
                description={cat.type}
                left={(props) => <List.Icon {...props} icon={cat.icon || 'tag'} color={cat.color || activeColors.primary} />}
                onPress={() => {
                  if (activeTxIdForCat) {
                    handleSelectCategory(activeTxIdForCat, cat.id);
                  }
                  setActiveTxIdForCat(null);
                }}
                titleStyle={{ color: activeColors.text }}
                descriptionStyle={{ color: activeColors.textSecondary }}
              />
            ))}
          </ScrollView>
        </View>
      </SlideUpModal>
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
  summaryCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  actionsBar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1.2,
    borderRadius: 8,
  },
  actionBtnOutline: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
  txCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metaText: {
    fontSize: 12,
  },
  merchantText: {
    fontSize: 14,
    marginBottom: 4,
  },
  upiText: {
    fontSize: 13,
    marginBottom: 8,
  },
  smsSnippet: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  smsText: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  selectBox: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardActions: {
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
});
