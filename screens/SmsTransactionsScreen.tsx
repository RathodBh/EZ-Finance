import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, TouchableOpacity, TextInput } from 'react-native';
import { Text, Card, Button, Badge, IconButton, List, Switch } from 'react-native-paper';
import { useAppStore } from '../store/appStore';
import { ThemeColors } from '../styles/theme';
import { formatCurrency } from '../services/utils';
import { useRouter } from 'expo-router';
import SlideUpModal from '../components/SlideUpModal';

const PRESET_TEST_SMS = [
  { bank: 'HDFC Bank', text: 'Alert: Your HDFC Bank Debit Card ending in 4321 was spent at Swiggy for Rs. 450.00 on 16-07-2026. Avl Bal: Rs. 38,200.', sender: 'HDFCBK' },
  { bank: 'SBI UPI', text: 'SBI SMS: Dear Customer, your A/c ending 1234 has been debited by Rs 1,499.00 on 16-07-26 via UPI to Amazon@okhdfc. Ref 601293810.', sender: 'SBIINB' },
  { bank: 'ICICI Credit', text: 'Transaction Alert: INR 2,500.00 credited to ICICI Bank A/c xx8899 on 16/07/26 from friend@okaxis. Ref: 9812739.', sender: 'ICICIB' },
  { bank: 'Kotak UPI', text: 'Kotak Bank Info: Rs. 280.00 spent at Starbucks via UPI. Ref No: 1092837192. Avl Balance: Rs. 15,290.00.', sender: 'KOTAKB' },
  { bank: 'Self Transfer', text: 'HDFC Bank: Rs 5,000.00 debited for Transfer to ICICI Bank A/c xx8899 on 16-07-2026. Ref UPI/Self-Transfer.', sender: 'HDFCBK' },
];

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
    showToast,
  } = useAppStore();

  const activeColors = ThemeColors[theme];

  // Temp state for editing account/category selections on cards before approving
  const [selections, setSelections] = useState<
    Record<string, { accountId: string; categoryId: string; isTransfer: boolean; toAccountId: string }>
  >({});

  // SlideUpModal active selection states
  const [activeTxIdForAcc, setActiveTxIdForAcc] = useState<string | null>(null);
  const [activeTxIdForToAcc, setActiveTxIdForToAcc] = useState<string | null>(null);
  const [activeTxIdForCat, setActiveTxIdForCat] = useState<string | null>(null);

  // Custom SMS Tester Modal states
  const [showCustomSmsModal, setShowCustomSmsModal] = useState(false);
  const [customSmsInput, setCustomSmsInput] = useState('');
  const [customSenderInput, setCustomSenderInput] = useState('HDFCBK');

  useEffect(() => {
    refreshSmsData();
  }, []);

  // Sync state selections when pending list changes
  useEffect(() => {
    const initialSelections: Record<
      string,
      { accountId: string; categoryId: string; isTransfer: boolean; toAccountId: string }
    > = {};

    pendingSmsTransactions.forEach((tx) => {
      const defaultAcc = tx.matchedAccountId || (accounts.length > 0 ? accounts[0].id : '');
      const defaultToAcc =
        tx.toAccountId ||
        (accounts.length > 1
          ? accounts.find((a) => a.id !== defaultAcc)?.id || accounts[1]?.id || ''
          : '');

      // Filter category options based on DEBIT vs CREDIT
      const matchingTypeCats = categories.filter((c) => {
        if (tx.transactionType === 'DEBIT') return c.type?.toUpperCase() === 'EXPENSE';
        if (tx.transactionType === 'CREDIT') return c.type?.toUpperCase() === 'INCOME';
        return true;
      });

      const matchedCatExists = matchingTypeCats.some((c) => c.id === tx.matchedCategoryId);
      const defaultCat = matchedCatExists
        ? tx.matchedCategoryId
        : matchingTypeCats.length > 0
        ? matchingTypeCats[0].id
        : categories.length > 0
        ? categories[0].id
        : '';

      initialSelections[tx.id] = {
        accountId: defaultAcc,
        categoryId: defaultCat,
        isTransfer: !!tx.isTransfer,
        toAccountId: defaultToAcc,
      };
    });
    setSelections(initialSelections);
  }, [pendingSmsTransactions, accounts, categories]);

  const activeTxForCat = pendingSmsTransactions.find((tx) => tx.id === activeTxIdForCat);
  const availableCategories = categories.filter((cat) => {
    if (!activeTxForCat) return true;
    if (activeTxForCat.transactionType === 'DEBIT') {
      return cat.type?.toUpperCase() === 'EXPENSE';
    }
    if (activeTxForCat.transactionType === 'CREDIT') {
      return cat.type?.toUpperCase() === 'INCOME';
    }
    return true;
  });

  const handleSelectAccount = (txId: string, accountId: string) => {
    setSelections((prev) => ({
      ...prev,
      [txId]: { ...prev[txId], accountId },
    }));
  };

  const handleSelectToAccount = (txId: string, toAccountId: string) => {
    setSelections((prev) => ({
      ...prev,
      [txId]: { ...prev[txId], toAccountId },
    }));
  };

  const handleSelectCategory = (txId: string, categoryId: string) => {
    setSelections((prev) => ({
      ...prev,
      [txId]: { ...prev[txId], categoryId },
    }));
  };

  const handleToggleTransfer = (txId: string, isTransfer: boolean) => {
    setSelections((prev) => {
      const current = prev[txId] || {};
      const fromAcc = current.accountId || (accounts.length > 0 ? accounts[0].id : '');
      const toAcc =
        current.toAccountId ||
        (accounts.length > 1 ? accounts.find((a) => a.id !== fromAcc)?.id || '' : '');
      return {
        ...prev,
        [txId]: {
          ...current,
          isTransfer,
          toAccountId: toAcc,
        },
      };
    });
  };

  const handleApprove = async (tx: any) => {
    const sel = selections[tx.id];
    if (!sel) return;

    if (sel.isTransfer) {
      if (!sel.accountId || !sel.toAccountId) {
        Alert.alert('Required Fields', 'Please select both From Account and To Account for Self Transfer.');
        return;
      }
      if (sel.accountId === sel.toAccountId) {
        Alert.alert('Invalid Selection', 'From Account and To Account must be different for a self transfer.');
        return;
      }
      await approveSmsTx(tx.id, 'transfer_cat_id', sel.accountId, true, sel.toAccountId);
    } else {
      if (!sel.accountId || !sel.categoryId) {
        Alert.alert('Required Fields', 'Please select both an Account and Category.');
        return;
      }
      await approveSmsTx(tx.id, sel.categoryId, sel.accountId, false);
    }
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

  const handleProcessCustomSms = async (text: string, sender: string) => {
    if (!text.trim()) return;
    await processSmsInbox([
      {
        id: `web_test_${Date.now()}`,
        body: text.trim(),
        address: sender || 'HDFCBK',
        date: Date.now(),
      },
    ]);
    setShowCustomSmsModal(false);
    setCustomSmsInput('');
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
            {Platform.OS === 'web' ? 'Simulate 5 Bank SMS' : 'Scan Inbox SMS'}
          </Button>

          <Button
            mode="outlined"
            icon="card-text-outline"
            onPress={() => setShowCustomSmsModal(true)}
            style={[styles.actionBtnOutline, { borderColor: activeColors.primary }]}
            labelStyle={{ color: activeColors.primary, fontWeight: 'bold' }}
          >
            Paste SMS
          </Button>
        </View>

        {pendingSmsTransactions.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Button
              mode="contained-tonal"
              icon="checkbox-multiple-marked-outline"
              onPress={handleBulkApproveHighConfidence}
              labelStyle={{ fontWeight: 'bold' }}
            >
              Approve High Confidence (≥80%)
            </Button>
          </View>
        )}

        {/* Empty State */}
        {pendingSmsTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconButton icon="message-draw" size={64} iconColor={activeColors.border} />
            <Text style={[styles.emptyTitle, { color: activeColors.text }]}>All Caught Up!</Text>
            <Text style={[styles.emptySubtitle, { color: activeColors.textSecondary }]}>
              There are no bank transaction messages in your review queue. Scan simulated messages or paste your own SMS text to test.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button
                mode="contained"
                icon="play-circle-outline"
                onPress={() => processSmsInbox()}
                labelStyle={{ fontWeight: 'bold' }}
              >
                Load Preset Mock SMS
              </Button>
              <Button
                mode="outlined"
                icon="pencil-outline"
                onPress={() => setShowCustomSmsModal(true)}
                labelStyle={{ fontWeight: 'bold' }}
              >
                Paste Custom SMS
              </Button>
            </View>
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

                    {/* Self Transfer Toggle */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 8, paddingHorizontal: 2 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: activeColors.text }}>
                        🔄 Self Transfer
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: currentSel.isTransfer ? activeColors.primary : activeColors.textSecondary, marginRight: 6, fontWeight: currentSel.isTransfer ? '700' : '400' }}>
                          {currentSel.isTransfer ? 'ON' : 'OFF'}
                        </Text>
                        <Switch
                          value={!!currentSel.isTransfer}
                          onValueChange={(val) => handleToggleTransfer(tx.id, val)}
                          color={activeColors.primary}
                        />
                      </View>
                    </View>

                    {/* Form Selectors */}
                    {currentSel.isTransfer ? (
                      <View style={styles.formRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={[styles.formLabel, { color: activeColors.textSecondary }]}>From Account</Text>
                          <TouchableOpacity
                            onPress={() => setActiveTxIdForAcc(tx.id)}
                            style={[styles.selectBox, { borderColor: activeColors.border, backgroundColor: theme === 'dark' ? '#121212' : '#fafafa' }]}
                          >
                            <Text style={{ color: activeColors.text, fontSize: 13 }} numberOfLines={1}>
                              {accounts.find((a) => a.id === currentSel.accountId)?.name || 'Select From Account'}
                            </Text>
                            <IconButton icon="chevron-down" iconColor={activeColors.textSecondary} size={16} style={{ margin: 0 }} />
                          </TouchableOpacity>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: activeColors.textSecondary }]}>To Account</Text>
                          <TouchableOpacity
                            onPress={() => setActiveTxIdForToAcc(tx.id)}
                            style={[styles.selectBox, { borderColor: activeColors.border, backgroundColor: theme === 'dark' ? '#121212' : '#fafafa' }]}
                          >
                            <Text style={{ color: activeColors.text, fontSize: 13 }} numberOfLines={1}>
                              {accounts.find((a) => a.id === currentSel.toAccountId)?.name || 'Select To Account'}
                            </Text>
                            <IconButton icon="chevron-down" iconColor={activeColors.textSecondary} size={16} style={{ margin: 0 }} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
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
                    )}
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

      {/* Account / From Account SlideUpModal Picker */}
      <SlideUpModal
        visible={activeTxIdForAcc !== null}
        onClose={() => setActiveTxIdForAcc(null)}
        backgroundColor={activeColors.surface}
        indicatorColor={activeColors.border}
      >
        <View style={{ padding: 20, paddingBottom: 40 }}>
          <Text style={[styles.modalTitle, { color: activeColors.text }]}>
            {activeTxIdForAcc && selections[activeTxIdForAcc]?.isTransfer ? 'Select From Account' : 'Select Account'}
          </Text>
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

      {/* To Account SlideUpModal Picker */}
      <SlideUpModal
        visible={activeTxIdForToAcc !== null}
        onClose={() => setActiveTxIdForToAcc(null)}
        backgroundColor={activeColors.surface}
        indicatorColor={activeColors.border}
      >
        <View style={{ padding: 20, paddingBottom: 40 }}>
          <Text style={[styles.modalTitle, { color: activeColors.text }]}>Select To Account</Text>
          <ScrollView>
            {accounts
              .filter((acc) => {
                if (!activeTxIdForToAcc) return true;
                const fromAccId = selections[activeTxIdForToAcc]?.accountId;
                return acc.id !== fromAccId;
              })
              .map((acc) => (
                <List.Item
                  key={acc.id}
                  title={acc.name}
                  description={`${acc.type} • ${formatCurrency(acc.balance, 'INR')}`}
                  left={(props) => <List.Icon {...props} icon={acc.icon || 'wallet'} color={acc.color || activeColors.primary} />}
                  onPress={() => {
                    if (activeTxIdForToAcc) {
                      handleSelectToAccount(activeTxIdForToAcc, acc.id);
                    }
                    setActiveTxIdForToAcc(null);
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
          <Text style={[styles.modalTitle, { color: activeColors.text }]}>
            {activeTxForCat?.transactionType === 'DEBIT'
              ? 'Select Expense Category'
              : activeTxForCat?.transactionType === 'CREDIT'
              ? 'Select Income Category'
              : 'Select Category'}
          </Text>
          <ScrollView>
            {availableCategories.map((cat) => (
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

      {/* Custom SMS Tester SlideUpModal */}
      <SlideUpModal
        visible={showCustomSmsModal}
        onClose={() => setShowCustomSmsModal(false)}
        backgroundColor={activeColors.surface}
        indicatorColor={activeColors.border}
      >
        <View style={{ padding: 20, paddingBottom: 40 }}>
          <Text style={[styles.modalTitle, { color: activeColors.text }]}>🧪 Test Custom SMS Parser</Text>
          
          <Text style={{ fontSize: 12, color: activeColors.textSecondary, marginBottom: 8, fontWeight: 'bold' }}>
            QUICK PRESETS (Tap to test):
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {PRESET_TEST_SMS.map((preset, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  setCustomSmsInput(preset.text);
                  setCustomSenderInput(preset.sender);
                }}
                style={{
                  backgroundColor: theme === 'dark' ? '#2c2c2e' : '#e5e5ea',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  marginRight: 8,
                }}
              >
                <Text style={{ color: activeColors.text, fontSize: 12, fontWeight: 'bold' }}>{preset.bank}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={{ fontSize: 12, color: activeColors.textSecondary, marginBottom: 4, fontWeight: 'bold' }}>
            Sender Header ID:
          </Text>
          <TextInput
            value={customSenderInput}
            onChangeText={setCustomSenderInput}
            placeholder="e.g. HDFCBK, SBIINB, ICICIB"
            placeholderTextColor={activeColors.textSecondary}
            style={{
              borderWidth: 1,
              borderColor: activeColors.border,
              borderRadius: 8,
              padding: 10,
              color: activeColors.text,
              backgroundColor: theme === 'dark' ? '#121212' : '#fafafa',
              marginBottom: 12,
            }}
          />

          <Text style={{ fontSize: 12, color: activeColors.textSecondary, marginBottom: 4, fontWeight: 'bold' }}>
            Raw SMS Message Text:
          </Text>
          <TextInput
            multiline
            numberOfLines={4}
            value={customSmsInput}
            onChangeText={setCustomSmsInput}
            placeholder="Paste or type any bank SMS notification text..."
            placeholderTextColor={activeColors.textSecondary}
            style={{
              borderWidth: 1,
              borderColor: activeColors.border,
              borderRadius: 8,
              padding: 12,
              height: 100,
              color: activeColors.text,
              backgroundColor: theme === 'dark' ? '#121212' : '#fafafa',
              textAlignVertical: 'top',
              marginBottom: 16,
            }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <Button mode="text" onPress={() => setShowCustomSmsModal(false)}>
              Cancel
            </Button>
            <Button
              mode="contained"
              icon="play"
              onPress={() => handleProcessCustomSms(customSmsInput, customSenderInput)}
              disabled={!customSmsInput.trim()}
              style={{ backgroundColor: activeColors.primary }}
              labelStyle={{ color: activeColors.background, fontWeight: 'bold' }}
            >
              Parse SMS
            </Button>
          </View>
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
