import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { Text, FAB, IconButton, Card, ProgressBar, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store/appStore';
import { ThemeColors, LayoutStyles } from '../styles/theme';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const router = useRouter();
  const { 
    accounts, 
    transactions, 
    budgets, 
    categories, 
    theme, 
    triggerSync, 
    syncLoading,
    user
  } = useAppStore();

  const activeColors = ThemeColors[theme];

  // 1. Calculate Summary Stats
  const totalBalance = useMemo(() => {
    return accounts.reduce((acc, curr) => acc + curr.balance, 0);
  }, [accounts]);

  const monthlyIncome = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return transactions
      .filter((t) => t.type === 'INCOME' && t.date >= startOfMonth)
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [transactions]);

  const monthlyExpense = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return transactions
      .filter((t) => t.type === 'EXPENSE' && t.date >= startOfMonth)
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [transactions]);

  // 2. Format Currency Helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(val);
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <View>
          <Text style={[styles.welcomeText, { color: activeColors.textSecondary }]}>
            Welcome, {user?.name ? user.name.split(' ')[0] : 'User'}
          </Text>
          <Text style={[styles.title, { color: activeColors.text }]}>EZ Finance</Text>
        </View>
        <IconButton
          icon={syncLoading ? 'sync' : 'cloud-sync-outline'}
          iconColor={activeColors.primary}
          size={28}
          onPress={() => triggerSync()}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Total Net Worth Card (Glassmorphism inspired) */}
        <View style={LayoutStyles.cardGlass(theme)}>
          <Text style={[styles.cardLabel, { color: activeColors.textSecondary }]}>Total Net Balance</Text>
          <Text style={[styles.cardBalance, { color: activeColors.primary }]}>
            {formatCurrency(totalBalance)}
          </Text>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <View style={styles.indicatorRow}>
                <IconButton icon="arrow-up-circle-outline" iconColor={activeColors.secondary} size={20} style={styles.arrowIcon} />
                <Text style={[styles.summaryLabel, { color: activeColors.textSecondary }]}>Income</Text>
              </View>
              <Text style={[styles.summaryVal, { color: activeColors.secondary }]}>
                {formatCurrency(monthlyIncome)}
              </Text>
            </View>

            <View style={[styles.verticalDivider, { backgroundColor: activeColors.border }]} />

            <View style={styles.summaryCol}>
              <View style={styles.indicatorRow}>
                <IconButton icon="arrow-down-circle-outline" iconColor={activeColors.error} size={20} style={styles.arrowIcon} />
                <Text style={[styles.summaryLabel, { color: activeColors.textSecondary }]}>Expenses</Text>
              </View>
              <Text style={[styles.summaryVal, { color: activeColors.error }]}>
                {formatCurrency(monthlyExpense)}
              </Text>
            </View>
          </View>
        </View>

        {/* Accounts Horizontal Scroll List */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: activeColors.text }]}>My Accounts</Text>
          <TouchableOpacity onPress={() => router.push('/manage-accounts')}>
            <Text style={[styles.sectionAction, { color: activeColors.primary }]}>Manage</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountsRow}>
          {accounts.length === 0 ? (
            <Card style={[styles.emptyCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
              <Card.Content>
                <Text style={{ color: activeColors.textSecondary, textAlign: 'center' }}>No accounts. Create one to start!</Text>
              </Card.Content>
            </Card>
          ) : (
            accounts.map((acc) => (
              <Card 
                key={acc.id} 
                style={[
                  styles.accountCard, 
                  { backgroundColor: activeColors.surface, borderColor: activeColors.border, borderWidth: 1 }
                ]}
              >
                <Card.Content>
                  <IconButton icon={acc.icon || 'wallet'} iconColor={acc.color || activeColors.primary} size={24} style={styles.accountIcon} />
                  <Text style={[styles.accountName, { color: activeColors.text }]}>{acc.name}</Text>
                  <Text style={[styles.accountType, { color: activeColors.textSecondary }]}>{acc.type}</Text>
                  <Text style={[styles.accountBalance, { color: activeColors.text }]}>
                    {formatCurrency(acc.balance)}
                  </Text>
                </Card.Content>
              </Card>
            ))
          )}
        </ScrollView>

        {/* Budgets Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: activeColors.text }]}>Active Budgets</Text>
          <TouchableOpacity onPress={() => router.push('/add-budget')}>
            <Text style={[styles.sectionAction, { color: activeColors.primary }]}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {budgets.length === 0 ? (
          <Card style={[styles.emptyListCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
            <Card.Content>
              <Text style={{ color: activeColors.textSecondary, textAlign: 'center' }}>No active budgets set for this month.</Text>
            </Card.Content>
          </Card>
        ) : (
          budgets.map((b) => {
            const cat = categories.find((c) => c.id === b.categoryId);
            // Calculate actual spend for this category
            const actualSpend = transactions
              .filter((t) => t.categoryId === b.categoryId && t.type === 'EXPENSE')
              .reduce((sum, curr) => sum + curr.amount, 0);
            
            const progress = b.amount > 0 ? Math.min(actualSpend / b.amount, 1) : 0;
            const overspent = actualSpend > b.amount;

            return (
              <Card 
                key={b.id} 
                style={[
                  styles.budgetCard, 
                  { backgroundColor: activeColors.surface, borderColor: activeColors.border, borderWidth: 1 }
                ]}
              >
                <Card.Content>
                  <View style={styles.budgetHeader}>
                    <Text style={[styles.budgetName, { color: activeColors.text }]}>{cat?.name || 'Category'}</Text>
                    <Text style={[styles.budgetLimit, { color: activeColors.textSecondary }]}>
                      {formatCurrency(actualSpend)} / {formatCurrency(b.amount)}
                    </Text>
                  </View>
                  <ProgressBar 
                    progress={progress} 
                    color={overspent ? activeColors.error : activeColors.primary} 
                    style={styles.progressBar} 
                  />
                  {overspent && (
                    <Text style={[styles.overspentWarning, { color: activeColors.error }]}>Overspending Alert!</Text>
                  )}
                </Card.Content>
              </Card>
            );
          })
        )}

        {/* Recent Transactions list */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: activeColors.text }]}>Recent Activity</Text>
        </View>

        <View style={styles.transactionsContainer}>
          {transactions.length === 0 ? (
            <Card style={[styles.emptyListCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
              <Card.Content>
                <Text style={{ color: activeColors.textSecondary, textAlign: 'center' }}>No transactions recorded yet.</Text>
              </Card.Content>
            </Card>
          ) : (
            transactions.slice(0, 5).map((t) => {
              const cat = categories.find((c) => c.id === t.categoryId);
              const acc = accounts.find((a) => a.id === t.accountId);
              const isExpense = t.type === 'EXPENSE';
              
              return (
                <View 
                  key={t.id} 
                  style={[
                    styles.transactionRow, 
                    { backgroundColor: activeColors.surface, borderColor: activeColors.border }
                  ]}
                >
                  <IconButton 
                    icon={cat?.icon || 'tag-outline'} 
                    iconColor={cat?.color || activeColors.textSecondary} 
                    style={styles.txIcon} 
                  />
                  <View style={styles.txMeta}>
                    <Text style={[styles.txTitle, { color: activeColors.text }]}>{t.note || cat?.name || 'Transaction'}</Text>
                    <Text style={[styles.txSubtitle, { color: activeColors.textSecondary }]}>{acc?.name || 'Account'}</Text>
                  </View>
                  <Text 
                    style={[
                      styles.txAmount, 
                      { color: isExpense ? activeColors.error : activeColors.secondary }
                    ]}
                  >
                    {isExpense ? '-' : '+'}{formatCurrency(t.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Primary Action Trigger (FAB) */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: activeColors.primary }]}
        color={activeColors.background}
        onPress={() => router.push('/add-transaction')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 15,
  },
  welcomeText: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  cardLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  cardBalance: {
    fontSize: 34,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  summaryCol: {
    flex: 1,
  },
  verticalDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    marginHorizontal: 15,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowIcon: {
    margin: 0,
    padding: 0,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  summaryVal: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  accountsRow: {
    gap: 12,
    paddingRight: 20,
  },
  accountCard: {
    width: width * 0.36,
    borderRadius: 14,
  },
  accountIcon: {
    margin: 0,
    marginLeft: -8,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  accountType: {
    fontSize: 11,
    marginBottom: 8,
  },
  accountBalance: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  emptyCard: {
    width: width - 40,
    borderRadius: 14,
    paddingVertical: 10,
  },
  emptyListCard: {
    borderRadius: 14,
    paddingVertical: 14,
  },
  budgetCard: {
    borderRadius: 14,
    marginBottom: 10,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetName: {
    fontSize: 14,
    fontWeight: '600',
  },
  budgetLimit: {
    fontSize: 12,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  overspentWarning: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
  },
  transactionsContainer: {
    gap: 10,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  txIcon: {
    margin: 0,
  },
  txMeta: {
    flex: 1,
    marginLeft: 8,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  txSubtitle: {
    fontSize: 12,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 8,
    bottom: 20,
    borderRadius: 28,
  },
});
