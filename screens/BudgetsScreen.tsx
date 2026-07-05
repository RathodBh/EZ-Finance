import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, ProgressBar, IconButton } from 'react-native-paper';
import { useAppStore } from '../store/appStore';
import { ThemeColors } from '../styles/theme';

import { useRouter } from 'expo-router';

export default function BudgetsScreen() {
  const router = useRouter();
  const { budgets, goals, transactions, categories, theme } = useAppStore();
  const activeColors = ThemeColors[theme];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(val);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: activeColors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: activeColors.text }]}>Planning</Text>
      </View>

      {/* Budgets Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: activeColors.text }]}>Category Budgets</Text>
        <TouchableOpacity onPress={() => router.push('/add-budget')}>
          <Text style={[styles.actionText, { color: activeColors.primary }]}>+ Set Budget</Text>
        </TouchableOpacity>
      </View>

      {budgets.length === 0 ? (
        <Card style={[styles.emptyCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
          <Card.Content>
            <Text style={{ color: activeColors.textSecondary, textAlign: 'center' }}>
              No budgets defined. Tap "+ Set Budget" to restrict spending!
            </Text>
          </Card.Content>
        </Card>
      ) : (
        budgets.map((b) => {
          const cat = categories.find((c) => c.id === b.categoryId);
          const actualSpend = transactions
            .filter((t) => t.categoryId === b.categoryId && t.type === 'EXPENSE')
            .reduce((sum, curr) => sum + curr.amount, 0);

          const progress = b.amount > 0 ? Math.min(actualSpend / b.amount, 1) : 0;
          const remaining = b.amount - actualSpend;
          const isOverspent = actualSpend > b.amount;

          return (
            <Card key={b.id} style={[styles.card, { backgroundColor: activeColors.surface, borderColor: activeColors.border, borderWidth: 1 }]}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text style={[styles.itemName, { color: activeColors.text }]}>{cat?.name || 'Category'}</Text>
                  <Text style={[styles.itemValues, { color: activeColors.text }]}>
                    {formatCurrency(actualSpend)} / <Text style={{ color: activeColors.textSecondary }}>{formatCurrency(b.amount)}</Text>
                  </Text>
                </View>

                <ProgressBar progress={progress} color={isOverspent ? activeColors.error : activeColors.primary} style={styles.progressBar} />

                <View style={styles.cardFooter}>
                  <Text style={[styles.footerText, { color: isOverspent ? activeColors.error : activeColors.secondary }]}>
                    {isOverspent ? `Overspent by ${formatCurrency(Math.abs(remaining))}` : `${formatCurrency(remaining)} remaining`}
                  </Text>
                  <Text style={[styles.percentText, { color: activeColors.textSecondary }]}>
                    {Math.round(progress * 100)}% Used
                  </Text>
                </View>
              </Card.Content>
            </Card>
          );
        })
      )}

      {/* Goals Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: activeColors.text }]}>Financial Goals</Text>
        <TouchableOpacity onPress={() => router.push('/add-goal')}>
          <Text style={[styles.actionText, { color: activeColors.primary }]}>+ Add Goal</Text>
        </TouchableOpacity>
      </View>

      {goals.length === 0 ? (
        <Card style={[styles.emptyCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
          <Card.Content>
            <Text style={{ color: activeColors.textSecondary, textAlign: 'center' }}>
              No goals set. Create one to lock and track your vacation, vehicle, or retirement milestones.
            </Text>
          </Card.Content>
        </Card>
      ) : (
        goals.map((g) => {
          const progress = g.targetAmount > 0 ? Math.min(g.currentAmount / g.targetAmount, 1) : 0;
          const remaining = g.targetAmount - g.currentAmount;

          return (
            <Card key={g.id} style={[styles.card, { backgroundColor: activeColors.surface, borderColor: activeColors.border, borderWidth: 1 }]}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <IconButton icon={g.icon || 'trophy-outline'} iconColor={g.color || activeColors.primary} style={{ margin: 0, padding: 0 }} />
                    <Text style={[styles.itemName, { color: activeColors.text, marginLeft: 8 }]}>{g.name}</Text>
                  </View>
                  <Text style={[styles.itemValues, { color: activeColors.text }]}>
                    {formatCurrency(g.currentAmount)} / <Text style={{ color: activeColors.textSecondary }}>{formatCurrency(g.targetAmount)}</Text>
                  </Text>
                </View>

                <ProgressBar progress={progress} color={activeColors.secondary} style={styles.progressBar} />

                <View style={styles.cardFooter}>
                  <Text style={{ color: activeColors.textSecondary, fontSize: 12 }}>
                    {remaining > 0 ? `${formatCurrency(remaining)} left` : 'Completed! 🎉'}
                  </Text>
                  <Text style={[styles.percentText, { color: activeColors.textSecondary }]}>
                    {Math.round(progress * 100)}% Saved
                  </Text>
                </View>
              </Card.Content>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 14,
    paddingVertical: 14,
  },
  card: {
    borderRadius: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  itemValues: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginVertical: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  percentText: {
    fontSize: 12,
  },
});
