import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, List, Switch, Avatar, Button, Card, Divider } from 'react-native-paper';
import { useAppStore } from '../store/appStore';
import { ThemeColors } from '../styles/theme';
import Papa from 'papaparse';
import { Platform } from 'react-native';

let Sharing: any = null;
let FileSystem: any = null;

if (Platform.OS !== 'web') {
  try {
    Sharing = require('expo-sharing');
    FileSystem = require('expo-file-system');
  } catch (e) {
    console.warn('Native sharing modules failed to load:', e);
  }
}

import { useRouter } from 'expo-router';

export default function MoreScreen() {
  const router = useRouter();
  const { 
    user, 
    logout, 
    theme, 
    toggleTheme, 
    triggerSync, 
    syncLoading, 
    lastSyncTime,
    transactions,
    refreshAllData
  } = useAppStore();

  const activeColors = ThemeColors[theme];

  const handleExportCSV = async () => {
    try {
      if (transactions.length === 0) {
        Alert.alert('No Data', 'There are no transactions to export.');
        return;
      }

      // Convert transactions to CSV payload
      const csvData = transactions.map((t) => ({
        ID: t.id,
        Date: new Date(t.date).toISOString().split('T')[0],
        Amount: t.amount,
        Type: t.type,
        Note: t.note || '',
        Merchant: t.merchant || '',
        PaymentMethod: t.paymentMethod || '',
        Tags: t.tags || '',
      }));

      const csvString = Papa.unparse(csvData);

      if (Platform.OS === 'web') {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'financeflow_transactions.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}financeflow_transactions.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvString);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Transactions CSV' });
      } else {
        Alert.alert('Export Failed', 'Sharing mechanism is not available on this device.');
      }
    } catch (err: any) {
      Alert.alert('Error', `Failed to export CSV: ${err.message}`);
    }
  };

  const handleExportJSON = async () => {
    try {
      if (transactions.length === 0) {
        Alert.alert('No Data', 'There are no transactions to backup.');
        return;
      }

      const backupString = JSON.stringify(transactions, null, 2);

      if (Platform.OS === 'web') {
        const blob = new Blob([backupString], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'financeflow_backup.json');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}financeflow_backup.json`;
      await FileSystem.writeAsStringAsync(fileUri, backupString);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Export Transactions JSON Backup' });
      } else {
        Alert.alert('Export Failed', 'Sharing mechanism is not available on this device.');
      }
    } catch (err: any) {
      Alert.alert('Error', `Failed to export JSON backup: ${err.message}`);
    }
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    return new Date(lastSyncTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: activeColors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: activeColors.text }]}>Settings & Tools</Text>

      {/* User profile section */}
      {user && (
        <Card style={[styles.profileCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border, borderWidth: 1 }]}>
          <Card.Content style={styles.profileContent}>
            <Avatar.Image
              size={56}
              source={{ uri: user.photoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150' }}
            />
            <View style={styles.profileMeta}>
              <Text style={[styles.profileName, { color: activeColors.text }]}>{user.name}</Text>
              <Text style={[styles.profileEmail, { color: activeColors.textSecondary }]}>{user.email}</Text>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Synchronisation Panel */}
      <List.Section title="Cloud Synchronization" titleStyle={{ color: activeColors.primary, fontWeight: 'bold' }}>
        <List.Item
          title="Google Drive Sync"
          description={`Last synced: ${formatLastSync()}`}
          left={(props) => <List.Icon {...props} icon="cloud-sync-outline" color={activeColors.text} />}
          right={() => (
            <Button 
              mode="outlined" 
              loading={syncLoading} 
              onPress={() => triggerSync()} 
              style={{ borderColor: activeColors.primary }}
              labelStyle={{ color: activeColors.primary }}
            >
              Sync Now
            </Button>
          )}
          style={[styles.listItem, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />
      </List.Section>

      {/* General Settings */}
      <List.Section title="Preferences" titleStyle={{ color: activeColors.primary, fontWeight: 'bold' }}>
        <List.Item
          title="Dark Theme"
          description="Sleek dark layout configuration"
          left={(props) => <List.Icon {...props} icon="brightness-4" color={activeColors.text} />}
          right={() => (
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              color={activeColors.primary}
            />
          )}
          style={[styles.listItem, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />

        <List.Item
          title="Manage Categories"
          description="Edit and organize category tree"
          left={(props) => <List.Icon {...props} icon="folder-outline" color={activeColors.text} />}
          onPress={() => router.push('/manage-categories')}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={activeColors.textSecondary} />}
          style={[styles.listItem, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />
      </List.Section>

      {/* Import / Export tools */}
      <List.Section title="Data Utilities" titleStyle={{ color: activeColors.primary, fontWeight: 'bold' }}>
        <List.Item
          title="Export CSV spreadsheet"
          description="Export all transactions in CSV structure"
          left={(props) => <List.Icon {...props} icon="file-delimited-outline" color={activeColors.text} />}
          onPress={handleExportCSV}
          style={[styles.listItem, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />

        <List.Item
          title="Export JSON Backup"
          description="Download database backup locally"
          left={(props) => <List.Icon {...props} icon="database-export-outline" color={activeColors.text} />}
          onPress={handleExportJSON}
          style={[styles.listItem, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />
      </List.Section>

      {/* Session Management */}
      <Button
        mode="contained"
        icon="logout"
        onPress={logout}
        style={[styles.logoutBtn, { backgroundColor: activeColors.error }]}
        labelStyle={{ color: '#fff', fontWeight: 'bold' }}
      >
        Sign Out Vault
      </Button>
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
    paddingBottom: 120,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  profileCard: {
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  profileMeta: {
    marginLeft: 16,
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  profileEmail: {
    fontSize: 13,
  },
  listItem: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    paddingVertical: 4,
  },
  logoutBtn: {
    borderRadius: 14,
    marginTop: 35,
    height: 50,
    justifyContent: 'center',
  },
});
