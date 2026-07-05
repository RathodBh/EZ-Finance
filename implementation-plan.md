# FinanceFlow — React Native Finance Management App
## Implementation Plan (React Native Edition)

> A premium, offline-first personal finance management application built with **React Native (Expo)**, inspired by MyMoney.

---

## Overview

We are switching the technical stack from Native Kotlin to **React Native (Expo)**. This enables rapid multiplatform development (supporting Android and potentially iOS later) while keeping the same offline-first and background Google Drive sync capabilities.

We will use:
- **Core Framework**: React Native with **Expo SDK** and TypeScript.
- **Routing/Navigation**: **Expo Router** (file-based routing, modern default).
- **Database**: **Expo SQLite** with **Drizzle ORM** (providing a Room-like type-safe query layer).
- **State Management**: **Zustand** + Repository pattern.
- **Background Tasks**: **Expo BackgroundFetch** & **Expo TaskManager**.
- **UI Design System**: **React Native Paper** (Material Design 3) + custom `StyleSheet` styling for high-end aesthetics (glassmorphism cards, premium dark mode).
- **Authentication**: `@react-native-google-signin/google-signin` (native Google Auth).
- **Sync Storage**: Google Drive AppData Folder.
- **Charts**: `react-native-gifted-charts` (highly interactive, animated premium charts).

---

## User Review Required

> [!IMPORTANT]
> **Clean Directory Requirement**: Before initializing the Expo project, we will delete the existing Android Native Kotlin files (`app`, `build.gradle.kts`, etc.) in the workspace root to avoid file structure conflicts. Confirm if this is acceptable.

> [!IMPORTANT]
> **Expo Development Builds**: To use native Google Sign-in and custom SQLite database tools, the app must run using **Expo Development Builds** (`npx expo run:android`) rather than Expo Go. This requires an Android emulator or device connected.

---

## Open Questions

> [!IMPORTANT]
> 1. **Drizzle ORM Preference**: Do you approve of using Drizzle ORM for type-safe SQLite database schema definitions and migrations, or would you prefer raw SQLite queries?
> 2. **Authentication Flow**: Should Google Login be mandatory on first start to enable immediate backup, or should the app allow a "Skip / Local-Only" mode that can link to Google later?
> 3. **UI Theme**: Should we implement a custom, pre-curated color palette (e.g., Emerald Green and Slate Gray for luxury financial feel) rather than system-wide Monet dynamic colors?

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      UI Layer                           │
│  React Native App / Expo Router (screens/tabs)         │
│  React Native Paper (M3 Components) + Custom Styles     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│               State / ViewModel Layer                  │
│  Zustand Stores (global state, action handlers)         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Services / Repos                       │
│  Repositories (Transactions, Budgets, etc.)            │
│  Drizzle Schema & DB Client (Expo SQLite)               │
│  Google Drive Sync Client & Auth Client                 │
└─────────────────────────────────────────────────────────┘
```

---

## Proposed Changes

---

### Phase 1 — Cleanup & Project Foundation

#### Cleanup
- Delete Kotlin files: `app/`, `build.gradle.kts`, `settings.gradle.kts`, `local.properties`, `gradle.properties`, `gradlew`, `gradlew.bat`.

#### Project Setup
- Initialize Expo project with TypeScript template:
  ```bash
  npx create-expo-app@latest ./ --template blank-typescript -y
  ```
- Install dependencies:
  - Navigation: `expo-router`, `react-native-safe-area-context`, `react-native-screens`
  - Database: `expo-sqlite`, `drizzle-orm`
  - DI / State: `zustand`
  - Design: `react-native-paper`, `react-native-vector-icons`
  - Auth/Sync: `@react-native-google-signin/google-signin`, `expo-secure-store`
  - Background Task: `expo-background-fetch`, `expo-task-manager`
  - Charts: `react-native-gifted-charts`, `react-native-svg`
  - Export: `xlsx`, `papaparse`, `expo-file-system`, `expo-sharing`
  - Development tools: `drizzle-kit`, `typescript`, `@types/react`

---

### Phase 2 — Database Schema & Drizzle ORM

We define the 17 tables in Drizzle Schema with identical sync fields:
- `id` (text, primary key)
- `createdAt` (integer/timestamp)
- `updatedAt` (integer/timestamp)
- `deletedAt` (integer/timestamp, nullable)
- `version` (integer, default 1)
- `isSynced` (integer/boolean, default false)
- `syncStatus` (text: 'PENDING', 'SYNCED', 'FAILED')
- `deviceId` (text)
- `googleAccountId` (text)

#### Schema Files:
- `/db/schema.ts` — Tables definitions for Users, Accounts, Categories, Transactions, Budgets, Goals, Bills, Tags, Attachments, RecurringTransactions, SyncLogs, AuditLogs.
- `/db/client.ts` — Expo SQLite database connection setup and Drizzle client.

---

### Phase 3 — Google Authentication & Drive Sync

#### Google Sign-in:
- Configure `@react-native-google-signin/google-signin` with client IDs.
- Wrap auth flow in a session provider.`
- Store sensitive tokens in `expo-secure-store`.

#### Sync Engine:
- Background tasks registered via `expo-task-manager` and `expo-background-fetch`.
- Sync algorithm:
  1. Retrieve unsynced records locally.
  2. Upload payload to Google Drive under `appDataFolder` in JSON format.
  3. Query Drive for updates since the last sync timestamp.
  4. Perform conflict resolution ("Latest Version Wins" by comparing `version` and `updatedAt`).
  5. Apply updates to the SQLite db.
  6. Log status into `sync_logs`.

---

### Phase 4 — Design System & Custom UI

- Set up Material Design 3 theme custom provider (Light / Dark palettes).
- Custom screens:
  - **Tabs**: `(tabs)/dashboard`, `(tabs)/transactions`, `(tabs)/reports`, `(tabs)/budgets`, `(tabs)/more`
  - **Modals/Sub-screens**: `transaction/add`, `account/manage`, `category/picker`, `security/lock`
- Aesthetic elements:
  - Custom glassmorphism-like cards using semi-transparent absolute background views + blur.
  - Smooth scale and translate transitions on actions.

---

### Phase 5 — Feature Modules (TS/JS versions)

- **Transactions Module**: CRUD operations, splits, template recurring transactions.
- **Categories Module**: Hierarchical parent-child relationship.
- **Accounts Module**: Balance calculations based on transaction records.
- **Budgets & Goals**: Set category budget, alert user on overspend, track milestones.
- **Bills**: Display calendar view and upcoming schedules.
- **Reports**: Data formatting + `react-native-gifted-charts` widgets (Pie, Line, Bar).

---

### Phase 6 — Security, Import/Export & Notifications

- **Biometrics**: `expo-local-authentication` integration for Fingerprint / Face Unlock.
- **App Lock Screen**: Absolute overlay shown whenever the app becomes inactive or moves to background.
- **Export/Import**: Generate CSV, Excel, and JSON files and present them via `expo-sharing`.
- **Notifications**: `expo-notifications` for reminders and budget alerts.

---

### Phase 7 — Performance & Testing

- Use SQLite indexing on fields: `date`, `accountId`, `categoryId`.
- Virtual FTS (Full Text Search) table mapping for Transactions search.
- Virtual scrolling lists (`FlatList` / `FlashList`) to handle 500,000+ transaction rendering.
- **Testing**:
  - Jest for testing Zustand stores and Drizzle repository layer.
  - Detox for UI automation tests.

---

## Verification Plan

### Automated Tests
```bash
npm run test           # Jest tests for stores and utilities
```

### Manual Verification
1. Run `npx expo run:android` to compile and launch.
2. Verify local database creation.
3. Test Google Sign-in login/logout.
4. Perform manual sync, turn off internet, add transactions, verify sync queue.
5. Export CSV and open in Google Sheets to confirm columns.
6. Verify biometric lock pop-up on app resume.
