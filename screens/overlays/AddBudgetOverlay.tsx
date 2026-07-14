import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, TextInput, IconButton } from 'react-native-paper';
import { useAppStore } from '../../store/appStore';
import { BudgetRepository } from '../../db/repositories';
import { ThemeColors } from '../../styles/theme';
import { getCurrencySymbol } from '../../services/utils';

import { useRouter } from 'expo-router';

export default function AddBudgetOverlay() {
  const router = useRouter();
  const { categories, theme, refreshBudgets, currency, showToast } = useAppStore();
  const activeColors = ThemeColors[theme];

  // Forms states
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('MONTHLY'); // MONTHLY, WEEKLY, etc.

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid positive amount.', 'error');
      return;
    }

    if (!categoryId) {
      showToast('Please select a category.', 'error');
      return;
    }

    try {
      const now = Date.now();
      const oneMonth = 30 * 24 * 60 * 60 * 1000;

      await BudgetRepository.insert({
        id: 'bgt_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
        categoryId,
        amount: numAmount,
        period,
        startDate: now,
        endDate: now + oneMonth, // standard 30 day window
        carryForward: false,
        alertThreshold: 0.8,
      });

      await refreshBudgets();
      showToast('Budget cycle activated successfully.', 'success');
      router.back();
    } catch (e: any) {
      showToast(`Failed to set budget: ${e.message}`, 'error');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Header bar */}
      <View style={styles.header}>
        <IconButton icon="close" size={24} iconColor={activeColors.text} onPress={() => router.back()} />
        <Text style={[styles.title, { color: activeColors.text }]}>Set Budget</Text>
        <IconButton icon="check" size={24} iconColor={activeColors.primary} onPress={handleSave} />
      </View>

      <ScrollView contentContainerStyle={styles.formContent}>
        <TextInput
          label="Budget Limit Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          mode="outlined"
          activeOutlineColor={activeColors.primary}
          textColor={activeColors.text}
          style={[styles.input, { backgroundColor: activeColors.surface }]}
          left={<TextInput.Affix text={`${getCurrencySymbol(currency)} `} />}
        />

        {/* Category selector */}
        <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
          {categories
            .filter((c) => c.type === 'EXPENSE')
            .map((cat) => (
              <Button
                key={cat.id}
                mode={categoryId === cat.id ? 'contained' : 'outlined'}
                onPress={() => setCategoryId(cat.id)}
                style={styles.selectBtn}
                theme={{ colors: { primary: activeColors.primary } }}
              >
                {cat.name}
              </Button>
            ))}
        </ScrollView>

        {/* Period Selector */}
        <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>Budget Cycle</Text>
        <View style={styles.periodRow}>
          {['WEEKLY', 'MONTHLY', 'YEARLY'].map((p) => (
            <Button
              key={p}
              mode={period === p ? 'contained' : 'outlined'}
              onPress={() => setPeriod(p)}
              style={styles.periodBtn}
              theme={{ colors: { primary: activeColors.primary } }}
            >
              {p}
            </Button>
          ))}
        </View>

        <Button
          mode="contained"
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: activeColors.primary }]}
          labelStyle={{ color: activeColors.background, fontWeight: 'bold' }}
        >
          Activate Budget Limit
        </Button>
      </ScrollView>
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
  input: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 12,
  },
  selectorScroll: {
    gap: 8,
    marginBottom: 20,
    paddingRight: 20,
  },
  selectBtn: {
    borderRadius: 8,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 30,
  },
  periodBtn: {
    flex: 1,
    borderRadius: 8,
  },
  saveBtn: {
    height: 48,
    justifyContent: 'center',
    borderRadius: 12,
  },
});
