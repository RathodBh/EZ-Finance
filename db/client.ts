import { Platform } from 'react-native';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'financeflow.db';

export let expoDb: any = null;
export let db: any = null;

// Only initialize native database on iOS / Android platforms to prevent web SharedArrayBuffer crashes
if (Platform.OS !== 'web') {
  try {
    const { openDatabaseSync } = require('expo-sqlite');
    expoDb = openDatabaseSync(DB_NAME);
    db = drizzle(expoDb, { schema });
  } catch (err) {
    console.error('Failed to initialize native SQLite client:', err);
  }
}

/**
 * Initialize the database schema if tables do not exist.
 * We run the raw Drizzle generated DDL statements to construct the SQLite database.
 */
export async function initDb() {
  if (Platform.OS === 'web') {
    console.log('Running in Web Sandbox. Initializing LocalStorage databases...');
    // Seed localStorage if not present
    ensureWebSeeds();
    return;
  }

  if (!expoDb) return;

  try {
    // Check if the 'users' table exists as an indicator of database state
    const tableCheck = expoDb.getFirstSync<{ count: number }>(
      "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='users';"
    );

    if (!tableCheck || tableCheck.count === 0) {
      console.log('Database tables not found. Running database migrations...');

      expoDb.withTransactionSync(() => {
        // 1. Create accounts
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`accounts\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`name\` text NOT NULL,
            \`type\` text NOT NULL,
            \`balance\` real DEFAULT 0 NOT NULL,
            \`opening_balance\` real DEFAULT 0 NOT NULL,
            \`currency\` text DEFAULT 'USD' NOT NULL,
            \`icon\` text,
            \`color\` text,
            \`is_active\` integer DEFAULT 1 NOT NULL
          );
        `);

        // 2. Create attachments
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`attachments\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`transaction_id\` text NOT NULL,
            \`file_uri\` text NOT NULL,
            \`file_type\` text NOT NULL,
            \`local_path\` text,
            \`drive_path\` text,
            \`size_bytes\` integer
          );
        `);

        // 3. Create audit logs
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`audit_logs\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`entity_type\` text NOT NULL,
            \`entity_id\` text NOT NULL,
            \`action\` text NOT NULL,
            \`old_value\` text,
            \`new_value\` text,
            \`timestamp\` integer NOT NULL
          );
        `);

        // 4. Create bills
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`bills\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`name\` text NOT NULL,
            \`amount\` real NOT NULL,
            \`due_date\` integer NOT NULL,
            \`category\` text,
            \`is_recurring\` integer DEFAULT 0 NOT NULL,
            \`frequency\` text,
            \`is_paid\` integer DEFAULT 0 NOT NULL,
            \`reminder_enabled\` integer DEFAULT 1 NOT NULL
          );
        `);

        // 5. Create budgets
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`budgets\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`category_id\` text NOT NULL,
            \`amount\` real NOT NULL,
            \`period\` text NOT NULL,
            \`start_date\` integer NOT NULL,
            \`end_date\` integer NOT NULL,
            \`carry_forward\` integer DEFAULT 0 NOT NULL,
            \`alert_threshold\` real DEFAULT 0.8 NOT NULL
          );
        `);

        // 6. Create categories
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`categories\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`name\` text NOT NULL,
            \`parent_id\` text,
            \`type\` text NOT NULL,
            \`icon\` text,
            \`color\` text,
            \`sort_order\` integer DEFAULT 0 NOT NULL,
            \`is_hidden\` integer DEFAULT 0 NOT NULL,
            \`is_archived\` integer DEFAULT 0 NOT NULL
          );
        `);

        // 7. Create export history
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`export_history\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`format\` text NOT NULL,
            \`file_path\` text NOT NULL,
            \`timestamp\` integer NOT NULL,
            \`record_count\` integer DEFAULT 0 NOT NULL
          );
        `);

        // 8. Create goals
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`goals\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`name\` text NOT NULL,
            \`type\` text NOT NULL,
            \`target_amount\` real NOT NULL,
            \`current_amount\` real DEFAULT 0 NOT NULL,
            \`deadline\` integer,
            \`icon\` text,
            \`color\` text
          );
        `);

        // 9. Create investments
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`investments\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`name\` text NOT NULL,
            \`type\` text NOT NULL,
            \`amount\` real NOT NULL,
            \`units\` real,
            \`purchase_price\` real,
            \`current_price\` real,
            \`account_id\` text
          );
        `);

        // 10. Create loans
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`loans\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`name\` text NOT NULL,
            \`lender\` text NOT NULL,
            \`principal\` real NOT NULL,
            \`rate\` real NOT NULL,
            \`emi_amount\` real NOT NULL,
            \`start_date\` integer NOT NULL,
            \`end_date\` integer NOT NULL,
            \`account_id\` text
          );
        `);

        // 11. Create notifications
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`notifications\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`type\` text NOT NULL,
            \`title\` text NOT NULL,
            \`body\` text NOT NULL,
            \`scheduled_at\` integer NOT NULL,
            \`is_read\` integer DEFAULT 0 NOT NULL
          );
        `);

        // 12. Create recurring transactions
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`recurring_transactions\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`template_transaction_id\` text NOT NULL,
            \`frequency\` text NOT NULL,
            \`interval\` integer DEFAULT 1 NOT NULL,
            \`start_date\` integer NOT NULL,
            \`end_date\` integer,
            \`next_occurrence\` integer NOT NULL,
            \`is_active\` integer DEFAULT 1 NOT NULL
          );
        `);

        // 13. Create sync logs
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`sync_logs\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`sync_type\` text NOT NULL,
            \`start_time\` integer NOT NULL,
            \`end_time\` integer NOT NULL,
            \`status\` text NOT NULL,
            \`records_uploaded\` integer DEFAULT 0 NOT NULL,
            \`records_downloaded\` integer DEFAULT 0 NOT NULL,
            \`error_message\` text
          );
        `);

        // 14. Create tags
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`tags\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`name\` text NOT NULL,
            \`color\` text
          );
        `);

        // 15. Create transactions
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`transactions\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`amount\` real NOT NULL,
            \`type\` text NOT NULL,
            \`account_id\` text NOT NULL,
            \`category_id\` text NOT NULL,
            \`to_account_id\` text,
            \`date\` integer NOT NULL,
            \`note\` text,
            \`merchant\` text,
            \`payment_method\` text,
            \`tags\` text,
            \`location\` text,
            \`is_recurring\` integer DEFAULT 0 NOT NULL,
            \`recurring_id\` text,
            \`is_favorite\` integer DEFAULT 0 NOT NULL,
            \`custom_fields\` text
          );
        `);

        // 16. Create users
        expoDb.execSync(`
          CREATE TABLE IF NOT EXISTS \`users\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`created_at\` integer NOT NULL,
            \`updated_at\` integer NOT NULL,
            \`deleted_at\` integer,
            \`version\` integer DEFAULT 1 NOT NULL,
            \`is_synced\` integer DEFAULT 0 NOT NULL,
            \`sync_status\` text DEFAULT 'PENDING' NOT NULL,
            \`device_id\` text NOT NULL,
            \`google_account_id\` text,
            \`google_id\` text NOT NULL,
            \`email\` text NOT NULL,
            \`display_name\` text,
            \`photo_url\` text
          );
        `);

        // Indexes for performance (Phase 7)
        expoDb.execSync(`CREATE INDEX IF NOT EXISTS \`idx_transactions_date\` ON \`transactions\` (\`date\`);`);
        expoDb.execSync(`CREATE INDEX IF NOT EXISTS \`idx_transactions_account\` ON \`transactions\` (\`account_id\`);`);
        expoDb.execSync(`CREATE INDEX IF NOT EXISTS \`idx_transactions_category\` ON \`transactions\` (\`category_id\`);`);

        // Insert Starter Seed Data for Sandbox Demo
        const devId = 'initial_device_seed';
        const now = Date.now();

        // Seed default accounts
        expoDb.execSync(`
          INSERT INTO accounts (id, name, type, balance, opening_balance, currency, icon, color, is_active, created_at, updated_at, device_id)
          VALUES 
            ('acc_cash', 'Cash Wallet', 'CASH', 500, 500, 'USD', 'wallet', '#10B981', 1, ${now}, ${now}, '${devId}'),
            ('acc_bank', 'Chase Bank', 'BANK', 3200, 3200, 'USD', 'bank', '#3B82F6', 1, ${now}, ${now}, '${devId}'),
            ('acc_credit', 'Sapphire Card', 'CREDIT_CARD', -150, 0, 'USD', 'credit-card-outline', '#EF4444', 1, ${now}, ${now}, '${devId}');
        `);

        // Seed default categories
        expoDb.execSync(`
          INSERT INTO categories (id, name, type, icon, color, sort_order, is_hidden, is_archived, created_at, updated_at, device_id)
          VALUES 
            ('cat_salary', 'Salary', 'INCOME', 'cash-multiple', '#10B981', 0, 0, 0, ${now}, ${now}, '${devId}'),
            ('cat_groceries', 'Groceries', 'EXPENSE', 'cart-outline', '#F59E0B', 1, 0, 0, ${now}, ${now}, '${devId}'),
            ('cat_eating', 'Eating Out', 'EXPENSE', 'silverware-fork-knife', '#EC4899', 2, 0, 0, ${now}, ${now}, '${devId}'),
            ('cat_rent', 'Rent', 'EXPENSE', 'home-outline', '#8B5CF6', 3, 0, 0, ${now}, ${now}, '${devId}'),
            ('cat_shopping', 'Shopping', 'EXPENSE', 'shopping-outline', '#EF4444', 4, 0, 0, ${now}, ${now}, '${devId}');
        `);

        // Seed default transactions
        expoDb.execSync(`
          INSERT INTO transactions (id, amount, type, account_id, category_id, date, note, merchant, paymentMethod, is_recurring, is_favorite, created_at, updated_at, device_id)
          VALUES 
            ('tx_seed_1', 3500, 'INCOME', 'acc_bank', 'cat_salary', ${now - 5 * 24 * 3600 * 1000}, 'Monthly Paycheck', 'Google LLC', 'TRANSFER', 0, 0, ${now}, ${now}, '${devId}'),
            ('tx_seed_2', 120, 'EXPENSE', 'acc_bank', 'cat_groceries', ${now - 3 * 24 * 3600 * 1000}, 'Weekly food groceries', 'Walmart', 'CARD', 0, 0, ${now}, ${now}, '${devId}'),
            ('tx_seed_3', 30, 'EXPENSE', 'acc_cash', 'cat_eating', ${now - 1 * 24 * 3600 * 1000}, 'Dinner at Diner', 'Joey Diners', 'CASH', 0, 0, ${now}, ${now}, '${devId}'),
            ('tx_seed_4', 150, 'EXPENSE', 'acc_credit', 'cat_shopping', ${now}, 'Winter Jacket', 'Zara Store', 'CARD', 0, 0, ${now}, ${now}, '${devId}');
        `);
      });

      console.log('Database tables successfully created!');
    } else {
      console.log('Database tables already exist. Skipping migrations.');
    }
  } catch (error) {
    console.error('Critical: Database initialization failed:', error);
  }
}

/**
 * Seed LocalStorage lists for Web browser simulation
 */
function ensureWebSeeds() {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const seedId = 'web_device_seed';

  if (!localStorage.getItem('ff_accounts')) {
    const defaultAccounts = [
      { id: 'acc_cash', name: 'Cash Wallet', type: 'CASH', balance: 500, openingBalance: 500, currency: 'USD', icon: 'wallet', color: '#10B981', isActive: true, createdAt: now, updatedAt: now, deviceId: seedId },
      { id: 'acc_bank', name: 'Chase Bank', type: 'BANK', balance: 3200, openingBalance: 3200, currency: 'USD', icon: 'bank', color: '#3B82F6', isActive: true, createdAt: now, updatedAt: now, deviceId: seedId },
      { id: 'acc_credit', name: 'Sapphire Card', type: 'CREDIT_CARD', balance: -150, openingBalance: 0, currency: 'USD', icon: 'credit-card-outline', color: '#EF4444', isActive: true, createdAt: now, updatedAt: now, deviceId: seedId },
    ];
    localStorage.setItem('ff_accounts', JSON.stringify(defaultAccounts));
  }

  if (!localStorage.getItem('ff_categories')) {
    const defaultCategories = [
      { id: 'cat_salary', name: 'Salary', type: 'INCOME', icon: 'cash-multiple', color: '#10B981', sortOrder: 0, isHidden: false, isArchived: false, createdAt: now, updatedAt: now, deviceId: seedId },
      { id: 'cat_groceries', name: 'Groceries', type: 'EXPENSE', icon: 'cart-outline', color: '#F59E0B', sortOrder: 1, isHidden: false, isArchived: false, createdAt: now, updatedAt: now, deviceId: seedId },
      { id: 'cat_eating', name: 'Eating Out', type: 'EXPENSE', icon: 'silverware-fork-knife', color: '#EC4899', sortOrder: 2, isHidden: false, isArchived: false, createdAt: now, updatedAt: now, deviceId: seedId },
      { id: 'cat_rent', name: 'Rent', type: 'EXPENSE', icon: 'home-outline', color: '#8B5CF6', sortOrder: 3, isHidden: false, isArchived: false, createdAt: now, updatedAt: now, deviceId: seedId },
      { id: 'cat_shopping', name: 'Shopping', type: 'EXPENSE', icon: 'shopping-outline', color: '#EF4444', sortOrder: 4, isHidden: false, isArchived: false, createdAt: now, updatedAt: now, deviceId: seedId },
    ];
    localStorage.setItem('ff_categories', JSON.stringify(defaultCategories));
  }

  if (!localStorage.getItem('ff_transactions')) {
    const defaultTransactions = [
      { id: 'tx_seed_1', amount: 3500, type: 'INCOME', accountId: 'acc_bank', categoryId: 'cat_salary', date: now - 5 * 24 * 3600 * 1000, note: 'Monthly Paycheck', merchant: 'Google LLC', paymentMethod: 'TRANSFER', isRecurring: false, isFavorite: false, createdAt: now, updatedAt: now, deviceId: seedId },
      { id: 'tx_seed_2', amount: 120, type: 'EXPENSE', accountId: 'acc_bank', categoryId: 'cat_groceries', date: now - 3 * 24 * 3600 * 1000, note: 'Weekly food groceries', merchant: 'Walmart', paymentMethod: 'CARD', isRecurring: false, isFavorite: false, createdAt: now, updatedAt: now, deviceId: seedId },
      { id: 'tx_seed_3', amount: 30, type: 'EXPENSE', accountId: 'acc_cash', categoryId: 'cat_eating', date: now - 1 * 24 * 3600 * 1000, note: 'Dinner at Diner', merchant: 'Joey Diners', paymentMethod: 'CASH', isRecurring: false, isFavorite: false, createdAt: now, updatedAt: now, deviceId: seedId },
      { id: 'tx_seed_4', amount: 150, type: 'EXPENSE', accountId: 'acc_credit', categoryId: 'cat_shopping', date: now, note: 'Winter Jacket', merchant: 'Zara Store', paymentMethod: 'CARD', isRecurring: false, isFavorite: false, createdAt: now, updatedAt: now, deviceId: seedId },
    ];
    localStorage.setItem('ff_transactions', JSON.stringify(defaultTransactions));
  }

  if (!localStorage.getItem('ff_budgets')) {
    localStorage.setItem('ff_budgets', JSON.stringify([]));
  }
  if (!localStorage.getItem('ff_goals')) {
    localStorage.setItem('ff_goals', JSON.stringify([]));
  }
  if (!localStorage.getItem('ff_bills')) {
    localStorage.setItem('ff_bills', JSON.stringify([]));
  }
}
