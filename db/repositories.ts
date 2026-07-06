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

  async upsertProfile(data: { id: string; googleId: string; email: string; displayName?: string; photoUrl?: string }) {
    if (Platform.OS === 'web') {
      const meta = await prepareSyncMetadata();
      const usersList = getWebList('users');
      const idx = usersList.findIndex((u) => u.id === data.id);
      
      const record = { ...data, ...meta };
      if (idx >= 0) {
        record.createdAt = usersList[idx].createdAt; // Preserve creation
        record.version = (usersList[idx].version || 1) + 1;
        usersList[idx] = record;
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
