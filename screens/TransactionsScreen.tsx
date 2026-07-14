import React, { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import { Text, Searchbar, Chip, IconButton, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store/appStore';
import { TransactionRepository } from '../db/repositories';
import { ThemeColors } from '../styles/theme';
import DatePickerModal from '../components/DatePickerModal';

import { formatCurrency as formatCurrencyUtil } from '../services/utils';

export default function TransactionsScreen() {
  const router = useRouter();
  const { transactions, accounts, categories, theme, refreshTransactions, refreshAccounts, currency, setShowTxModal, showToast } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE' | 'TRANSFER'>('ALL');
  
  // Date range filters
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const activeColors = ThemeColors[theme];

  // 1. Filter and Search Transactions locally
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Filter by type
      if (activeFilter !== 'ALL' && t.type !== activeFilter) return false;

      // Filter by date range
      if (startDate) {
        const startMs = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
        if (t.date < startMs) return false;
      }
      if (endDate) {
        const endMs = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).getTime();
        if (t.date > endMs) return false;
      }

      // Filter by search note/merchant/paymentMethod
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const catName = categories.find((c) => c.id === t.categoryId)?.name || '';
        const accName = accounts.find((a) => a.id === t.accountId)?.name || '';
        const noteMatch = (t.note || '').toLowerCase().includes(query);
        const merchantMatch = (t.merchant || '').toLowerCase().includes(query);
        const categoryMatch = catName.toLowerCase().includes(query);
        const accountMatch = accName.toLowerCase().includes(query);
        return noteMatch || merchantMatch || categoryMatch || accountMatch;
      }

      return true;
    });
  }, [transactions, searchQuery, activeFilter, categories, accounts, startDate, endDate]);

  const handleEditTx = (tx: any) => {
    setShowTxModal(true, tx);
    router.push('/add-transaction');
  };

  const handleDeleteTx = (id: string) => {
    const doDelete = async () => {
      try {
        await TransactionRepository.delete(id);
        await refreshTransactions();
        await refreshAccounts(); // Refresh account balances as deletion recalculates balance
        showToast('Transaction deleted successfully.', 'success');
      } catch (err: any) {
        console.error('Delete transaction failed:', err);
        showToast(`Failed to delete transaction: ${err.message}`, 'error');
      }
    };

    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm('Are you sure you want to permanently delete this transaction?');
      if (confirmDelete) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Transaction',
        'Are you sure you want to permanently delete this transaction?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: doDelete
          }
        ]
      );
    }
  };

  const formatDate = (epochMs: number) => {
    return new Date(epochMs).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (val: number) => {
    return formatCurrencyUtil(val, currency);
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Top Search Bar & Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: activeColors.text }]}>Transactions</Text>
        <Searchbar
          placeholder="Search note, merchant, tag..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={[styles.searchBar, { backgroundColor: activeColors.surface }]}
          inputStyle={{ color: activeColors.text }}
          iconColor={activeColors.textSecondary}
          placeholderTextColor={activeColors.textSecondary}
        />
      </View>

      {/* Filter Chips row */}
      <View style={styles.filterRow}>
        {(['ALL', 'INCOME', 'EXPENSE', 'TRANSFER'] as const).map((filter) => (
          <Chip
            key={filter}
            selected={activeFilter === filter}
            onPress={() => setActiveFilter(filter)}
            style={[
              styles.chip,
              activeFilter === filter 
                ? { backgroundColor: activeColors.primary } 
                : { backgroundColor: activeColors.surface }
            ]}
            selectedColor={activeFilter === filter ? activeColors.background : activeColors.text}
            showSelectedOverlay
          >
            {filter}
          </Chip>
        ))}
      </View>

      {/* Date Filter Row */}
      <View style={styles.dateFilterRow}>
        <TouchableOpacity
          style={[styles.dateButton, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}
          onPress={() => setShowDatePicker(true)}
        >
          <IconButton icon="calendar-month" size={18} iconColor={activeColors.primary} style={{ margin: 0 }} />
          <Text style={{ color: (startDate || endDate) ? activeColors.text : activeColors.textSecondary, fontSize: 13, fontWeight: '500', marginLeft: 4 }}>
            {startDate && endDate 
              ? `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
              : startDate
                ? `From: ${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                : 'Filter Date Range'
            }
          </Text>
        </TouchableOpacity>

        {(startDate || endDate) && (
          <IconButton
            icon="close-circle"
            iconColor={activeColors.error}
            size={22}
            onPress={() => {
              setStartDate(null);
              setEndDate(null);
            }}
            style={{ margin: 0 }}
          />
        )}
      </View>

      {/* Transactions List */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Card style={[styles.emptyCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
            <Card.Content>
              <Text style={{ color: activeColors.textSecondary, textAlign: 'center' }}>
                No matching transactions found.
              </Text>
            </Card.Content>
          </Card>
        }
        renderItem={({ item }) => {
          const cat = categories.find((c) => c.id === item.categoryId);
          const acc = accounts.find((a) => a.id === item.accountId);
          const toAcc = item.toAccountId ? accounts.find((a) => a.id === item.toAccountId) : null;
          const isExpense = item.type === 'EXPENSE';
          const isTransfer = item.type === 'TRANSFER';

          return (
            <View style={[styles.txItem, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
              <View style={styles.leftCol}>
                <IconButton 
                  icon={cat?.icon || 'swap-horizontal'} 
                  iconColor={cat?.color || activeColors.textSecondary} 
                  style={[styles.iconButton, { backgroundColor: activeColors.surfaceVariant }]} 
                />
                <View style={styles.metadata}>
                  <Text style={[styles.txNote, { color: activeColors.text }]}>
                    {item.note || item.merchant || cat?.name || 'Transaction'}
                  </Text>
                  <Text style={[styles.txDetails, { color: activeColors.textSecondary }]}>
                    {isTransfer ? `${acc?.name} ➜ ${toAcc?.name}` : `${acc?.name || 'Account'}`} • {formatDate(item.date)}
                  </Text>
                </View>
              </View>

              <View style={styles.rightCol}>
                <Text 
                  style={[
                    styles.amount,
                    { color: isExpense ? activeColors.error : isTransfer ? activeColors.text : activeColors.secondary }
                  ]}
                >
                  {isExpense ? '-' : isTransfer ? '' : '+'}{formatCurrency(item.amount)}
                </Text>
                <TouchableOpacity onPress={() => handleEditTx(item)}>
                  <IconButton icon="pencil-outline" iconColor={activeColors.primary} size={20} style={styles.editBtn} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteTx(item.id)}>
                  <IconButton icon="trash-can-outline" iconColor={activeColors.error} size={20} style={styles.deleteBtn} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Date Pickers */}
      <DatePickerModal
        visible={showDatePicker}
        startDate={startDate}
        endDate={endDate}
        onSelectRange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
        onClose={() => setShowDatePicker(false)}
        title="Select Date Range"
        activeColors={activeColors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  searchBar: {
    elevation: 0,
    borderRadius: 12,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  chip: {
    borderRadius: 8,
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 10,
  },
  emptyCard: {
    borderRadius: 14,
    paddingVertical: 14,
  },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconButton: {
    margin: 0,
  },
  metadata: {
    marginLeft: 10,
    flex: 1,
  },
  txNote: {
    fontSize: 15,
    fontWeight: '600',
  },
  txDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amount: {
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 4,
  },
  editBtn: {
    margin: 0,
    padding: 0,
  },
  deleteBtn: {
    margin: 0,
    padding: 0,
  },
});
