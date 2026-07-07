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

    if (!googleAccountId) {
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
      } else if (Platform.OS === 'web') {
        accessToken = await getSecureItem('googleAccessToken');
      } else if (GoogleSignin) {
        const tokens = await GoogleSignin.getTokens();
        accessToken = tokens?.accessToken || null;
      }

      if (!accessToken) {
        throw new Error('Google access token is not available. Please sign in again.');
      }

      console.log(`Starting sync process (${syncType}). Mock mode: ${mockMode}`);

      // Loop through all tables, sync one-by-one
      for (const { name, table } of SYNCABLE_TABLES) {
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

        // 3. Upload device's state to Google Drive AppData
        const fileName = `${name}_${deviceId}.json`;
        const payloadStr = JSON.stringify(allLocalRecords);

        if (mockMode) {
          await this.mockUpload(fileName, payloadStr);
        } else {
          await this.driveUpload(accessToken, fileName, payloadStr);
        }
        recordsUploaded += dirtyRecords.length;

        // 4. Download other devices' state files
        let allRemoteFiles: { id: string; name: string }[] = [];
        if (mockMode) {
          const files = await this.mockListFiles(name);
          allRemoteFiles = files.map(f => ({ id: f, name: f }));
        } else {
          allRemoteFiles = await this.driveListFiles(accessToken, name);
        }

        const remoteRecords: any[] = [];
        for (const file of allRemoteFiles) {
          // Skip downloading our own device file
          if (file.name.includes(deviceId)) continue;

          let fileContentStr = '';
          if (mockMode) {
            fileContentStr = await this.mockDownload(file.id);
          } else {
            fileContentStr = await this.driveDownload(accessToken, file.id);
          }

          if (fileContentStr) {
            try {
              const records = JSON.parse(fileContentStr);
              if (Array.isArray(records)) {
                remoteRecords.push(...records);
              }
            } catch (parseErr) {
              console.warn(`Failed to parse remote file: ${file.name}`, parseErr);
            }
          }
        }

        // 5. Merge remote records using Latest-Version-Wins
        let tableDownloadedCount = 0;
        if (remoteRecords.length > 0) {
          tableDownloadedCount = await this.mergeRecords(name, table, remoteRecords);
          recordsDownloaded += tableDownloadedCount;
        }

        // 6. Mark all local records as synced since we pushed our full state
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
            } as any)
            .where(eq((table as any).isSynced, false));
        }
      }

      success = true;
      console.log('Sync process completed successfully!');
    } catch (error: any) {
      success = false;
      errorMessage = error.message || String(error);
      console.error('Sync process failed:', error);
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

    for (const [id, remoteRecord] of latestRemoteMap.entries()) {
      // Find local copy
      const localRecord = await db
        .select()
        .from(table)
        .where(eq(table.id, id))
        .then((res: any) => res[0]);

      if (!localRecord) {
        // Insert missing record
        await db.insert(table).values({
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
          // If remote is soft-deleted, perform soft-delete locally
          await db
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

    return updateCount;
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GOOGLE DRIVE REST API INTEGRATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  async driveUpload(accessToken: string, fileName: string, content: string): Promise<void> {
    const existingFileId = await this.driveFindFileId(accessToken, fileName);
    
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

    const response = await fetch(url, {
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

  async driveFindFileId(accessToken: string, fileName: string): Promise<string | null> {
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name = '${fileName}' and 'appDataFolder' in parents and trashed = false`
    )}&spaces=appDataFolder`;

    const response = await fetch(url, {
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

  async driveListFiles(accessToken: string, prefix: string): Promise<{ id: string; name: string }[]> {
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name contains '${prefix}_' and 'appDataFolder' in parents and trashed = false`
    )}&spaces=appDataFolder&fields=files(id,name)`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Drive list failed: ${response.statusText}`);
    }

    const json = await response.json();
    return (json.files || []).map((f: any) => ({ id: f.id, name: f.name }));
  },

  async driveDownload(accessToken: string, fileId: string): Promise<string> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Drive download failed: ${response.statusText}`);
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
