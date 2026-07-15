import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from './client';
import * as schema from './schema';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Helper to get/set device ID
let cachedDeviceId: string | null = null;
export async function getDeviceId(): Promise<string> {
  if (Platform.OS === 'web') {
    return 'web_browser_device';
  }
  if (cachedDeviceId) return cachedDeviceId;
  let devId = await SecureStore.getItemAsync('deviceId');
  if (!devId) {
    devId = 'device_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    await SecureStore.setItemAsync('deviceId', devId);
  }
  cachedDeviceId = devId;
  return devId;
}

// Helper to get current active Google Account ID
export async function getActiveGoogleAccountId(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('googleAccountId');
    }
    return 'mock_user_123';
  }
  return await SecureStore.getItemAsync('googleAccountId');
}

/**
 * Standard parameters for adding/updating entries.
 * Ensures the sync metadata is maintained automatically.
 */
async function prepareSyncMetadata(version = 1) {
  const deviceId = await getDeviceId();
  const googleAccountId = await getActiveGoogleAccountId();
  const now = Date.now();

  return {
    createdAt: now,
    updatedAt: now,
    version,
    isSynced: false,
    syncStatus: 'PENDING' as const,
    deviceId,
    googleAccountId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB LOCAL STORAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const getWebList = (key: string): any[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(`ff_${key}`);
  return stored ? JSON.parse(stored) : [];
};

const saveWebList = (key: string, list: any[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`ff_${key}`, JSON.stringify(list));
};

// ─────────────────────────────────────────────────────────────────────────────
// USER REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────
export const UserRepository = {
  async getProfile(id: string) {
    if (Platform.OS === 'web') {
      const usersList = getWebList('users');
      return usersList.find((u) => u.id === id && !u.deletedAt) || null;
    }
    return db.query.users.findFirst({
      where: and(eq(schema.users.id, id), isNull(schema.users.deletedAt)),
    });
  },

  async upsertProfile(data: { 
    id: string; 
    googleId: string; 
    email: string; 
    displayName?: string; 
    photoUrl?: string;
    currency?: string;
    notificationsEnabled?: boolean;
  }) {
    if (Platform.OS === 'web') {
      const meta = await prepareSyncMetadata();
      const usersList = getWebList('users');
      const idx = usersList.findIndex((u) => u.id === data.id);
      
      const record = { ...data, ...meta };
      if (idx >= 0) {
        // Merge with existing record
        const merged = { ...usersList[idx], ...data, ...meta };
        merged.createdAt = usersList[idx].createdAt; // Preserve creation
        merged.version = (usersList[idx].version || 1) + 1;
        usersList[idx] = merged;
      } else {
        usersList.push(record);
      }
      saveWebList('users', usersList);
      return [record];
    }

    const meta = await prepareSyncMetadata();
    const existing = await this.getProfile(data.id);

    if (existing) {
      const updateMeta = await prepareSyncMetadata(existing.version + 1);
      return db
        .update(schema.users)
        .set({
          ...data,
          ...updateMeta,
          createdAt: existing.createdAt, // Preserve original creation timestamp
        })
        .where(eq(schema.users.id, data.id))
        .returning();
    } else {
      return db
        .insert(schema.users)
        .values({
          ...data,
          ...meta,
        })
        .returning();
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────
export const AccountRepository = {
  async getAll() {
    if (Platform.OS === 'web') {
      return getWebList('accounts').filter((a) => !a.deletedAt);
    }
    return db.query.accounts.findMany({
      where: isNull(schema.accounts.deletedAt),
    });
  },

  async insert(data: any) {
    if (Platform.OS === 'web') {
      const meta = await prepareSyncMetadata();
      const accountsList = getWebList('accounts');
      const record = { ...data, ...meta };
      accountsList.push(record);
      saveWebList('accounts', accountsList);
      return [record];
    }
    const meta = await prepareSyncMetadata();
    return db
      .insert(schema.accounts)
      .values({
        ...data,
        ...meta,
      } as any)
      .returning();
  },

  async update(id: string, data: any) {
    if (Platform.OS === 'web') {
      const accountsList = getWebList('accounts');
      const idx = accountsList.findIndex((a) => a.id === id);
      if (idx === -1) throw new Error(`Account ${id} not found`);

      const meta = await prepareSyncMetadata((accountsList[idx].version || 1) + 1);
      const record = { ...accountsList[idx], ...data, ...meta, createdAt: accountsList[idx].createdAt };
      accountsList[idx] = record;
      saveWebList('accounts', accountsList);
      return [record];
    }

    const existing = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, id) });
    if (!existing) throw new Error(`Account ${id} not found`);

    const meta = await prepareSyncMetadata(existing.version + 1);
    return db
      .update(schema.accounts)
      .set({
        ...data,
        ...meta,
        createdAt: existing.createdAt,
      } as any)
      .where(eq(schema.accounts.id, id))
      .returning();
  },

  async delete(id: string) {
    if (Platform.OS === 'web') {
      const accountsList = getWebList('accounts');
      const idx = accountsList.findIndex((a) => a.id === id);
      if (idx === -1) throw new Error(`Account ${id} not found`);

      const meta = await prepareSyncMetadata((accountsList[idx].version || 1) + 1);
      const record = { ...accountsList[idx], deletedAt: Date.now(), ...meta, createdAt: accountsList[idx].createdAt };
      accountsList[idx] = record;
      saveWebList('accounts', accountsList);
      return [record];
    }

    const existing = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, id) });
    if (!existing) throw new Error(`Account ${id} not found`);

    const meta = await prepareSyncMetadata(existing.version + 1);
    return db
      .update(schema.accounts)
      .set({
        deletedAt: Date.now(),
        ...meta,
        createdAt: existing.createdAt,
      } as any)
      .where(eq(schema.accounts.id, id))
      .returning();
  },

  async setDefault(id: string) {
    if (Platform.OS === 'web') {
      const accountsList = getWebList('accounts');
      const updatedList = accountsList.map((a) => {
        if (a.id === id) {
          return { ...a, isDefault: true, version: (a.version || 1) + 1, isSynced: false, syncStatus: 'PENDING', updatedAt: Date.now() };
        } else if (a.isDefault) {
          return { ...a, isDefault: false, version: (a.version || 1) + 1, isSynced: false, syncStatus: 'PENDING', updatedAt: Date.now() };
        }
        return a;
      });
      saveWebList('accounts', updatedList);
      return;
    }

    const allAccounts = await db.query.accounts.findMany({
      where: isNull(schema.accounts.deletedAt),
    });

    for (const acc of allAccounts) {
      const isTarget = acc.id === id;
      if (acc.isDefault !== isTarget) {
        const meta = await prepareSyncMetadata(acc.version + 1);
        await db
          .update(schema.accounts)
          .set({
            isDefault: isTarget,
            ...meta,
            createdAt: acc.createdAt,
          } as any)
          .where(eq(schema.accounts.id, acc.id));
      }
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────
export const CategoryRepository = {
  async getAll() {
    if (Platform.OS === 'web') {
      return getWebList('categories')
        .filter((c) => !c.deletedAt)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }
    return db.query.categories.findMany({
      where: isNull(schema.categories.deletedAt),
      orderBy: [schema.categories.sortOrder],
    });
  },

  async insert(data: any) {
    if (Platform.OS === 'web') {
      const meta = await prepareSyncMetadata();
      const categoriesList = getWebList('categories');
      const record = { ...data, ...meta };
      categoriesList.push(record);
      saveWebList('categories', categoriesList);
      return [record];
    }
    const meta = await prepareSyncMetadata();
    return db
      .insert(schema.categories)
      .values({
        ...data,
        ...meta,
      } as any)
      .returning();
  },

  async update(id: string, data: any) {
    if (Platform.OS === 'web') {
      const categoriesList = getWebList('categories');
      const idx = categoriesList.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error(`Category ${id} not found`);

      const meta = await prepareSyncMetadata((categoriesList[idx].version || 1) + 1);
      const record = { ...categoriesList[idx], ...data, ...meta, createdAt: categoriesList[idx].createdAt };
      categoriesList[idx] = record;
      saveWebList('categories', categoriesList);
      return [record];
    }

    const existing = await db.query.categories.findFirst({ where: eq(schema.categories.id, id) });
    if (!existing) throw new Error(`Category ${id} not found`);

    const meta = await prepareSyncMetadata(existing.version + 1);
    return db
      .update(schema.categories)
      .set({
        ...data,
        ...meta,
        createdAt: existing.createdAt,
      } as any)
      .where(eq(schema.categories.id, id))
      .returning();
  },

  async delete(id: string) {
    if (Platform.OS === 'web') {
      const categoriesList = getWebList('categories');
      const idx = categoriesList.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error(`Category ${id} not found`);

      const meta = await prepareSyncMetadata((categoriesList[idx].version || 1) + 1);
      const record = { ...categoriesList[idx], deletedAt: Date.now(), ...meta, createdAt: categoriesList[idx].createdAt };
      categoriesList[idx] = record;
      saveWebList('categories', categoriesList);
      return [record];
    }

    const existing = await db.query.categories.findFirst({ where: eq(schema.categories.id, id) });
    if (!existing) throw new Error(`Category ${id} not found`);

    const meta = await prepareSyncMetadata(existing.version + 1);
    return db
      .update(schema.categories)
      .set({
        deletedAt: Date.now(),
        ...meta,
        createdAt: existing.createdAt,
      } as any)
      .where(eq(schema.categories.id, id))
      .returning();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────
export const TransactionRepository = {
  async getAll(limit = 100, offset = 0) {
    if (Platform.OS === 'web') {
      return getWebList('transactions')
        .filter((t) => !t.deletedAt)
        .sort((a, b) => b.date - a.date)
        .slice(offset, offset + limit);
    }
    return db.query.transactions.findMany({
      where: isNull(schema.transactions.deletedAt),
      orderBy: [sql`${schema.transactions.date} DESC`],
      limit,
      offset,
    });
  },

  async getById(id: string) {
    if (Platform.OS === 'web') {
      return getWebList('transactions').find((t) => t.id === id && !t.deletedAt) || null;
    }
    return db.query.transactions.findFirst({
      where: and(eq(schema.transactions.id, id), isNull(schema.transactions.deletedAt)),
    });
  },

  async insert(data: any) {
    if (Platform.OS === 'web') {
      const meta = await prepareSyncMetadata();
      const transactionsList = getWebList('transactions');
      const record = { ...data, ...meta };
      transactionsList.push(record);
      saveWebList('transactions', transactionsList);
      
      // Update account balance
      await updateWebAccountBalance(data.accountId);
      if (data.toAccountId) {
        await updateWebAccountBalance(data.toAccountId);
      }
      return [record];
    }

    const meta = await prepareSyncMetadata();
    return db.transaction(async (tx: any) => {
      const inserted = await tx
        .insert(schema.transactions)
        .values({
          ...data,
          ...meta,
        } as any)
        .returning();

      await updateAccountBalanceHelper(tx, data.accountId);
      if (data.toAccountId) {
        await updateAccountBalanceHelper(tx, data.toAccountId);
      }

      return inserted;
    });
  },

  async update(id: string, data: any) {
    if (Platform.OS === 'web') {
      const transactionsList = getWebList('transactions');
      const idx = transactionsList.findIndex((t) => t.id === id);
      if (idx === -1) throw new Error(`Transaction ${id} not found`);

      const meta = await prepareSyncMetadata((transactionsList[idx].version || 1) + 1);
      const originalAccountId = transactionsList[idx].accountId;
      const originalToAccountId = transactionsList[idx].toAccountId;

      const record = { ...transactionsList[idx], ...data, ...meta, createdAt: transactionsList[idx].createdAt };
      transactionsList[idx] = record;
      saveWebList('transactions', transactionsList);

      // Recompute accounts balances
      await updateWebAccountBalance(originalAccountId);
      if (data.accountId && data.accountId !== originalAccountId) {
        await updateWebAccountBalance(data.accountId);
      }
      if (originalToAccountId) {
        await updateWebAccountBalance(originalToAccountId);
      }
      if (data.toAccountId && data.toAccountId !== originalToAccountId) {
        await updateWebAccountBalance(data.toAccountId);
      }

      return [record];
    }

    const existing = await db.query.transactions.findFirst({ where: eq(schema.transactions.id, id) });
    if (!existing) throw new Error(`Transaction ${id} not found`);

    const meta = await prepareSyncMetadata(existing.version + 1);
    
    return db.transaction(async (tx: any) => {
      const updated = await tx
        .update(schema.transactions)
        .set({
          ...data,
          ...meta,
          createdAt: existing.createdAt,
        } as any)
        .where(eq(schema.transactions.id, id))
        .returning();

      await updateAccountBalanceHelper(tx, existing.accountId);
      if (data.accountId && data.accountId !== existing.accountId) {
        await updateAccountBalanceHelper(tx, data.accountId);
      }
      if (existing.toAccountId) {
        await updateAccountBalanceHelper(tx, existing.toAccountId);
      }
      if (data.toAccountId && data.toAccountId !== existing.toAccountId) {
        await updateAccountBalanceHelper(tx, data.toAccountId);
      }

      return updated;
    });
  },

  async delete(id: string) {
    if (Platform.OS === 'web') {
      const transactionsList = getWebList('transactions');
      const idx = transactionsList.findIndex((t) => t.id === id);
      if (idx === -1) throw new Error(`Transaction ${id} not found`);

      const meta = await prepareSyncMetadata((transactionsList[idx].version || 1) + 1);
      const originalAccountId = transactionsList[idx].accountId;
      const originalToAccountId = transactionsList[idx].toAccountId;

      const record = { ...transactionsList[idx], deletedAt: Date.now(), ...meta, createdAt: transactionsList[idx].createdAt };
      transactionsList[idx] = record;
      saveWebList('transactions', transactionsList);

      // Recompute account balances
      await updateWebAccountBalance(originalAccountId);
      if (originalToAccountId) {
        await updateWebAccountBalance(originalToAccountId);
      }
      return [record];
    }

    const existing = await db.query.transactions.findFirst({ where: eq(schema.transactions.id, id) });
    if (!existing) throw new Error(`Transaction ${id} not found`);

    const meta = await prepareSyncMetadata(existing.version + 1);
    
    return db.transaction(async (tx: any) => {
      const deleted = await tx
        .update(schema.transactions)
        .set({
          deletedAt: Date.now(),
          ...meta,
          createdAt: existing.createdAt,
        } as any)
        .where(eq(schema.transactions.id, id))
        .returning();

      await updateAccountBalanceHelper(tx, existing.accountId);
      if (existing.toAccountId) {
        await updateAccountBalanceHelper(tx, existing.toAccountId);
      }

      return deleted;
    });
  },
};

/**
 * Re-calculate dynamic account balance based on transactions history (Web implementation)
 */
async function updateWebAccountBalance(accountId: string) {
  const accountsList = getWebList('accounts');
  const accIdx = accountsList.findIndex(a => a.id === accountId);
  if (accIdx === -1) return;

  const transactionsList = getWebList('transactions').filter(t => !t.deletedAt);

  const totalIncome = transactionsList
    .filter(t => t.accountId === accountId && t.type === 'INCOME')
    .reduce((sum, curr) => sum + curr.amount, 0);

  const totalExpense = transactionsList
    .filter(t => t.accountId === accountId && t.type === 'EXPENSE')
    .reduce((sum, curr) => sum + curr.amount, 0);

  const totalTransfersOut = transactionsList
    .filter(t => t.accountId === accountId && t.type === 'TRANSFER')
    .reduce((sum, curr) => sum + curr.amount, 0);

  const totalTransfersIn = transactionsList
    .filter(t => t.toAccountId === accountId && t.type === 'TRANSFER')
    .reduce((sum, curr) => sum + curr.amount, 0);

  accountsList[accIdx].balance = 
    accountsList[accIdx].openingBalance + totalIncome - totalExpense - totalTransfersOut + totalTransfersIn;

  saveWebList('accounts', accountsList);
}

/**
 * Re-calculate dynamic account balance based on transactions history (Native implementation)
 */
async function updateAccountBalanceHelper(tx: any, accountId: string) {
  const account = await tx.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) });
  if (!account) return;

  const incomeResult = await tx
    .select({ sum: sql<number>`sum(${schema.transactions.amount})` })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.accountId, accountId),
        eq(schema.transactions.type, 'INCOME'),
        isNull(schema.transactions.deletedAt)
      )
    );

  const expenseResult = await tx
    .select({ sum: sql<number>`sum(${schema.transactions.amount})` })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.accountId, accountId),
        eq(schema.transactions.type, 'EXPENSE'),
        isNull(schema.transactions.deletedAt)
      )
    );

  const transferOutResult = await tx
    .select({ sum: sql<number>`sum(${schema.transactions.amount})` })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.accountId, accountId),
        eq(schema.transactions.type, 'TRANSFER'),
        isNull(schema.transactions.deletedAt)
      )
    );

  const transferInResult = await tx
    .select({ sum: sql<number>`sum(${schema.transactions.amount})` })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.toAccountId, accountId),
        eq(schema.transactions.type, 'TRANSFER'),
        isNull(schema.transactions.deletedAt)
      )
    );

  const totalIncome = incomeResult[0]?.sum || 0;
  const totalExpense = expenseResult[0]?.sum || 0;
  const totalTransfersOut = transferOutResult[0]?.sum || 0;
  const totalTransfersIn = transferInResult[0]?.sum || 0;

  const currentBalance = account.openingBalance + totalIncome - totalExpense - totalTransfersOut + totalTransfersIn;

  await tx
    .update(schema.accounts)
    .set({ balance: currentBalance })
    .where(eq(schema.accounts.id, accountId));
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────
export const BudgetRepository = {
  async getAll() {
    if (Platform.OS === 'web') {
      return getWebList('budgets').filter((b) => !b.deletedAt);
    }
    return db.query.budgets.findMany({
      where: isNull(schema.budgets.deletedAt),
    });
  },

  async insert(data: any) {
    if (Platform.OS === 'web') {
      const meta = await prepareSyncMetadata();
      const list = getWebList('budgets');
      const record = { ...data, ...meta };
      list.push(record);
      saveWebList('budgets', list);
      return [record];
    }
    const meta = await prepareSyncMetadata();
    return db
      .insert(schema.budgets)
      .values({
        ...data,
        ...meta,
      } as any)
      .returning();
  },

  async update(id: string, data: any) {
    if (Platform.OS === 'web') {
      const list = getWebList('budgets');
      const idx = list.findIndex((b) => b.id === id);
      if (idx === -1) throw new Error(`Budget ${id} not found`);

      const meta = await prepareSyncMetadata((list[idx].version || 1) + 1);
      const record = { ...list[idx], ...data, ...meta, createdAt: list[idx].createdAt };
      list[idx] = record;
      saveWebList('budgets', list);
      return [record];
    }

    const existing = await db.query.budgets.findFirst({ where: eq(schema.budgets.id, id) });
    if (!existing) throw new Error(`Budget ${id} not found`);

    const meta = await prepareSyncMetadata(existing.version + 1);
    return db
      .update(schema.budgets)
      .set({
        ...data,
        ...meta,
        createdAt: existing.createdAt,
      } as any)
      .where(eq(schema.budgets.id, id))
      .returning();
  },

  async delete(id: string) {
    if (Platform.OS === 'web') {
      const list = getWebList('budgets');
      const idx = list.findIndex((b) => b.id === id);
      if (idx === -1) throw new Error(`Budget ${id} not found`);

      const meta = await prepareSyncMetadata((list[idx].version || 1) + 1);
      const record = { ...list[idx], deletedAt: Date.now(), ...meta, createdAt: list[idx].createdAt };
      list[idx] = record;
      saveWebList('budgets', list);
      return [record];
    }

    const existing = await db.query.budgets.findFirst({ where: eq(schema.budgets.id, id) });
    if (!existing) throw new Error(`Budget ${id} not found`);

    const meta = await prepareSyncMetadata(existing.version + 1);
    return db
      .update(schema.budgets)
      .set({
        deletedAt: Date.now(),
        ...meta,
        createdAt: existing.createdAt,
      } as any)
      .where(eq(schema.budgets.id, id))
      .returning();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GOAL REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────
export const GoalRepository = {
  async getAll() {
    if (Platform.OS === 'web') {
      return getWebList('goals').filter((g) => !g.deletedAt);
    }
    return db.query.goals.findMany({
      where: isNull(schema.goals.deletedAt),
    });
  },

  async insert(data: any) {
    if (Platform.OS === 'web') {
      const meta = await prepareSyncMetadata();
      const list = getWebList('goals');
      const record = { ...data, ...meta };
      list.push(record);
      saveWebList('goals', list);
      return [record];
    }
    const meta = await prepareSyncMetadata();
    return db
      .insert(schema.goals)
      .values({
        ...data,
        ...meta,
      } as any)
      .returning();
  },

  async update(id: string, data: any) {
    if (Platform.OS === 'web') {
      const list = getWebList('goals');
      const idx = list.findIndex((g) => g.id === id);
      if (idx === -1) throw new Error(`Goal ${id} not found`);

      const meta = await prepareSyncMetadata((list[idx].version || 1) + 1);
      const record = { ...list[idx], ...data, ...meta, createdAt: list[idx].createdAt };
      list[idx] = record;
      saveWebList('goals', list);
      return [record];
    }

    const existing = await db.query.goals.findFirst({ where: eq(schema.goals.id, id) });
    if (!existing) throw new Error(`Goal ${id} not found`);

    const meta = await prepareSyncMetadata(existing.version + 1);
    return db
      .update(schema.goals)
      .set({
        ...data,
        ...meta,
        createdAt: existing.createdAt,
      } as any)
      .where(eq(schema.goals.id, id))
      .returning();
  },

  async delete(id: string) {
    if (Platform.OS === 'web') {
      const list = getWebList('goals');
      const idx = list.findIndex((g) => g.id === id);
      if (idx === -1) throw new Error(`Goal ${id} not found`);

      const meta = await prepareSyncMetadata((list[idx].version || 1) + 1);
      const record = { ...list[idx], deletedAt: Date.now(), ...meta, createdAt: list[idx].createdAt };
      list[idx] = record;
      saveWebList('goals', list);
      return [record];
    }

    const existing = await db.query.goals.findFirst({ where: eq(schema.goals.id, id) });
    if (!existing) throw new Error(`Goal ${id} not found`);

    const meta = await prepareSyncMetadata(existing.version + 1);
    return db
      .update(schema.goals)
      .set({
        deletedAt: Date.now(),
        ...meta,
        createdAt: existing.createdAt,
      } as any)
      .where(eq(schema.goals.id, id))
      .returning();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BILL REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────
export const BillRepository = {
  async getAll() {
    if (Platform.OS === 'web') {
      return getWebList('bills').filter((b) => !b.deletedAt);
    }
    return db.query.bills.findMany({
      where: isNull(schema.bills.deletedAt),
    });
  },

  async insert(data: any) {
    if (Platform.OS === 'web') {
      const meta = await prepareSyncMetadata();
      const list = getWebList('bills');
      const record = { ...data, ...meta };
      list.push(record);
      saveWebList('bills', list);
      return [record];
    }
    const meta = await prepareSyncMetadata();
    return db
      .insert(schema.bills)
      .values({
        ...data,
        ...meta,
      } as any)
      .returning();
  },

  async update(id: string, data: any) {
    if (Platform.OS === 'web') {
      const list = getWebList('bills');
      const idx = list.findIndex((b) => b.id === id);
      if (idx === -1) throw new Error(`Bill ${id} not found`);

      const meta = await prepareSyncMetadata((list[idx].version || 1) + 1);
      const record = { ...list[idx], ...data, ...meta, createdAt: list[idx].createdAt };
      list[idx] = record;
      saveWebList('bills', list);
      return [record];
    }

    const existing = await db.query.bills.findFirst({ where: eq(schema.bills.id, id) });
    if (!existing) throw new Error(`Bill ${id} not found`);

    const meta = await prepareSyncMetadata(existing.version + 1);
    return db
      .update(schema.bills)
      .set({
        ...data,
        ...meta,
        createdAt: existing.createdAt,
      } as any)
      .where(eq(schema.bills.id, id))
      .returning();
  },

  async delete(id: string) {
    if (Platform.OS === 'web') {
      const list = getWebList('bills');
      const idx = list.findIndex((b) => b.id === id);
      if (idx === -1) throw new Error(`Bill ${id} not found`);

      const meta = await prepareSyncMetadata((list[idx].version || 1) + 1);
      const record = { ...list[idx], deletedAt: Date.now(), ...meta, createdAt: list[idx].createdAt };
      list[idx] = record;
      saveWebList('bills', list);
      return [record];
    }

    const existing = await db.query.bills.findFirst({ where: eq(schema.bills.id, id) });
    if (!existing) throw new Error(`Bill ${id} not found`);

    const meta = await prepareSyncMetadata(existing.version + 1);
    return db
      .update(schema.bills)
      .set({
        deletedAt: Date.now(),
        ...meta,
        createdAt: existing.createdAt,
      } as any)
      .where(eq(schema.bills.id, id))
      .returning();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SMART SMS TRANSACTION DETECTION ENGINE (STDE) REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────
export const SmsRepository = {
  // --- TEMPORARY TRANSACTIONS ---
  async getTempTransactions() {
    if (Platform.OS === 'web') {
      return getWebList('temp_transactions');
    }
    return db.query.tempTransactions.findMany();
  },

  async getPendingTransactions() {
    if (Platform.OS === 'web') {
      return getWebList('temp_transactions').filter(t => t.status === 'PENDING');
    }
    return db.query.tempTransactions.findMany({
      where: eq(schema.tempTransactions.status, 'PENDING')
    });
  },

  async saveTempTransaction(data: any) {
    const now = Date.now();
    const payload = {
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: now
    };

    if (Platform.OS === 'web') {
      const list = getWebList('temp_transactions');
      const idx = list.findIndex((t) => t.id === payload.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...payload };
      } else {
        list.push(payload);
      }
      saveWebList('temp_transactions', list);
      return;
    }

    const existing = await db.query.tempTransactions.findFirst({
      where: eq(schema.tempTransactions.id, payload.id)
    });

    if (existing) {
      await db.update(schema.tempTransactions)
        .set(payload)
        .where(eq(schema.tempTransactions.id, payload.id));
    } else {
      await db.insert(schema.tempTransactions).values(payload);
    }
  },

  async getAutoSavedToday() {
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    if (Platform.OS === 'web') {
      return getWebList('temp_transactions').filter(
        t => t.status === 'AUTO_SAVED' && t.transactionDate >= startOfToday
      ).length;
    }

    const results = await db.query.tempTransactions.findMany({
      where: and(
        eq(schema.tempTransactions.status, 'AUTO_SAVED'),
        sql`${schema.tempTransactions.transactionDate} >= ${startOfToday}`
      )
    });
    return results.length;
  },

  async getTodaySummary() {
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    if (Platform.OS === 'web') {
      const todayTx = getWebList('temp_transactions').filter(t => t.transactionDate >= startOfToday);
      return {
        total: todayTx.length,
        autoSaved: todayTx.filter(t => t.status === 'AUTO_SAVED').length,
        pendingReview: todayTx.filter(t => t.status === 'PENDING').length,
      };
    }

    const todayTx = await db.query.tempTransactions.findMany({
      where: sql`${schema.tempTransactions.transactionDate} >= ${startOfToday}`
    });

    return {
      total: todayTx.length,
      autoSaved: todayTx.filter((t: any) => t.status === 'AUTO_SAVED').length,
      pendingReview: todayTx.filter((t: any) => t.status === 'PENDING').length,
    };
  },

  async markApproved(id: string) {
    if (Platform.OS === 'web') {
      const list = getWebList('temp_transactions');
      const idx = list.findIndex(t => t.id === id);
      if (idx !== -1) {
        list[idx].status = 'APPROVED';
        list[idx].processed = true;
        list[idx].updatedAt = Date.now();
        saveWebList('temp_transactions', list);
      }
      return;
    }
    await db.update(schema.tempTransactions)
      .set({ status: 'APPROVED', processed: true, updatedAt: Date.now() })
      .where(eq(schema.tempTransactions.id, id));
  },

  async markSkipped(id: string) {
    if (Platform.OS === 'web') {
      const list = getWebList('temp_transactions');
      const idx = list.findIndex(t => t.id === id);
      if (idx !== -1) {
        list[idx].status = 'SKIPPED';
        list[idx].processed = true;
        list[idx].updatedAt = Date.now();
        saveWebList('temp_transactions', list);
      }
      return;
    }
    await db.update(schema.tempTransactions)
      .set({ status: 'SKIPPED', processed: true, updatedAt: Date.now() })
      .where(eq(schema.tempTransactions.id, id));
  },

  async markAutoSaved(id: string) {
    if (Platform.OS === 'web') {
      const list = getWebList('temp_transactions');
      const idx = list.findIndex(t => t.id === id);
      if (idx !== -1) {
        list[idx].status = 'AUTO_SAVED';
        list[idx].processed = true;
        list[idx].updatedAt = Date.now();
        saveWebList('temp_transactions', list);
      }
      return;
    }
    await db.update(schema.tempTransactions)
      .set({ status: 'AUTO_SAVED', processed: true, updatedAt: Date.now() })
      .where(eq(schema.tempTransactions.id, id));
  },

  async hashExists(hash: string) {
    if (Platform.OS === 'web') {
      return getWebList('temp_transactions').some(t => t.smsHash === hash);
    }
    const match = await db.query.tempTransactions.findFirst({
      where: eq(schema.tempTransactions.smsHash, hash)
    });
    return !!match;
  },

  // --- RULES ---
  async getRules() {
    if (Platform.OS === 'web') {
      return getWebList('sms_rules');
    }
    return db.query.smsRules.findMany();
  },

  async saveRule(rule: any) {
    const now = Date.now();
    const payload = {
      ...rule,
      createdAt: rule.createdAt || now,
      updatedAt: now
    };

    if (Platform.OS === 'web') {
      const list = getWebList('sms_rules');
      const idx = list.findIndex(r => r.id === payload.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...payload };
      } else {
        list.push(payload);
      }
      saveWebList('sms_rules', list);
      return;
    }

    const existing = await db.query.smsRules.findFirst({
      where: eq(schema.smsRules.id, payload.id)
    });

    if (existing) {
      await db.update(schema.smsRules)
        .set(payload)
        .where(eq(schema.smsRules.id, payload.id));
    } else {
      await db.insert(schema.smsRules).values(payload);
    }
  },

  async deleteRule(id: string) {
    if (Platform.OS === 'web') {
      const list = getWebList('sms_rules');
      const updated = list.filter(r => r.id !== id);
      saveWebList('sms_rules', updated);
      return;
    }
    await db.delete(schema.smsRules).where(eq(schema.smsRules.id, id));
  },

  async findRuleByMerchant(merchant: string) {
    const term = merchant.trim().toLowerCase();
    if (Platform.OS === 'web') {
      return getWebList('sms_rules').find(
        r => r.ruleType === 'MERCHANT' && r.merchantPattern?.toLowerCase() === term
      ) || null;
    }
    return db.query.smsRules.findFirst({
      where: and(
        eq(schema.smsRules.ruleType, 'MERCHANT'),
        sql`LOWER(${schema.smsRules.merchantPattern}) = ${term}`
      )
    }) || null;
  },

  async findRuleByUpi(upiId: string) {
    const term = upiId.trim().toLowerCase();
    if (Platform.OS === 'web') {
      return getWebList('sms_rules').find(
        r => r.ruleType === 'UPI' && r.upiId?.toLowerCase() === term
      ) || null;
    }
    return db.query.smsRules.findFirst({
      where: and(
        eq(schema.smsRules.ruleType, 'UPI'),
        sql`LOWER(${schema.smsRules.upiId}) = ${term}`
      )
    }) || null;
  },

  async findRuleByAccount(bankName: string, last4: string) {
    const bank = bankName.trim().toLowerCase();
    const num = last4.trim();
    if (Platform.OS === 'web') {
      return getWebList('sms_rules').find(
        r => r.ruleType === 'ACCOUNT' && 
             r.bankName?.toLowerCase() === bank && 
             r.accountLast4 === num
      ) || null;
    }
    return db.query.smsRules.findFirst({
      where: and(
        eq(schema.smsRules.ruleType, 'ACCOUNT'),
        sql`LOWER(${schema.smsRules.bankName}) = ${bank}`,
        eq(schema.smsRules.accountLast4, num)
      )
    }) || null;
  },

  async updateRuleStats(ruleId: string, decision: 'accepted' | 'edited' | 'rejected' | 'skipped' | 'auto_saved') {
    if (Platform.OS === 'web') {
      const list = getWebList('sms_rules');
      const idx = list.findIndex(r => r.id === ruleId);
      if (idx !== -1) {
        const rule = list[idx];
        if (decision === 'accepted') rule.acceptedCount++;
        else if (decision === 'edited') rule.editedCount++;
        else if (decision === 'rejected') rule.rejectedCount++;
        else if (decision === 'skipped') rule.skippedCount++;
        else if (decision === 'auto_saved') rule.autoSavedCount++;
        rule.lastUsed = Date.now();
        saveWebList('sms_rules', list);
        await this.recalculateConfidence(ruleId);
      }
      return;
    }

    const existing = await db.query.smsRules.findFirst({ where: eq(schema.smsRules.id, ruleId) });
    if (!existing) return;

    const updates: any = { lastUsed: Date.now() };
    if (decision === 'accepted') updates.acceptedCount = existing.acceptedCount + 1;
    else if (decision === 'edited') updates.editedCount = existing.editedCount + 1;
    else if (decision === 'rejected') updates.rejectedCount = existing.rejectedCount + 1;
    else if (decision === 'skipped') updates.skippedCount = existing.skippedCount + 1;
    else if (decision === 'auto_saved') updates.autoSavedCount = existing.autoSavedCount + 1;

    await db.update(schema.smsRules).set(updates).where(eq(schema.smsRules.id, ruleId));
    await this.recalculateConfidence(ruleId);
  },

  async toggleRuleEnabled(ruleId: string, isEnabled: boolean) {
    if (Platform.OS === 'web') {
      const list = getWebList('sms_rules');
      const idx = list.findIndex(r => r.id === ruleId);
      if (idx !== -1) {
        list[idx].isEnabled = isEnabled;
        saveWebList('sms_rules', list);
      }
      return;
    }
    await db.update(schema.smsRules)
      .set({ isEnabled, updatedAt: Date.now() })
      .where(eq(schema.smsRules.id, ruleId));
  },

  async recalculateConfidence(ruleId: string) {
    if (Platform.OS === 'web') {
      const list = getWebList('sms_rules');
      const idx = list.findIndex(r => r.id === ruleId);
      if (idx !== -1) {
        const r = list[idx];
        const totalObservations = r.acceptedCount + r.autoSavedCount + r.editedCount + r.rejectedCount;
        if (totalObservations < 2) {
          r.confidence = 0; // Not enough data to be confident yet
        } else {
          // formula: (accepted + autoSaved) * 100 / (accepted + autoSaved + edited * 2 + rejected * 3)
          const positive = r.acceptedCount + r.autoSavedCount;
          const penalty = (r.editedCount * 2) + (r.rejectedCount * 3);
          const rawConf = (positive * 100) / (positive + penalty);
          r.confidence = Math.max(0, Math.min(100, Math.round(rawConf)));
        }
        saveWebList('sms_rules', list);
      }
      return;
    }

    const r = await db.query.smsRules.findFirst({ where: eq(schema.smsRules.id, ruleId) });
    if (!r) return;

    const totalObservations = r.acceptedCount + r.autoSavedCount + r.editedCount + r.rejectedCount;
    let confidence = 0;
    if (totalObservations >= 2) {
      const positive = r.acceptedCount + r.autoSavedCount;
      const penalty = (r.editedCount * 2) + (r.rejectedCount * 3);
      const rawConf = (positive * 100) / (positive + penalty);
      confidence = Math.max(0, Math.min(100, Math.round(rawConf)));
    }

    await db.update(schema.smsRules)
      .set({ confidence, updatedAt: Date.now() })
      .where(eq(schema.smsRules.id, ruleId));
  },

  // --- SETTINGS ---
  async getSettings() {
    if (Platform.OS === 'web') {
      const list = getWebList('sms_settings');
      if (list.length === 0) {
        const defaultSettings = {
          id: 'default_sms_settings',
          autoSaveThreshold: 98,
          autoSuggestThreshold: 80,
          reviewThreshold: 60,
          isEnabled: true,
          lastProcessedSmsId: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        saveWebList('sms_settings', [defaultSettings]);
        return defaultSettings;
      }
      return list[0];
    }

    const settings = await db.query.smsSettings.findFirst();
    if (!settings) {
      const defaultSettings = {
        id: 'default_sms_settings',
        autoSaveThreshold: 98,
        autoSuggestThreshold: 80,
        reviewThreshold: 60,
        isEnabled: true,
        lastProcessedSmsId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.insert(schema.smsSettings).values(defaultSettings);
      return defaultSettings;
    }
    return settings;
  },

  async updateSettings(data: any) {
    const current = await this.getSettings();
    const payload = {
      ...current,
      ...data,
      updatedAt: Date.now()
    };

    if (Platform.OS === 'web') {
      saveWebList('sms_settings', [payload]);
      return;
    }

    await db.update(schema.smsSettings)
      .set(payload)
      .where(eq(schema.smsSettings.id, current.id));
  },

  async resetAllRulesAndData() {
    if (Platform.OS === 'web') {
      localStorage.setItem('sms_rules', JSON.stringify([]));
      localStorage.setItem('temp_transactions', JSON.stringify([]));
      localStorage.setItem('sms_settings', JSON.stringify([]));
      return;
    }
    await db.delete(schema.tempTransactions);
    await db.delete(schema.smsRules);
    await db.delete(schema.smsSettings);
  },
};

