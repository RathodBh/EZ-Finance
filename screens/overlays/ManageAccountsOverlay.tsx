import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform } from 'react-native';
import { Text, IconButton, Button, Surface, TextInput } from 'react-native-paper';
import { useAppStore } from '../../store/appStore';
import { AccountRepository, TransactionRepository } from '../../db/repositories';
import { ThemeColors } from '../../styles/theme';
import { useRouter } from 'expo-router';
import SlideUpModal from '../../components/SlideUpModal';
import { formatCurrency, getCurrencySymbol } from '../../services/utils';
import PremiumSwitch from '../../components/PremiumSwitch';

export default function ManageAccountsOverlay() {
  const router = useRouter();
  const { accounts, transactions, theme, refreshAccounts, refreshTransactions, currency, showToast } = useAppStore();
  const activeColors = ThemeColors[theme];

  // Modal Control
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState('BANK');
  const [openingBalance, setOpeningBalance] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [selectedIcon, setSelectedIcon] = useState('bank');
  const [isDefault, setIsDefault] = useState(false);

  const ACCOUNT_TYPES = ['BANK', 'CASH', 'UPI', 'CREDIT_CARD', 'WALLET', 'LOAN', 'INVESTMENT', 'GOLD'];

  const COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Emerald Green
    '#EF4444', // Ruby Red
    '#E2B85C', // Gold
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#6B7280', // Slate Grey
  ];

  const ICONS = [
    'bank',
    'wallet',
    'credit-card-outline',
    'cellphone',
    'piggy-bank',
    'chart-line',
    'gold',
    'cash',
    'hand-coin',
    'briefcase',
    'shield-check',
    'finance',
  ];

  // Default Icon & Color mapping based on type selection
  const handleTypeChange = (newType: string) => {
    setType(newType);
    switch (newType) {
      case 'BANK':
        setSelectedColor('#3B82F6');
        setSelectedIcon('bank');
        break;
      case 'CASH':
        setSelectedColor('#10B981');
        setSelectedIcon('wallet');
        break;
      case 'UPI':
        setSelectedColor('#14B8A6');
        setSelectedIcon('cellphone');
        break;
      case 'CREDIT_CARD':
        setSelectedColor('#EF4444');
        setSelectedIcon('credit-card-outline');
        break;
      case 'WALLET':
        setSelectedColor('#8B5CF6');
        setSelectedIcon('wallet');
        break;
      case 'LOAN':
        setSelectedColor('#E2B85C');
        setSelectedIcon('hand-coin');
        break;
      case 'INVESTMENT':
        setSelectedColor('#EC4899');
        setSelectedIcon('chart-line');
        break;
      case 'GOLD':
        setSelectedColor('#F59E0B');
        setSelectedIcon('gold');
        break;
      default:
        break;
    }
  };

  const handleOpenAdd = () => {
    setEditingAccount(null);
    setName('');
    setType('BANK');
    setOpeningBalance('');
    setSelectedColor('#3B82F6');
    setSelectedIcon('bank');
    setIsDefault(false);
    setShowModal(true);
  };

  const handleOpenEdit = (acc: any) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    setOpeningBalance(String(acc.openingBalance || 0));
    setSelectedColor(acc.color || '#3B82F6');
    setSelectedIcon(acc.icon || 'wallet');
    setIsDefault(!!acc.isDefault);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Please enter an account name.', 'error');
      return;
    }

    const startBalance = parseFloat(openingBalance) || 0;

    try {
      let savedId = '';
      if (editingAccount) {
        // Edit mode
        const balanceDiff = startBalance - (editingAccount.openingBalance || 0);
        const newBalance = (editingAccount.balance || 0) + balanceDiff;
        savedId = editingAccount.id;

        await AccountRepository.update(editingAccount.id, {
          name: name.trim(),
          type,
          openingBalance: startBalance,
          balance: newBalance,
          color: selectedColor,
          icon: selectedIcon,
        });
      } else {
        // Add mode
        savedId = 'acc_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        await AccountRepository.insert({
          id: savedId,
          name: name.trim(),
          type,
          openingBalance: startBalance,
          balance: startBalance,
          currency: currency,
          icon: selectedIcon,
          color: selectedColor,
          isActive: true,
        });
      }

      if (isDefault) {
        await AccountRepository.setDefault(savedId);
      }

      await refreshAccounts();
      showToast('Account details saved successfully.', 'success');
      setShowModal(false);
    } catch (e: any) {
      showToast(`Failed to save account: ${e.message}`, 'error');
    }
  };

  const handleDelete = async (id: string, accountName: string) => {
    const relatedTransactions = transactions.filter(
      (t: any) => t.accountId === id || t.toAccountId === id
    );
    const hasTransactions = relatedTransactions.length > 0;

    const performDelete = async () => {
      try {
        if (hasTransactions) {
          for (const t of relatedTransactions) {
            await TransactionRepository.delete(t.id);
          }
        }
        await AccountRepository.delete(id);
        await refreshAccounts();
        await refreshTransactions();
        showToast('Account and associated transactions deleted successfully.', 'success');
        setShowModal(false);
      } catch (err: any) {
        showToast(`Failed to delete account: ${err.message}`, 'error');
      }
    };

    const message = hasTransactions
      ? `Account "${accountName}" has related transaction records. Deleting this account will also delete all of its transactions. Are you sure you want to delete all?`
      : `Are you sure you want to delete account "${accountName}"?`;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(message);
      if (confirmed) {
        await performDelete();
      }
    } else {
      Alert.alert(
        'Delete Account',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete All',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Header bar */}
      <View style={[styles.header, { borderBottomColor: activeColors.border }]}>
        <IconButton icon="arrow-left" size={24} iconColor={activeColors.text} onPress={() => router.back()} />
        <Text style={[styles.title, { color: activeColors.text }]}>Accounts</Text>
        <View style={{ width: 48 }} />
      </View>
      
      <ScrollView contentContainerStyle={styles.listContent}>
        {accounts.map((acc) => (
          <TouchableOpacity
            key={acc.id}
            activeOpacity={0.7}
            onPress={() => handleOpenEdit(acc)}
            style={[styles.accountCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}
          >
            <View style={styles.cardLeft}>
              <View style={[styles.iconCircle, { backgroundColor: `${acc.color || activeColors.primary}20` }]}>
                <IconButton icon={acc.icon || 'wallet'} iconColor={acc.color || activeColors.primary} size={22} style={{ margin: 0 }} />
              </View>
              <View style={styles.cardDetails}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.accountName, { color: activeColors.text }]}>{acc.name}</Text>
                  {acc.isDefault ? (
                    <View style={{ backgroundColor: '#E2B85C20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: '#E2B85C', fontSize: 10, fontWeight: 'bold' }}>DEFAULT</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.accountDesc, { color: activeColors.textSecondary }]}>
                  {acc.type} • Opening: {formatCurrency(acc.openingBalance, currency)}
                </Text>
              </View>
            </View>

            <View style={styles.cardRight}>
              <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                <Text style={[styles.balanceText, { color: activeColors.text }]}>{formatCurrency(acc.balance, currency)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconButton
                  icon={acc.isDefault ? 'star' : 'star-outline'}
                  iconColor={acc.isDefault ? '#E2B85C' : activeColors.textSecondary}
                  size={20}
                  onPress={async (e) => {
                    e.stopPropagation();
                    try {
                      await AccountRepository.setDefault(acc.id);
                      await refreshAccounts();
                      showToast(`"${acc.name}" set as default account.`, 'success');
                    } catch (err: any) {
                      showToast(`Failed to set default account: ${err.message}`, 'error');
                    }
                  }}
                  style={{ margin: 0 }}
                />
                <IconButton
                  icon="pencil-outline"
                  iconColor={activeColors.textSecondary}
                  size={20}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(acc);
                  }}
                  style={{ margin: 0 }}
                />
                {acc.id !== 'acc_cash' && (
                  <IconButton
                    icon="trash-can-outline"
                    iconColor={activeColors.error}
                    size={20}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDelete(acc.id, acc.name);
                    }}
                    style={{ margin: 0 }}
                  />
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleOpenAdd}
        style={[styles.floatingAddBtn, { backgroundColor: activeColors.primary }]}
      >
        <IconButton icon="plus" iconColor={activeColors.background} size={20} style={{ margin: 0 }} />
        <Text style={[styles.addBtnText, { color: activeColors.background }]}>Add Account</Text>
      </TouchableOpacity>

      {/* Add / Edit Account Popup SlideUpModal */}
      <SlideUpModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        backgroundColor={activeColors.surface}
        indicatorColor={activeColors.border}
      >
        <View style={{ padding: 20, paddingBottom: 40 }}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: activeColors.text }]}>
              {editingAccount ? 'Edit Account' : 'New Account'}
            </Text>
            <IconButton icon="close" size={20} iconColor={activeColors.text} onPress={() => setShowModal(false)} />
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
              value={openingBalance}
              onChangeText={setOpeningBalance}
              keyboardType="numeric"
              mode="outlined"
              activeOutlineColor={activeColors.primary}
              textColor={activeColors.text}
              style={[styles.input, { backgroundColor: activeColors.surface }]}
              left={<TextInput.Affix text={`${getCurrencySymbol(currency)} `} />}
            />

            <View style={[styles.switchRow, { borderBottomColor: activeColors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchLabel, { color: activeColors.text }]}>Set as Default Account</Text>
                <Text style={[styles.switchSub, { color: activeColors.textSecondary }]}>Auto-select this account for transactions</Text>
              </View>
              <PremiumSwitch
                value={isDefault}
                onValueChange={setIsDefault}
                activeColor={activeColors.primary}
                inactiveColor={theme === 'dark' ? '#3e3e3e' : '#e0e0e0'}
              />
            </View>

            {/* Type Grid */}
            <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>Account Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeScroll}>
              {ACCOUNT_TYPES.map((t) => (
                <Button
                  key={t}
                  mode={type === t ? 'contained' : 'outlined'}
                  onPress={() => handleTypeChange(t)}
                  style={styles.typeBtn}
                  theme={{ colors: { primary: activeColors.primary } }}
                >
                  {t}
                </Button>
              ))}
            </ScrollView>

            {/* Color Swatches */}
            <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>Theme Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
              {COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setSelectedColor(c)}
                  style={[styles.colorSwatch, { backgroundColor: c }]}
                >
                  {selectedColor === c && <IconButton icon="check" iconColor="#FFF" size={18} style={{ margin: 0 }} />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Icons Grid */}
            <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>Account Icon</Text>
            <View style={styles.iconGrid}>
              {ICONS.map((ico) => (
                <TouchableOpacity
                  key={ico}
                  onPress={() => setSelectedIcon(ico)}
                  style={[
                    styles.iconCell,
                    {
                      borderColor: selectedIcon === ico ? activeColors.primary : activeColors.border,
                      backgroundColor: selectedIcon === ico ? `${activeColors.primary}15` : 'transparent',
                    },
                  ]}
                >
                  <IconButton icon={ico} iconColor={selectedIcon === ico ? activeColors.primary : activeColors.textSecondary} size={20} style={{ margin: 0 }} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            {editingAccount && editingAccount.id !== 'acc_cash' && (
              <Button
                mode="outlined"
                textColor={activeColors.error}
                style={[styles.modalDeleteBtn, { borderColor: activeColors.error }]}
                onPress={() => handleDelete(editingAccount.id, editingAccount.name)}
              >
                Delete
              </Button>
            )}
            <Button
              mode="contained"
              onPress={handleSave}
              style={[styles.modalSaveBtn, { backgroundColor: activeColors.primary }]}
              labelStyle={{ color: activeColors.background, fontWeight: 'bold' }}
            >
              Save
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
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
    gap: 12,
  },
  accountCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  accountDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  floatingAddBtn: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    borderRadius: 28,
    height: 56,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addBtnText: {
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalScroll: {
    maxHeight: '82%',
  },
  input: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  typeScroll: {
    gap: 8,
    paddingBottom: 8,
  },
  typeBtn: {
    borderRadius: 8,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
  },
  colorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-start',
    paddingBottom: 20,
  },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalSaveBtn: {
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  modalDeleteBtn: {
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  switchSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
