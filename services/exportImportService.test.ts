// Mock localStorage first
class LocalStorageMock {
  store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

global.localStorage = new LocalStorageMock() as any;

const mockLink = {
  href: '',
  setAttribute: jest.fn(),
  click: jest.fn(),
};

global.document = {
  createElement: jest.fn().mockReturnValue(mockLink),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
  },
} as any;

global.URL = {
  createObjectURL: jest.fn().mockReturnValue('mock-url'),
  revokeObjectURL: jest.fn(),
} as any;

// Mock db/client and db/schema next before importing ExportImportService
jest.mock('../db/client', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockResolvedValue([]),
    transaction: jest.fn(),
  },
}));

jest.mock('../db/schema', () => ({
  users: {},
  accounts: {},
  categories: {},
  transactions: {},
  budgets: {},
  goals: {},
  bills: {},
  recurringTransactions: {},
  tags: {},
  attachments: {},
  loans: {},
  investments: {},
  syncLogs: {},
  auditLogs: {},
}));

import { ExportImportService } from './exportImportService';
import { Platform } from 'react-native';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}));

describe('ExportImportService (Web)', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('exports localstorage data to JSON backup file', async () => {
    localStorage.setItem('ff_accounts', JSON.stringify([{ id: 'acc1', name: 'Cash' }]));
    localStorage.setItem('ff_categories', JSON.stringify([{ id: 'cat1', name: 'Food' }]));
    localStorage.setItem('ff_transactions', JSON.stringify([{ id: 'tx1', amount: 50 }]));

    await ExportImportService.exportBackup();

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(mockLink.setAttribute).toHaveBeenCalledWith('download', expect.stringContaining('ezfinance_backup_'));
    expect(mockLink.click).toHaveBeenCalled();
  });

  it('imports JSON backup file into localstorage keys', async () => {
    const backupData = {
      metadata: {
        version: '1.0.0',
        exportedAt: Date.now(),
        platform: 'web',
      },
      data: {
        accounts: [{ id: 'acc_imported', name: 'Imported Card' }],
        categories: [{ id: 'cat_imported', name: 'Imported Rent' }],
        transactions: [{ id: 'tx_imported', amount: 1500 }],
      },
    };

    const result = await ExportImportService.importBackup(JSON.stringify(backupData));

    expect(result.success).toBe(true);
    expect(result.recordsCount).toBe(3);

    const accounts = JSON.parse(localStorage.getItem('ff_accounts') || '[]');
    expect(accounts).toEqual([{ id: 'acc_imported', name: 'Imported Card' }]);

    const categories = JSON.parse(localStorage.getItem('ff_categories') || '[]');
    expect(categories).toEqual([{ id: 'cat_imported', name: 'Imported Rent' }]);
  });

  it('throws error when backup data format is invalid', async () => {
    await expect(ExportImportService.importBackup('{}')).rejects.toThrow();
    await expect(ExportImportService.importBackup('invalid json')).rejects.toThrow();
  });
});
