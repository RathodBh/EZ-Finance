import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Helper to define columns common to all syncable tables
const syncColumns = {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'), // epoch ms for soft delete
  version: integer('version').default(1).notNull(),
  isSynced: integer('is_synced', { mode: 'boolean' }).default(false).notNull(),
  syncStatus: text('sync_status').default('PENDING').notNull(), // PENDING, SYNCED, FAILED
  deviceId: text('device_id').notNull(),
  googleAccountId: text('google_account_id'),
};

// Users Table
export const users = sqliteTable('users', {
  ...syncColumns,
  googleId: text('google_id').notNull(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  currency: text('currency').default('USD'),
  notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' }).default(false),
});

// Accounts Table
export const accounts = sqliteTable('accounts', {
  ...syncColumns,
  name: text('name').notNull(),
  type: text('type').notNull(), // CASH, BANK, UPI, CREDIT_CARD, WALLET, LOAN, INVESTMENT, GOLD, CUSTOM
  balance: real('balance').default(0).notNull(),
  openingBalance: real('opening_balance').default(0).notNull(),
  currency: text('currency').default('USD').notNull(),
  icon: text('icon'),
  color: text('color'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),
});

// Categories Table
export const categories = sqliteTable('categories', {
  ...syncColumns,
  name: text('name').notNull(),
  parentId: text('parent_id'), // self reference for subcategories
  type: text('type').notNull(), // INCOME, EXPENSE, TRANSFER
  icon: text('icon'),
  color: text('color'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isHidden: integer('is_hidden', { mode: 'boolean' }).default(false).notNull(),
  isArchived: integer('is_archived', { mode: 'boolean' }).default(false).notNull(),
});

// Transactions Table
export const transactions = sqliteTable('transactions', {
  ...syncColumns,
  amount: real('amount').notNull(),
  type: text('type').notNull(), // INCOME, EXPENSE, TRANSFER
  accountId: text('account_id').notNull(), // reference to accounts
  categoryId: text('category_id').notNull(), // reference to categories
  toAccountId: text('to_account_id'), // reference to accounts (used for transfers)
  date: integer('date').notNull(), // epoch ms
  note: text('note'),
  merchant: text('merchant'),
  paymentMethod: text('payment_method'), // CASH, CARD, UPI, NET_BANKING, etc.
  tags: text('tags'), // JSON stringified array of tag strings
  location: text('location'), // JSON stringified object {latitude: number, longitude: number, name: string}
  isRecurring: integer('is_recurring', { mode: 'boolean' }).default(false).notNull(),
  recurringId: text('recurring_id'), // reference to recurring_transactions
  isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false).notNull(),
  customFields: text('custom_fields'), // JSON stringified object
});

// Budgets Table
export const budgets = sqliteTable('budgets', {
  ...syncColumns,
  categoryId: text('category_id').notNull(),
  amount: real('amount').notNull(),
  period: text('period').notNull(), // DAILY, WEEKLY, MONTHLY, YEARLY
  startDate: integer('start_date').notNull(), // epoch ms
  endDate: integer('end_date').notNull(), // epoch ms
  carryForward: integer('carry_forward', { mode: 'boolean' }).default(false).notNull(),
  alertThreshold: real('alert_threshold').default(0.8).notNull(), // trigger warning at 80% spending
});

// Goals Table
export const goals = sqliteTable('goals', {
  ...syncColumns,
  name: text('name').notNull(),
  type: text('type').notNull(), // SAVINGS, INVESTMENT, DEBT, EMERGENCY, VACATION, CUSTOM
  targetAmount: real('target_amount').notNull(),
  currentAmount: real('current_amount').default(0).notNull(),
  deadline: integer('deadline'), // epoch ms
  icon: text('icon'),
  color: text('color'),
});

// Bills Table
export const bills = sqliteTable('bills', {
  ...syncColumns,
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  dueDate: integer('due_date').notNull(), // epoch ms
  category: text('category'),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).default(false).notNull(),
  frequency: text('frequency'), // DAILY, WEEKLY, MONTHLY, etc.
  isPaid: integer('is_paid', { mode: 'boolean' }).default(false).notNull(),
  reminderEnabled: integer('reminder_enabled', { mode: 'boolean' }).default(true).notNull(),
});

// Recurring Transactions Templates Table
export const recurringTransactions = sqliteTable('recurring_transactions', {
  ...syncColumns,
  templateTransactionId: text('template_transaction_id').notNull(),
  frequency: text('frequency').notNull(), // DAILY, WEEKLY, MONTHLY, YEARLY
  interval: integer('interval').default(1).notNull(),
  startDate: integer('start_date').notNull(),
  endDate: integer('end_date'),
  nextOccurrence: integer('next_occurrence').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
});

// Tags Table
export const tags = sqliteTable('tags', {
  ...syncColumns,
  name: text('name').notNull(),
  color: text('color'),
});

// Attachments Table
export const attachments = sqliteTable('attachments', {
  ...syncColumns,
  transactionId: text('transaction_id').notNull(),
  fileUri: text('file_uri').notNull(),
  fileType: text('file_type').notNull(), // IMAGE, PDF, VOICE
  localPath: text('local_path'),
  drivePath: text('drive_path'),
  sizeBytes: integer('size_bytes'),
});

// Loans Table
export const loans = sqliteTable('loans', {
  ...syncColumns,
  name: text('name').notNull(),
  lender: text('lender').notNull(),
  principal: real('principal').notNull(),
  rate: real('rate').notNull(), // annual rate percentage
  emiAmount: real('emi_amount').notNull(),
  startDate: integer('start_date').notNull(),
  endDate: integer('end_date').notNull(),
  accountId: text('account_id'), // linked payment account
});

// Investments Table
export const investments = sqliteTable('investments', {
  ...syncColumns,
  name: text('name').notNull(),
  type: text('type').notNull(), // STOCK, MUTUAL_FUND, REAL_ESTATE, GOLD, CRYPTO, OTHER
  amount: real('amount').notNull(),
  units: real('units'),
  purchasePrice: real('purchase_price'),
  currentPrice: real('current_price'),
  accountId: text('account_id'), // linked funding account
});

// Sync Logs Table
export const syncLogs = sqliteTable('sync_logs', {
  ...syncColumns,
  syncType: text('sync_type').notNull(), // MANUAL, BACKGROUND, INITIAL
  startTime: integer('start_time').notNull(),
  endTime: integer('end_time').notNull(),
  status: text('status').notNull(), // SUCCESS, FAILED
  recordsUploaded: integer('records_uploaded').default(0).notNull(),
  recordsDownloaded: integer('records_downloaded').default(0).notNull(),
  errorMessage: text('error_message'),
});

// Audit Logs Table
export const auditLogs = sqliteTable('audit_logs', {
  ...syncColumns,
  entityType: text('entity_type').notNull(), // TRANSACTION, ACCOUNT, etc.
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // CREATE, UPDATE, DELETE
  oldValue: text('old_value'), // JSON stringified representation
  newValue: text('new_value'), // JSON stringified representation
  timestamp: integer('timestamp').notNull(),
});

// Export History Table
export const exportHistory = sqliteTable('export_history', {
  ...syncColumns,
  format: text('format').notNull(), // PDF, CSV, EXCEL, JSON_BACKUP, ENCRYPTED_BACKUP
  filePath: text('file_path').notNull(),
  timestamp: integer('timestamp').notNull(),
  recordCount: integer('record_count').default(0).notNull(),
});

// Notifications Table
export const notifications = sqliteTable('notifications', {
  ...syncColumns,
  type: text('type').notNull(), // BUDGET_ALERT, BILL_REMINDER, GOAL_MILESTONE, RECURRING_TX, BACKUP_REMINDER, GENERAL
  title: text('title').notNull(),
  body: text('body').notNull(),
  scheduledAt: integer('scheduled_at').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).default(false).notNull(),
});

// STDE Temporary Transactions Table
export const tempTransactions = sqliteTable('temp_transactions', {
  id: text('id').primaryKey(),
  smsId: text('sms_id'),
  smsHash: text('sms_hash').unique().notNull(), // prevent duplicates
  smsBody: text('sms_body').notNull(),
  bankName: text('bank_name'),
  accountLast4: text('account_last4'),
  merchant: text('merchant'),
  merchantRaw: text('merchant_raw'),
  upiId: text('upi_id'),
  amount: real('amount').notNull(),
  transactionType: text('transaction_type').notNull(), // DEBIT | CREDIT
  paymentMode: text('payment_mode'), // UPI | IMPS | NEFT | RTGS | ATM | CARD | NET_BANKING
  transactionDate: integer('transaction_date').notNull(), // epoch ms
  status: text('status').default('PENDING').notNull(), // PENDING | APPROVED | SKIPPED | AUTO_SAVED
  confidence: real('confidence').default(0).notNull(),
  matchedAccountId: text('matched_account_id'),
  matchedCategoryId: text('matched_category_id'),
  matchedRuleId: text('matched_rule_id'),
  isTransfer: integer('is_transfer', { mode: 'boolean' }).default(false),
  toAccountId: text('to_account_id'),
  processed: integer('processed', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// STDE Learning Rules Table
export const smsRules = sqliteTable('sms_rules', {
  id: text('id').primaryKey(),
  ruleType: text('rule_type').notNull(), // MERCHANT | UPI | ACCOUNT | PATTERN
  merchantPattern: text('merchant_pattern'),
  upiId: text('upi_id'),
  bankName: text('bank_name'),
  accountLast4: text('account_last4'),
  regexPattern: text('regex_pattern'),
  categoryId: text('category_id'),
  preferredAccountId: text('preferred_account_id'),
  isTransfer: integer('is_transfer', { mode: 'boolean' }).default(false),
  targetAccountId: text('target_account_id'),
  acceptedCount: integer('accepted_count').default(0).notNull(),
  editedCount: integer('edited_count').default(0).notNull(),
  rejectedCount: integer('rejected_count').default(0).notNull(),
  skippedCount: integer('skipped_count').default(0).notNull(),
  autoSavedCount: integer('auto_saved_count').default(0).notNull(),
  confidence: real('confidence').default(0).notNull(),
  lastUsed: integer('last_used'),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// STDE Settings Table
export const smsSettings = sqliteTable('sms_settings', {
  id: text('id').primaryKey(),
  autoSaveThreshold: real('auto_save_threshold').default(98).notNull(),
  autoSuggestThreshold: real('auto_suggest_threshold').default(80).notNull(),
  reviewThreshold: real('review_threshold').default(60).notNull(),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true).notNull(),
  lastProcessedSmsId: text('last_processed_sms_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

