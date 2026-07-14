import { Platform } from 'react-native';
import { db } from '../db/client';
import * as schema from '../db/schema';

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

// Supported export/import tables list with corresponding storage keys for web
const EXPORTABLE_TABLES = [
  { key: 'users', table: schema.users, storageKey: 'ff_users' },
  { key: 'accounts', table: schema.accounts, storageKey: 'ff_accounts' },
  { key: 'categories', table: schema.categories, storageKey: 'ff_categories' },
  { key: 'transactions', table: schema.transactions, storageKey: 'ff_transactions' },
  { key: 'budgets', table: schema.budgets, storageKey: 'ff_budgets' },
  { key: 'goals', table: schema.goals, storageKey: 'ff_goals' },
  { key: 'bills', table: schema.bills, storageKey: 'ff_bills' },
  { key: 'recurringTransactions', table: schema.recurringTransactions, storageKey: 'ff_recurring_transactions' },
  { key: 'tags', table: schema.tags, storageKey: 'ff_tags' },
  { key: 'attachments', table: schema.attachments, storageKey: 'ff_attachments' },
  { key: 'loans', table: schema.loans, storageKey: 'ff_loans' },
  { key: 'investments', table: schema.investments, storageKey: 'ff_investments' },
  { key: 'syncLogs', table: schema.syncLogs, storageKey: 'ff_sync_logs' },
  { key: 'auditLogs', table: schema.auditLogs, storageKey: 'ff_audit_logs' },
];

export const ExportImportService = {
  /**
   * Export all database tables to a structured JSON file.
   */
  async exportBackup(): Promise<void> {
    const backupData: Record<string, any> = {
      metadata: {
        version: '1.0.0',
        exportedAt: Date.now(),
        platform: Platform.OS,
      },
      data: {},
    };

    // 1. Gather all data
    for (const { key, table, storageKey } of EXPORTABLE_TABLES) {
      if (Platform.OS === 'web') {
        const stored = localStorage.getItem(storageKey);
        backupData.data[key] = stored ? JSON.parse(stored) : [];
      } else {
        if (!db) {
          backupData.data[key] = [];
          continue;
        }
        backupData.data[key] = await db.select().from(table);
      }
    }

    const backupString = JSON.stringify(backupData, null, 2);

    // 2. Export / share
    if (Platform.OS === 'web') {
      const blob = new Blob([backupString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ezfinance_backup_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (!FileSystem || !Sharing) {
      throw new Error('Native file system or sharing module is not available');
    }

    const fileUri = `${FileSystem.cacheDirectory}ezfinance_backup_${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(fileUri, backupString);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Backup JSON',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  },

  /**
   * Import database backup from JSON string.
   */
  async importBackup(backupContent: string): Promise<{ success: boolean; recordsCount: number }> {
    const backupData = JSON.parse(backupContent);

    // 1. Validate structure
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('Invalid backup file format');
    }
    if (!backupData.metadata || !backupData.data) {
      throw new Error('Missing metadata or data section in backup file');
    }

    let recordsCount = 0;

    // 2. Perform restore
    if (Platform.OS === 'web') {
      for (const { key, storageKey } of EXPORTABLE_TABLES) {
        const tableData = backupData.data[key] || [];
        localStorage.setItem(storageKey, JSON.stringify(tableData));
        recordsCount += tableData.length;
      }
    } else {
      if (!db) {
        throw new Error('SQLite database is not initialized');
      }

      await db.transaction(async (tx: any) => {
        // Delete all existing data in reverse order of foreign key dependency
        const tablesToDelete = [
          schema.auditLogs,
          schema.syncLogs,
          schema.investments,
          schema.loans,
          schema.attachments,
          schema.tags,
          schema.recurringTransactions,
          schema.bills,
          schema.goals,
          schema.budgets,
          schema.transactions,
          schema.categories,
          schema.accounts,
          schema.users,
        ];

        for (const table of tablesToDelete) {
          await tx.delete(table);
        }

        // Insert new records in safe chunks to prevent SQLite parameter limits
        for (const { key, table } of EXPORTABLE_TABLES) {
          const records = backupData.data[key] || [];
          if (records.length > 0) {
            const chunkSize = 50;
            for (let i = 0; i < records.length; i += chunkSize) {
              const chunk = records.slice(i, i + chunkSize);
              await tx.insert(table).values(chunk);
            }
            recordsCount += records.length;
          }
        }
      });
    }

    return { success: true, recordsCount };
  }
};
