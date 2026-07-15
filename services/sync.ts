import { db } from '../db/client';
import * as schema from '../db/schema';
import { getDeviceId, getActiveGoogleAccountId } from '../db/repositories';
import { eq } from 'drizzle-orm';
import { Platform } from 'react-native';

let GoogleSignin: any = null;
let FileSystem: any = null;

if (Platform.OS !== 'web') {
  try {
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
    FileSystem = require('expo-file-system');
  } catch (e) {
    console.warn('Native sync modules failed to load:', e);
  }
}

const getSecureItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  } else {
    try {
      const SecureStore = require('expo-secure-store');
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  }
};

const setSecureItem = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } else {
    try {
      const SecureStore = require('expo-secure-store');
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Ignore
    }
  }
};

// Supported sync tables list
const SYNCABLE_TABLES = [
  { name: 'accounts', table: schema.accounts },
  { name: 'categories', table: schema.categories },
  { name: 'transactions', table: schema.transactions },
  { name: 'budgets', table: schema.budgets },
  { name: 'goals', table: schema.goals },
  { name: 'bills', table: schema.bills },
  { name: 'recurring_transactions', table: schema.recurringTransactions },
  { name: 'tags', table: schema.tags },
  { name: 'attachments', table: schema.attachments },
  { name: 'loans', table: schema.loans },
  { name: 'investments', table: schema.investments },
] as const;

export const SyncService = {
  /**
   * Main sync executor. Coordinates dirty records push and remote records fetch.
   */
  async runSync(syncType: 'MANUAL' | 'BACKGROUND' = 'MANUAL'): Promise<{ success: boolean; uploaded: number; downloaded: number; error?: string }> {
    const startTime = Date.now();
    const deviceId = await getDeviceId();
    const googleAccountId = await getActiveGoogleAccountId();

    console.log(`[Sync] Starting runSync... deviceId: "${deviceId}", googleAccountId: "${googleAccountId}", syncType: "${syncType}"`);

    if (!googleAccountId) {
      console.warn('[Sync] No active Google account session found.');
      return { success: false, uploaded: 0, downloaded: 0, error: 'No active Google account session' };
    }

    let recordsUploaded = 0;
    let recordsDownloaded = 0;
    let success = false;
    let errorMessage: string | undefined;

    try {
      let accessToken: string | null = null;
      let mockMode = false;

      if (googleAccountId === 'mock_user_123') {
        mockMode = true;
        accessToken = 'mock_token';
      } else {
        accessToken = await this.getFreshAccessToken(false);
      }

      if (!accessToken) {
        console.error('[Sync] Google access token retrieval failed.');
        throw new Error('Google access token is not available. Please sign in again.');
      }

      console.log(`[Sync] Google access token retrieved successfully. Starting sync process (mockMode: ${mockMode})`);

      // Loop through all tables, sync one-by-one
      for (const { name, table } of SYNCABLE_TABLES) {
        console.log(`\n--- [Sync] Syncing table: ${name} ---`);
        // 1. Get dirty local records (unsynced modifications) and all records
        let dirtyRecords: any[] = [];
        let allLocalRecords: any[] = [];

        if (Platform.OS === 'web') {
          const stored = localStorage.getItem(`ff_${name}`);
          allLocalRecords = stored ? JSON.parse(stored) : [];
          dirtyRecords = allLocalRecords.filter((r: any) => !r.isSynced);
        } else {
          dirtyRecords = await db
            .select()
            .from(table)
            .where(eq((table as any).isSynced, false));

          allLocalRecords = await db
            .select()
            .from(table);
        }

        console.log(`[Sync] Table "${name}" - Local records: ${allLocalRecords.length}, Dirty (unsynced) records: ${dirtyRecords.length}`);

        // 3. Upload device's full state to Google Drive AppData.
        // We ALWAYS upload when local data exists to keep the cloud as a complete, up-to-date snapshot.
        const fileName = `${name}_${deviceId}.json`;
        const payloadStr = JSON.stringify(allLocalRecords);

        if (allLocalRecords.length > 0) {
          console.log(`[Sync] Uploading ${allLocalRecords.length} local records for "${name}" to file "${fileName}"...`);
          if (mockMode) {
            await this.mockUpload(fileName, payloadStr);
          } else {
            await this.driveUpload(fileName, payloadStr);
          }
          console.log(`[Sync] Successfully uploaded "${name}"`);
          recordsUploaded += dirtyRecords.length > 0 ? dirtyRecords.length : allLocalRecords.length;
        } else {
          console.log(`[Sync] Skipping upload for "${name}" - no local records to push`);
        }

        // 4. Download other devices' state files
        let allRemoteFiles: { id: string; name: string; modifiedTime?: string }[] = [];
        if (mockMode) {
          const files = await this.mockListFiles(name);
          allRemoteFiles = files.map(f => ({ id: f, name: f }));
        } else {
          allRemoteFiles = await this.driveListFiles(name);
        }

        console.log(`[Sync] Remote files found in cloud for "${name}":`, JSON.stringify(allRemoteFiles, null, 2));

        const remoteRecords: any[] = [];
        for (const file of allRemoteFiles) {
          // Skip downloading our own device file only if we already have local data to prevent overwriting.
          // If local data is completely empty (e.g. cleared localStorage), we MUST download it to restore.
          if (file.name.includes(deviceId) && allLocalRecords.length > 0) {
            console.log(`[Sync] Skipping download of own device file "${file.name}" as local data exists.`);
            continue;
          }

          // Check if file has been modified since last sync
          if (file.modifiedTime) {
            const lastSyncedTime = await getSecureItem(`last_sync_${file.name}`);
            if (lastSyncedTime === file.modifiedTime) {
              console.log(`[Sync] Skipping download for remote file "${file.name}" - already up to date (modifiedTime matches last_sync)`);
              continue;
            }
          }

          console.log(`[Sync] Downloading file "${file.name}" (id: ${file.id})...`);
          let fileContentStr = '';
          if (mockMode) {
            fileContentStr = await this.mockDownload(file.id);
          } else {
            fileContentStr = await this.driveDownload(file.id);
          }

          if (fileContentStr) {
            try {
              const records = JSON.parse(fileContentStr);
              if (Array.isArray(records)) {
                console.log(`[Sync] Successfully fetched/downloaded ${records.length} records for "${name}" from file "${file.name}":`, records);
                remoteRecords.push(...records);
                // Save modifiedTime to avoid re-downloading next time
                if (file.modifiedTime) {
                  await setSecureItem(`last_sync_${file.name}`, file.modifiedTime);
                }
              }
            } catch (parseErr) {
              console.warn(`[Sync] Failed to parse remote file: ${file.name}`, parseErr);
            }
          }
        }

        // 5. Merge remote records using Latest-Version-Wins
        let tableDownloadedCount = 0;
        if (remoteRecords.length > 0) {
          console.log(`[Sync] Merging ${remoteRecords.length} remote records into table "${name}"...`);
          tableDownloadedCount = await this.mergeRecords(name, table, remoteRecords);
          console.log(`[Sync] Merge completed. Merged/updated ${tableDownloadedCount} records for "${name}".`);
          recordsDownloaded += tableDownloadedCount;
        } else {
          console.log(`[Sync] No remote records found to merge for table "${name}".`);
        }

        // 6. Mark all local records as synced since we pushed our full state
        if (allLocalRecords.length > 0) {
          console.log(`[Sync] Marking local records for "${name}" as synced.`);
          if (Platform.OS === 'web') {
            const updatedLocal = allLocalRecords.map((r: any) => ({
              ...r,
              isSynced: true,
              syncStatus: 'SYNCED',
            }));
            localStorage.setItem(`ff_${name}`, JSON.stringify(updatedLocal));
          } else {
            await db
              .update(table)
              .set({
                isSynced: true,
                syncStatus: 'SYNCED',
              } as any);
          }
        }
      }

      success = true;
      console.log(`[Sync] Sync process completed successfully! Uploaded: ${recordsUploaded}, Downloaded: ${recordsDownloaded}`);
    } catch (error: any) {
      success = false;
      errorMessage = error.message || String(error);
      console.error('[Sync] Sync process failed:', error);
    } finally {
      // 7. Log sync activity to local db
      try {
        const now = Date.now();
        if (Platform.OS === 'web') {
          const stored = localStorage.getItem('ff_sync_logs');
          const logs = stored ? JSON.parse(stored) : [];
          logs.push({
            id: 'log_' + Math.random().toString(36).substring(2, 11) + now.toString(36),
            createdAt: now,
            updatedAt: now,
            version: 1,
            isSynced: true,
            syncStatus: 'SYNCED',
            deviceId,
            googleAccountId,
            syncType,
            startTime,
            endTime: now,
            status: success ? 'SUCCESS' : 'FAILED',
            recordsUploaded,
            recordsDownloaded,
            errorMessage: errorMessage || null,
          });
          localStorage.setItem('ff_sync_logs', JSON.stringify(logs));
        } else {
          await db.insert(schema.syncLogs).values({
            id: 'log_' + Math.random().toString(36).substring(2, 11) + now.toString(36),
            createdAt: now,
            updatedAt: now,
            version: 1,
            isSynced: false,
            syncStatus: 'PENDING',
            deviceId,
            googleAccountId,
            syncType,
            startTime,
            endTime: now,
            status: success ? 'SUCCESS' : 'FAILED',
            recordsUploaded,
            recordsDownloaded,
            errorMessage: errorMessage || null,
          });
        }
      } catch (logErr) {
        console.error('Failed to save sync log:', logErr);
      }
    }

    return { success, uploaded: recordsUploaded, downloaded: recordsDownloaded, error: errorMessage };
  },

  /**
   * Checks whether any table has local data stored.
   * Used to determine if the user needs a restore (empty) or an upload (has data).
   */
  async hasLocalData(): Promise<boolean> {
    console.log('[hasLocalData] Checking local storage for existing data...');
    if (Platform.OS === 'web') {
      for (const { name } of SYNCABLE_TABLES) {
        const stored = localStorage.getItem(`ff_${name}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log(`[hasLocalData] Found ${parsed.length} records in localStorage key "ff_${name}". Local data EXISTS.`);
              return true;
            } else {
              console.log(`[hasLocalData] Key "ff_${name}" is present but empty (length: ${Array.isArray(parsed) ? parsed.length : 'not array'}).`);
            }
          } catch (e) {
            console.warn(`[hasLocalData] Failed to parse localStorage key "ff_${name}":`, e);
          }
        } else {
          console.log(`[hasLocalData] Key "ff_${name}" is not set in localStorage.`);
        }
      }
      console.log('[hasLocalData] No local data found across all tables. Local DB is EMPTY.');
      return false;
    }
    // Native: check the accounts table as a proxy
    const rows = await db.select().from(schema.accounts);
    console.log(`[hasLocalData] Native accounts table has ${rows.length} rows.`);
    return rows.length > 0;
  },

  /**
   * Restore all data from Google Drive into the local database.
   * Used after a fresh login when the local DB is completely empty.
   * @param explicitGoogleAccountId - Pass the account ID directly (e.g. right after OAuth redirect
   *   before it has been persisted to localStorage/SecureStore).
   * @param explicitAccessToken - Pass the access token directly to bypass localStorage lookup.
   *   Used right after OAuth redirect to avoid timing issues.
   */
  async restoreFromCloud(explicitGoogleAccountId?: string, explicitAccessToken?: string): Promise<{ success: boolean; downloaded: number; error?: string }> {
    const googleAccountId = explicitGoogleAccountId || await getActiveGoogleAccountId();

    console.log(`\n☁️ [Restore] ===== STARTING RESTORE FROM CLOUD =====`);
    console.log(`☁️ [Restore] explicitGoogleAccountId arg: "${explicitGoogleAccountId || '(not provided — will read from storage)'}"`);
    console.log(`☁️ [Restore] explicitAccessToken arg: ${explicitAccessToken ? `PROVIDED (length: ${explicitAccessToken.length})` : 'NOT PROVIDED — will call getFreshAccessToken()'}`);
    console.log(`☁️ [Restore] Resolved googleAccountId: "${googleAccountId}"`);
    console.log(`☁️ [Restore] Platform: ${Platform.OS}`);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const lsAccountId = localStorage.getItem('googleAccountId');
      const lsToken = localStorage.getItem('googleAccessToken');
      console.log(`☁️ [Restore] localStorage.googleAccountId: "${lsAccountId || 'NOT SET'}"`);
      console.log(`☁️ [Restore] localStorage.googleAccessToken: ${lsToken ? `present (length: ${lsToken.length})` : 'NOT SET'}`);
    }

    if (!googleAccountId) {
      console.error('❌ [Restore] ABORT: No Google Account ID available. Cannot restore without authentication.');
      return { success: false, downloaded: 0, error: 'No active Google account. Please sign in first.' };
    }

    if (googleAccountId === 'offline_user' || googleAccountId === 'mock_user_123') {
      console.warn(`⚠️ [Restore] ABORT: Skipping restore — account is offline/mock: "${googleAccountId}"`);
      return { success: false, downloaded: 0, error: 'Cannot restore from cloud for offline/mock accounts.' };
    }

    let totalDownloaded = 0;

    try {
      let accessToken: string | null = explicitAccessToken || null;
      if (!accessToken) {
        console.log('🔑 [Restore] No explicit token provided — calling getFreshAccessToken()...');
        accessToken = await this.getFreshAccessToken();
        console.log(`🔑 [Restore] getFreshAccessToken() returned: ${accessToken ? `token (length: ${accessToken.length})` : 'NULL — token not available'}`);
      } else {
        console.log(`🔑 [Restore] Using explicitly provided access token (length: ${accessToken.length}). Skipping getFreshAccessToken().`);
      }

      if (!accessToken) {
        console.error('❌ [Restore] ABORT: Access token is null after token resolution. Cannot call Drive API.');
        throw new Error('Google access token not available. Please sign in again.');
      }

      console.log(`☁️ [Restore] Access token confirmed. Starting per-table restore loop over ${SYNCABLE_TABLES.length} tables...`);

      for (const { name, table } of SYNCABLE_TABLES) {
        console.log(`\n📁 [Restore] --- Table: "${name}" ---`);

        let allRemoteFiles: { id: string; name: string; modifiedTime: string }[] = [];
        try {
          console.log(`📁 [Restore] Calling driveListFiles("${name}")...`);
          allRemoteFiles = await this.driveListFiles(name, accessToken);
          console.log(`📁 [Restore] driveListFiles("${name}") returned ${allRemoteFiles.length} file(s).`);
          if (allRemoteFiles.length > 0) {
            allRemoteFiles.forEach(f => console.log(`  📄 "${f.name}" (id: ${f.id}, modifiedTime: ${f.modifiedTime})`));
          } else {
            console.log(`📁 [Restore] No files found in Drive for table "${name}". Skipping.`);
          }
        } catch (listErr: any) {
          console.error(`❌ [Restore] driveListFiles("${name}") threw an error: ${listErr.message}`, listErr);
          continue;
        }

        const remoteRecords: any[] = [];
        for (const file of allRemoteFiles) {
          console.log(`⬇️ [Restore] Downloading file "${file.name}" (id: ${file.id})...`);
          try {
            const content = await this.driveDownload(file.id, accessToken);
            console.log(`⬇️ [Restore] Raw content received for "${file.name}": ${content ? `${content.length} bytes` : 'EMPTY/NULL'}`);
            if (content) {
              let records: any;
              try {
                records = JSON.parse(content);
              } catch (parseErr: any) {
                console.error(`❌ [Restore] JSON.parse failed for "${file.name}": ${parseErr.message}. Raw content (first 200 chars): ${content.substring(0, 200)}`);
                continue;
              }
              if (Array.isArray(records)) {
                console.log(`⬇️ [Restore] Parsed ${records.length} records from "${file.name}".`);
                if (records.length > 0) {
                  console.log(`⬇️ [Restore] First record sample: ${JSON.stringify(records[0]).substring(0, 150)}`);
                }
                remoteRecords.push(...records);
              } else {
                console.warn(`⚠️ [Restore] Content of "${file.name}" is not a JSON array. Type: ${typeof records}. Skipping.`);
              }
            } else {
              console.warn(`⚠️ [Restore] File "${file.name}" returned empty/null content. Skipping.`);
            }
          } catch (dlErr: any) {
            console.error(`❌ [Restore] driveDownload("${file.name}") threw: ${dlErr.message}`, dlErr);
          }
        }

        if (remoteRecords.length > 0) {
          console.log(`🔀 [Restore] Merging ${remoteRecords.length} remote records into local "${name}"...`);
          const merged = await this.mergeRecords(name, table, remoteRecords);
          totalDownloaded += merged;
          console.log(`✅ [Restore] Merge complete for "${name}": ${merged} records inserted/updated. Running total: ${totalDownloaded}`);
        } else {
          console.log(`📭 [Restore] No remote records collected for "${name}" — skipping merge.`);
        }
      }

      console.log(`\n🏁 [Restore] ===== RESTORE COMPLETE =====`);
      console.log(`🏁 [Restore] Total records restored across all tables: ${totalDownloaded}`);
      return { success: true, downloaded: totalDownloaded };
    } catch (err: any) {
      console.error('❌ [Restore] RESTORE FAILED with unhandled exception:', err);
      return { success: false, downloaded: totalDownloaded, error: err.message || String(err) };
    }
  },

  /**
   * Migrate all local offline database records to a newly connected Google account.
   */
  async migrateOfflineData(newGoogleAccountId: string): Promise<void> {
    console.log(`Migrating offline data to Google Account ID: ${newGoogleAccountId}`);
    if (Platform.OS === 'web') {
      for (const { name } of SYNCABLE_TABLES) {
        try {
          const stored = localStorage.getItem(`ff_${name}`);
          const list = stored ? JSON.parse(stored) : [];
          const updated = list.map((item: any) => ({
            ...item,
            googleAccountId: newGoogleAccountId,
            isSynced: false,
            syncStatus: 'PENDING',
          }));
          localStorage.setItem(`ff_${name}`, JSON.stringify(updated));
        } catch (err) {
          console.error(`Web migration failed for table ${name}:`, err);
        }
      }
      return;
    }

    for (const { name, table } of SYNCABLE_TABLES) {
      try {
        await db
          .update(table)
          .set({
            googleAccountId: newGoogleAccountId,
            isSynced: false,
            syncStatus: 'PENDING',
          } as any);
      } catch (err) {
        console.error(`Migration failed for table ${name}:`, err);
      }
    }
  },

  /**
   * Compare and merge remote records into SQLite.
   * Latest-Version-Wins algorithm.
   */
  async mergeRecords(tableName: string, table: any, remoteRecords: any[]): Promise<number> {
    let updateCount = 0;
    
    // Group records by ID to process the latest state of each entity
    const latestRemoteMap = new Map<string, any>();
    for (const record of remoteRecords) {
      const existing = latestRemoteMap.get(record.id);
      if (!existing || record.version > existing.version || (record.version === existing.version && record.updatedAt > existing.updatedAt)) {
        latestRemoteMap.set(record.id, record);
      }
    }

    if (Platform.OS === 'web') {
      const stored = localStorage.getItem(`ff_${tableName}`);
      const localRecords = stored ? JSON.parse(stored) : [];
      const localMap = new Map<string, any>(localRecords.map((r: any) => [r.id, r]));

      for (const [id, remoteRecord] of latestRemoteMap.entries()) {
        const localRecord = localMap.get(id);
        if (!localRecord) {
          localRecords.push({
            ...remoteRecord,
            isSynced: true,
            syncStatus: 'SYNCED',
          });
          updateCount++;
        } else {
          const remoteIsNewer = 
            remoteRecord.version > localRecord.version || 
            (remoteRecord.version === localRecord.version && remoteRecord.updatedAt > localRecord.updatedAt);

          if (remoteIsNewer) {
            const idx = localRecords.findIndex((r: any) => r.id === id);
            localRecords[idx] = {
              ...remoteRecord,
              isSynced: true,
              syncStatus: 'SYNCED',
            };
            updateCount++;
          }
        }
      }
      localStorage.setItem(`ff_${tableName}`, JSON.stringify(localRecords));
      return updateCount;
    }

    const localRecords = await db.select().from(table);
    const localMap = new Map<string, any>(localRecords.map((r: any) => [r.id, r]));

    await db.transaction(async (tx: any) => {
      for (const [id, remoteRecord] of latestRemoteMap.entries()) {
        const localRecord = localMap.get(id);

        if (!localRecord) {
          // Insert missing record
          await tx.insert(table).values({
            ...remoteRecord,
            isSynced: true,
            syncStatus: 'SYNCED',
          });
          updateCount++;
        } else {
          // Conflict resolution: Remote is newer
          const remoteIsNewer = 
            remoteRecord.version > localRecord.version || 
            (remoteRecord.version === localRecord.version && remoteRecord.updatedAt > localRecord.updatedAt);

          if (remoteIsNewer) {
            await tx
              .update(table)
              .set({
                ...remoteRecord,
                isSynced: true,
                syncStatus: 'SYNCED',
              })
              .where(eq(table.id, id));
            updateCount++;
          }
        }
      }
    });

    return updateCount;
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GOOGLE DRIVE REST API INTEGRATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  async getFreshAccessToken(forceRefresh = false): Promise<string | null> {
    const googleAccountId = await getActiveGoogleAccountId();
    console.log(`🔑 [getFreshAccessToken] Called. googleAccountId from storage: "${googleAccountId || 'NOT SET'}", forceRefresh: ${forceRefresh}, Platform: ${Platform.OS}`);

    // Only return mock token for actual mock/test accounts
    if (googleAccountId === 'mock_user_123') {
      console.log('🔑 [getFreshAccessToken] Returning mock token for mock account.');
      return 'mock_token';
    }

    if (Platform.OS === 'web') {
      if (forceRefresh) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('googleAccessToken');
        }
        console.warn('🔑 [getFreshAccessToken] Force refresh on web — token cleared. User must re-authenticate.');
        return null;
      }
      const token = await getSecureItem('googleAccessToken');
      console.log(`🔑 [getFreshAccessToken] Web: reading "googleAccessToken" from localStorage — ${token ? `FOUND (length: ${token.length})` : 'NOT FOUND (this is the likely cause of restore failure!)'}`);
      if (!token && typeof window !== 'undefined') {
        // Log ALL localStorage keys to help debug what is / isn't there
        const allKeys = Object.keys(localStorage);
        console.warn(`🔑 [getFreshAccessToken] Web: ALL localStorage keys present (${allKeys.length}): ${JSON.stringify(allKeys)}`);
      }
      return token;
    }

    if (GoogleSignin) {
      try {
        if (forceRefresh) {
          console.log('🔑 [getFreshAccessToken] Native: force refresh — clearing cached token and signing in silently...');
          try {
            const currentTokens = await GoogleSignin.getTokens();
            if (currentTokens?.accessToken) {
              await GoogleSignin.clearCachedAccessToken(currentTokens.accessToken);
              console.log('🔑 [getFreshAccessToken] Native: cached token cleared.');
            }
          } catch (clearErr) {
            console.warn('🔑 [getFreshAccessToken] Native: Failed to clear cached token:', clearErr);
          }
          await GoogleSignin.signInSilently();
        }
        const tokens = await GoogleSignin.getTokens();
        const token = tokens?.accessToken || null;
        console.log(`🔑 [getFreshAccessToken] Native: GoogleSignin.getTokens() returned: ${token ? `token (length: ${token.length})` : 'NULL'}`);
        return token;
      } catch (err) {
        console.warn('🔑 [getFreshAccessToken] Native: Error getting token:', err);
        try {
          console.log('🔑 [getFreshAccessToken] Native: Attempting silent sign-in recovery...');
          await GoogleSignin.signInSilently();
          const tokens = await GoogleSignin.getTokens();
          const token = tokens?.accessToken || null;
          console.log(`🔑 [getFreshAccessToken] Native: Silent sign-in recovery token: ${token ? `OK (length: ${token.length})` : 'NULL'}`);
          return token;
        } catch (silentErr) {
          console.error('🔑 [getFreshAccessToken] Native: Silent sign-in failed:', silentErr);
        }
      }
    } else {
      console.warn('🔑 [getFreshAccessToken] Native: GoogleSignin module is NULL — not loaded.');
    }
    console.error('🔑 [getFreshAccessToken] Returning NULL — could not retrieve any token.');
    return null;
  },

  async callDriveAPI(
    url: string,
    options: RequestInit,
    retryCount = 0
  ): Promise<Response> {
    const response = await fetch(url, options);
    
    if (response.status === 401 && retryCount < 1) {
      console.warn('Received 401 from Google Drive API. Attempting token refresh...');
      const freshToken = await this.getFreshAccessToken(true);
      if (freshToken) {
        const headers = { ...options.headers } as Record<string, string>;
        headers['Authorization'] = `Bearer ${freshToken}`;
        return this.callDriveAPI(url, { ...options, headers }, retryCount + 1);
      } else {
        if (Platform.OS === 'web') {
          throw new Error('Google session expired. Please connect your Google account again.');
        }
      }
    }
    
    return response;
  },

  async driveUpload(fileName: string, content: string): Promise<void> {
    const existingFileId = await this.driveFindFileId(fileName);
    
    const meta = {
      name: fileName,
      parents: ['appDataFolder'],
    };

    const boundary = 'foo_bar_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--\r\n`;

    const multipartBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(meta) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      content +
      closeDelimiter;

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (existingFileId) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
      method = 'PATCH';
    }

    const accessToken = await this.getFreshAccessToken();
    if (!accessToken) {
      throw new Error('Google access token is not available. Please sign in again.');
    }

    const response = await this.callDriveAPI(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': existingFileId ? 'application/json' : `multipart/related; boundary=${boundary}`,
      },
      body: existingFileId ? content : multipartBody,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Drive upload failed (${response.status}): ${errText}`);
    }
  },

  async driveFindFileId(fileName: string): Promise<string | null> {
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name = '${fileName}' and 'appDataFolder' in parents and trashed = false`
    )}&spaces=appDataFolder`;

    const accessToken = await this.getFreshAccessToken();
    if (!accessToken) {
      return null;
    }

    const response = await this.callDriveAPI(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) {
      const json = await response.json();
      if (json.files && json.files.length > 0) {
        return json.files[0].id;
      }
    }
    return null;
  },

  async driveListFiles(prefix: string, injectedAccessToken?: string): Promise<{ id: string; name: string; modifiedTime: string }[]> {
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name contains '${prefix}_' and 'appDataFolder' in parents and trashed = false`
    )}&spaces=appDataFolder&fields=files(id,name,modifiedTime)`;

    const accessToken = injectedAccessToken || await this.getFreshAccessToken();
    if (!accessToken) {
      throw new Error('Google access token is not available. Please sign in again.');
    }

    const response = await this.callDriveAPI(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`❌ Drive API list error for "${prefix}": ${response.status} — ${errBody}`);
      throw new Error(`Drive list failed (${response.status}): ${errBody}`);
    }

    const json = await response.json();
    return (json.files || []).map((f: any) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime }));
  },

  async driveDownload(fileId: string, injectedAccessToken?: string): Promise<string> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    
    const accessToken = injectedAccessToken || await this.getFreshAccessToken();
    if (!accessToken) {
      throw new Error('Google access token is not available. Please sign in again.');
    }

    const response = await this.callDriveAPI(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`❌ Drive API download error for "${fileId}": ${response.status} — ${errBody}`);
      throw new Error(`Drive download failed (${response.status}): ${errBody}`);
    }

    return await response.text();
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MOCK SYSTEM FOR LOCAL DEVELOPER SANDBOX
  // ─────────────────────────────────────────────────────────────────────────────

  getMockDir() {
    return FileSystem ? `${FileSystem.documentDirectory}mock_google_drive/` : '';
  },

  async ensureMockDir() {
    if (!FileSystem) return;
    const dir = this.getMockDir();
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  },

  async mockUpload(fileName: string, content: string): Promise<void> {
    if (!FileSystem) return;
    await this.ensureMockDir();
    const fileUri = `${this.getMockDir()}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, content);
  },

  async mockListFiles(prefix: string): Promise<string[]> {
    if (!FileSystem) return [];
    await this.ensureMockDir();
    const files = await FileSystem.readDirectoryAsync(this.getMockDir());
    return files.filter((f: any) => f.startsWith(`${prefix}_`) && f.endsWith('.json'));
  },

  async mockDownload(fileName: string): Promise<string> {
    if (!FileSystem) return '';
    const fileUri = `${this.getMockDir()}${fileName}`;
    return await FileSystem.readAsStringAsync(fileUri);
  },
};
