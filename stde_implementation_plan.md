# Smart SMS Transaction Detection Engine (STDE)
## EZ-Finance — Implementation Plan

This document tracks the phased implementation of the offline, rule-based **Smart SMS Transaction Detection Engine (STDE)** for EZ-Finance.

---

## 🛠️ Phase Checklist

### Phase 1 — Database & Repositories
- [x] Extend Drizzle Schema in `db/schema.ts` with `temp_transactions`, `sms_rules`, and `sms_settings`.
- [x] Add DDL initialization to `db/client.ts`.
- [x] Add `SmsRepository` implementation to `db/repositories.ts`.

### Phase 2 — Core STDE Parsing & Learning
- [x] Create parser interfaces and `BankSmsParser.ts` for Indian banks (SBI, HDFC, ICICI, Axis, Kotak, PNB, Canara, IDFC, Baroda, AU, Yes, Federal).
- [x] Create `RuleEngine.ts` mapping (Account, Merchant, UPI, regex rules).
- [x] Create `MerchantMatcher.ts` with fuzzy normalization.
- [x] Create `AccountMatcher.ts` for automated routing.
- [x] Create orchestration logic in `SmsService.ts` to coordinate read -> parse -> match -> save.

### Phase 3 — Store & Permissions
- [x] Add SMS permission actions & Zustand state to `store/appStore.ts`.
- [x] Add processing actions, approval, bulk rules, and transaction promotion hooks.

### Phase 4 — User Interface
- [x] Create the Review Screen: `screens/SmsTransactionsScreen.tsx` & router entry `app/sms-transactions.tsx`.
- [x] Create the Rules Config Screen: `screens/SmsRulesScreen.tsx` & router entry `app/sms-rules.tsx`.
- [x] Create Settings & Thresholds: `screens/SmsSettingsScreen.tsx` & router entry `app/sms-settings.tsx`.
- [x] Add Entry Point to `screens/MoreScreen.tsx`.

---

## 📊 Table Definitions

### `temp_transactions`
* Holds pending transactions matching debits/credits parsed from SMS.
* Duplicates are prevented by a SHA-256 fingerprint generated from `amount + merchant + timestamp + accountLast4`.

### `sms_rules`
* Keeps matching rules with dynamically calculated confidence values.
* Confidence is calculated as: `(acceptedCount * 100) / (acceptedCount + editedCount * 2 + rejectedCount * 3)`.

### `sms_settings`
* User thresholds: Auto-Save (default 98%), Auto-Suggest (default 80%), Review (default 60%).

---

## 🏗️ Pluggable Architecture Interfaces

Initially implemented using offline rule-based regex and matching, these interfaces will allow easily substituting ML/LLM engines in the future:
1. `ISmsParser`
2. `IRuleEngine`
3. `IMerchantMatcher`
4. `IAccountMatcher`
