import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, TextInput, IconButton, List } from 'react-native-paper';
import { useAppStore } from '../../store/appStore';
import { AccountRepository } from '../../db/repositories';
import { ThemeColors } from '../../styles/theme';

import { useRouter } from 'expo-router';

export default function ManageAccountsOverlay() {
  const router = useRouter();
  const { accounts, theme, refreshAccounts } = useAppStore();
  const activeColors = ThemeColors[theme];

  // Create form states
  const [name, setName] = useState('');
  const [type, setType] = useState('BANK'); // BANK, CASH, UPI, CREDIT_CARD, etc.
  const [balance, setBalance] = useState('');
  
  const ACCOUNT_TYPES = ['BANK', 'CASH', 'UPI', 'CREDIT_CARD', 'WALLET', 'LOAN', 'INVESTMENT', 'GOLD'];

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter an account name.');
      return;
    }

    const startBalance = parseFloat(balance) || 0;

    try {
      await AccountRepository.insert({
        id: 'acc_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
        name: name.trim(),
        type,
        openingBalance: startBalance,
        balance: startBalance, // initially same as opening balance
        currency: 'USD',
        icon: type === 'CREDIT_CARD' ? 'credit-card-outline' : type === 'GOLD' ? 'gold' : 'wallet',
        color: type === 'BANK' ? '#3B82F6' : type === 'CREDIT_CARD' ? '#EF4444' : '#10B981',
        isActive: true,
      });

      await refreshAccounts();
      closeOverlay();
    } catch (e: any) {
      Alert.alert('Error', `Failed to create account: ${e.message}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Header bar */}
      <View style={styles.header}>
        <IconButton icon="close" size={24} iconColor={activeColors.text} onPress={() => router.back()} />
        <Text style={[styles.title, { color: activeColors.text }]}>Manage Accounts</Text>
        <IconButton icon="check" size={24} iconColor={activeColors.primary} onPress={handleSave} />
      </View>

      <ScrollView contentContainerStyle={styles.formContent}>
        {/* Current list of accounts */}
        <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>Active Accounts</Text>
        <View style={styles.listContainer}>
          {accounts.map((acc) => (
            <List.Item
              key={acc.id}
              title={acc.name}
              description={`${acc.type} • Opening: $${acc.openingBalance}`}
              left={(props) => <List.Icon {...props} icon={acc.icon || 'wallet'} color={acc.color || activeColors.primary} />}
              right={() => <Text style={[styles.balanceText, { color: activeColors.text }]}>${acc.balance}</Text>}
              style={[styles.accountItem, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}
              titleStyle={{ color: activeColors.text, fontWeight: 'bold' }}
              descriptionStyle={{ color: activeColors.textSecondary }}
            />
          ))}
        </View>

        <DividerStyle color={activeColors.border} />

        {/* Create new account form */}
        <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>Create New Account</Text>
        
        <TextInput
          label="Account Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          activeOutlineColor={activeColors.primary}
          textColor={activeColors.text}
          style={[styles.input, { backgroundColor: activeColors.surface }]}
        />

        <TextInput
          label="Opening Balance"
          value={balance}
          onChangeText={setBalance}
          keyboardType="numeric"
          mode="outlined"
          activeOutlineColor={activeColors.primary}
          textColor={activeColors.text}
          style={[styles.input, { backgroundColor: activeColors.surface }]}
          left={<TextInput.Affix text="$ " />}
        />

        {/* Type Selector */}
        <Text style={{ color: activeColors.textSecondary, fontSize: 13, marginBottom: 8 }}>Account Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeScroll}>
          {ACCOUNT_TYPES.map((t) => (
            <Button
              key={t}
              mode={type === t ? 'contained' : 'outlined'}
              onPress={() => setType(t)}
              style={styles.typeBtn}
              theme={{ colors: { primary: activeColors.primary } }}
            >
              {t}
            </Button>
          ))}
        </ScrollView>

        <Button
          mode="contained"
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: activeColors.primary }]}
          labelStyle={{ color: activeColors.background, fontWeight: 'bold' }}
        >
          Add Account
        </Button>
      </ScrollView>
    </View>
  );
}

function DividerStyle({ color }: { color: string }) {
  return <View style={{ height: 1, backgroundColor: color, marginVertical: 20 }} />;
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
  sectionLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  listContainer: {
    gap: 8,
  },
  accountItem: {
    borderRadius: 10,
    borderWidth: 1,
  },
  balanceText: {
    alignSelf: 'center',
    fontWeight: 'bold',
    fontSize: 15,
    marginRight: 10,
  },
  input: {
    marginBottom: 16,
  },
  typeScroll: {
    gap: 8,
    marginBottom: 20,
  },
  typeBtn: {
    borderRadius: 8,
  },
  saveBtn: {
    marginTop: 10,
    height: 48,
    justifyContent: 'center',
    borderRadius: 12,
  },
});
