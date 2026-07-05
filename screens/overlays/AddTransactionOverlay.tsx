import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Modal } from 'react-native';
import { Text, Button, TextInput, SegmentedButtons, IconButton, List, Surface } from 'react-native-paper';
import { useAppStore } from '../../store/appStore';
import { TransactionRepository } from '../../db/repositories';
import { ThemeColors } from '../../styles/theme';

import { useRouter } from 'expo-router';

export default function AddTransactionOverlay() {
  const router = useRouter();
  const { accounts, categories, theme, refreshTransactions, refreshAccounts } = useAppStore();
  const activeColors = ThemeColors[theme];

  // Forms states
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id || '');
  const [note, setNote] = useState('');
  const [merchant, setMerchant] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CARD');

  // Modal pickers visibility states
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showToAccountModal, setShowToAccountModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Helper names
  const selectedAccount = useMemo(() => accounts.find(a => a.id === accountId), [accounts, accountId]);
  const selectedToAccount = useMemo(() => accounts.find(a => a.id === toAccountId), [accounts, toAccountId]);
  const selectedCategory = useMemo(() => categories.find(c => c.id === categoryId), [categories, categoryId]);

  // Filter categories by transaction type
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === type);
  }, [categories, type]);

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid positive amount.');
      return;
    }

    if (!accountId) {
      Alert.alert('Validation Error', 'Please select an account.');
      return;
    }

    if (type !== 'TRANSFER' && !categoryId) {
      Alert.alert('Validation Error', 'Please select a category.');
      return;
    }

    if (type === 'TRANSFER' && accountId === toAccountId) {
      Alert.alert('Validation Error', 'Source and destination accounts must be different.');
      return;
    }

    try {
      const payload: any = {
        id: 'tx_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
        amount: numAmount,
        type,
        accountId,
        categoryId: type === 'TRANSFER' ? 'transfer_cat_id' : categoryId,
        note: note.trim() || null,
        merchant: merchant.trim() || null,
        paymentMethod: type === 'TRANSFER' ? 'TRANSFER' : paymentMethod,
        date: Date.now(),
        isRecurring: false,
        isFavorite: false,
      };

      if (type === 'TRANSFER') {
        payload.toAccountId = toAccountId;
      }

      await TransactionRepository.insert(payload);
      await refreshTransactions();
      await refreshAccounts();
      router.back();
    } catch (e: any) {
      Alert.alert('Save Failed', `Error saving transaction: ${e.message}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Header bar */}
      <View style={styles.header}>
        <IconButton icon="close" size={24} iconColor={activeColors.text} onPress={() => router.back()} />
        <Text style={[styles.title, { color: activeColors.text }]}>Add Transaction</Text>
        <IconButton icon="check" size={24} iconColor={activeColors.primary} onPress={handleSave} />
      </View>

      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        {/* Type selector */}
        <SegmentedButtons
          value={type}
          onValueChange={(val) => {
            setType(val as any);
            // Auto reset category matching the type
            const matches = categories.filter(c => c.type === val);
            if (matches.length > 0) setCategoryId(matches[0].id);
          }}
          buttons={[
            { value: 'EXPENSE', label: 'Expense' },
            { value: 'INCOME', label: 'Income' },
            { value: 'TRANSFER', label: 'Transfer' },
          ]}
          style={styles.segmentedButtons}
          theme={{ colors: { secondaryContainer: activeColors.primary } }}
        />

        {/* Amount Input */}
        <TextInput
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          mode="outlined"
          activeOutlineColor={activeColors.primary}
          textColor={activeColors.text}
          style={[styles.input, { backgroundColor: activeColors.surface }]}
          left={<TextInput.Affix text="$ " />}
        />

        {/* Account Selection (Triggering Modal Dropdown) */}
        <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>
          {type === 'TRANSFER' ? 'From Account' : 'Account'}
        </Text>
        <TouchableOpacity onPress={() => setShowAccountModal(true)} style={styles.dropdownTrigger}>
          <TextInput
            value={selectedAccount ? `${selectedAccount.name} ($${selectedAccount.balance})` : 'Select Account'}
            editable={false}
            mode="outlined"
            activeOutlineColor={activeColors.primary}
            textColor={activeColors.text}
            style={{ backgroundColor: activeColors.surface }}
            right={<TextInput.Icon icon="chevron-down" />}
          />
        </TouchableOpacity>

        {/* Transfer Destination Account Selector */}
        {type === 'TRANSFER' && (
          <>
            <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>To Account</Text>
            <TouchableOpacity onPress={() => setShowToAccountModal(true)} style={styles.dropdownTrigger}>
              <TextInput
                value={selectedToAccount ? `${selectedToAccount.name} ($${selectedToAccount.balance})` : 'Select Destination Account'}
                editable={false}
                mode="outlined"
                activeOutlineColor={activeColors.primary}
                textColor={activeColors.text}
                style={{ backgroundColor: activeColors.surface }}
                right={<TextInput.Icon icon="chevron-down" />}
              />
            </TouchableOpacity>
          </>
        )}

        {/* Category Selection Dropdown (Only for Expense/Income) */}
        {type !== 'TRANSFER' && (
          <>
            <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>Category</Text>
            <TouchableOpacity onPress={() => setShowCategoryModal(true)} style={styles.dropdownTrigger}>
              <TextInput
                value={selectedCategory ? selectedCategory.name : 'Select Category'}
                editable={false}
                mode="outlined"
                activeOutlineColor={activeColors.primary}
                textColor={activeColors.text}
                style={{ backgroundColor: activeColors.surface }}
                right={<TextInput.Icon icon="chevron-down" />}
              />
            </TouchableOpacity>
          </>
        )}

        {/* Note / Description */}
        <TextInput
          label="Note / Description"
          value={note}
          onChangeText={setNote}
          mode="outlined"
          activeOutlineColor={activeColors.primary}
          textColor={activeColors.text}
          style={[styles.input, { backgroundColor: activeColors.surface, marginTop: 14 }]}
        />

        {/* Merchant Name */}
        {type !== 'TRANSFER' && (
          <TextInput
            label="Merchant"
            value={merchant}
            onChangeText={setMerchant}
            mode="outlined"
            activeOutlineColor={activeColors.primary}
            textColor={activeColors.text}
            style={[styles.input, { backgroundColor: activeColors.surface }]}
          />
        )}

        <Button
          mode="contained"
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: activeColors.primary }]}
          labelStyle={{ color: activeColors.background, fontWeight: 'bold' }}
        >
          Save Transaction
        </Button>
      </ScrollView>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL PICKERS (DROPDOWNS)
          ───────────────────────────────────────────────────────────────────────────── */}
      
      {/* Account Modal Picker */}
      <Modal visible={showAccountModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowAccountModal(false)}>
          <Surface style={[styles.modalContent, { backgroundColor: activeColors.surface }]} elevation={5}>
            <Text style={[styles.modalTitle, { color: activeColors.text }]}>Select Account</Text>
            <ScrollView>
              {accounts.map((acc) => (
                <List.Item
                  key={acc.id}
                  title={acc.name}
                  description={`${acc.type} • $${acc.balance}`}
                  left={(props) => <List.Icon {...props} icon={acc.icon || 'wallet'} color={acc.color || activeColors.primary} />}
                  onPress={() => {
                    setAccountId(acc.id);
                    setShowAccountModal(false);
                  }}
                  titleStyle={{ color: activeColors.text }}
                  descriptionStyle={{ color: activeColors.textSecondary }}
                />
              ))}
            </ScrollView>
          </Surface>
        </TouchableOpacity>
      </Modal>

      {/* Transfer destination Account Modal Picker */}
      <Modal visible={showToAccountModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowToAccountModal(false)}>
          <Surface style={[styles.modalContent, { backgroundColor: activeColors.surface }]} elevation={5}>
            <Text style={[styles.modalTitle, { color: activeColors.text }]}>Select Destination Account</Text>
            <ScrollView>
              {accounts.map((acc) => (
                <List.Item
                  key={acc.id}
                  title={acc.name}
                  description={`${acc.type} • $${acc.balance}`}
                  left={(props) => <List.Icon {...props} icon={acc.icon || 'wallet'} color={acc.color || activeColors.primary} />}
                  onPress={() => {
                    setToAccountId(acc.id);
                    setShowToAccountModal(false);
                  }}
                  titleStyle={{ color: activeColors.text }}
                  descriptionStyle={{ color: activeColors.textSecondary }}
                />
              ))}
            </ScrollView>
          </Surface>
        </TouchableOpacity>
      </Modal>

      {/* Category Modal Picker */}
      <Modal visible={showCategoryModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowCategoryModal(false)}>
          <Surface style={[styles.modalContent, { backgroundColor: activeColors.surface }]} elevation={5}>
            <Text style={[styles.modalTitle, { color: activeColors.text }]}>Select Category</Text>
            <ScrollView>
              {filteredCategories.map((cat) => (
                <List.Item
                  key={cat.id}
                  title={cat.name}
                  description={cat.type}
                  left={(props) => <List.Icon {...props} icon={cat.icon || 'tag'} color={cat.color || activeColors.primary} />}
                  onPress={() => {
                    setCategoryId(cat.id);
                    setShowCategoryModal(false);
                  }}
                  titleStyle={{ color: activeColors.text }}
                  descriptionStyle={{ color: activeColors.textSecondary }}
                />
              ))}
            </ScrollView>
          </Surface>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  formContent: {
    padding: 20,
    paddingBottom: 60,
  },
  segmentedButtons: {
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
  },
  dropdownTrigger: {
    marginBottom: 10,
  },
  saveBtn: {
    marginTop: 20,
    height: 48,
    justifyContent: 'center',
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
});
