CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`opening_balance` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`icon` text,
	`color` text,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`transaction_id` text NOT NULL,
	`file_uri` text NOT NULL,
	`file_type` text NOT NULL,
	`local_path` text,
	`drive_path` text,
	`size_bytes` integer
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`due_date` integer NOT NULL,
	`category` text,
	`is_recurring` integer DEFAULT false NOT NULL,
	`frequency` text,
	`is_paid` integer DEFAULT false NOT NULL,
	`reminder_enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`category_id` text NOT NULL,
	`amount` real NOT NULL,
	`period` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`carry_forward` integer DEFAULT false NOT NULL,
	`alert_threshold` real DEFAULT 0.8 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`name` text NOT NULL,
	`parent_id` text,
	`type` text NOT NULL,
	`icon` text,
	`color` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `export_history` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`format` text NOT NULL,
	`file_path` text NOT NULL,
	`timestamp` integer NOT NULL,
	`record_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`target_amount` real NOT NULL,
	`current_amount` real DEFAULT 0 NOT NULL,
	`deadline` integer,
	`icon` text,
	`color` text
);
--> statement-breakpoint
CREATE TABLE `investments` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`units` real,
	`purchase_price` real,
	`current_price` real,
	`account_id` text
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`name` text NOT NULL,
	`lender` text NOT NULL,
	`principal` real NOT NULL,
	`rate` real NOT NULL,
	`emi_amount` real NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`account_id` text
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`is_read` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recurring_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`template_transaction_id` text NOT NULL,
	`frequency` text NOT NULL,
	`interval` integer DEFAULT 1 NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`next_occurrence` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`sync_type` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`status` text NOT NULL,
	`records_uploaded` integer DEFAULT 0 NOT NULL,
	`records_downloaded` integer DEFAULT 0 NOT NULL,
	`error_message` text
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`name` text NOT NULL,
	`color` text
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`amount` real NOT NULL,
	`type` text NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text NOT NULL,
	`to_account_id` text,
	`date` integer NOT NULL,
	`note` text,
	`merchant` text,
	`payment_method` text,
	`tags` text,
	`location` text,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurring_id` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`custom_fields` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`sync_status` text DEFAULT 'PENDING' NOT NULL,
	`device_id` text NOT NULL,
	`google_account_id` text,
	`google_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`photo_url` text
);
