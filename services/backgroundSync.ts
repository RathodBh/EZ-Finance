import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { SyncService } from './sync';
import { AuthService } from './auth';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

// Define the background task
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    console.log('[Background Sync] Running background sync task...');
    
    // Ensure user is signed in before syncing
    const signedIn = await AuthService.isSignedIn();
    if (!signedIn) {
      console.log('[Background Sync] User is not signed in. Skipping sync.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const result = await SyncService.runSync('BACKGROUND');
    if (result.success) {
      console.log('[Background Sync] Background sync succeeded!');
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } else {
      console.warn('[Background Sync] Background sync failed:', result.error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  } catch (error) {
    console.error('[Background Sync] Error running background task:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const BackgroundSyncService = {
  /**
   * Registers the background sync task to execute periodically
   * Default interval is set to 24 hours (86400 seconds) for standard sync frequency,
   * but can trigger sooner depending on OS schedules.
   */
  async registerSyncTask(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
      if (!isRegistered) {
        // Register the background fetch task
        await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
          minimumInterval: 60 * 60 * 24, // Once daily in seconds
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log('[Background Sync] Task successfully registered.');
      } else {
        console.log('[Background Sync] Task already registered.');
      }
    } catch (err) {
      console.error('[Background Sync] Registration failed:', err);
    }
  },

  /**
   * Check current task status.
   */
  async getSyncTaskStatus(): Promise<BackgroundFetch.BackgroundFetchStatus | null> {
    try {
      return await BackgroundFetch.getStatusAsync();
    } catch (e) {
      console.error('[Background Sync] Failed to get task status:', e);
      return null;
    }
  },

  /**
   * Cancel and unregister the background task.
   */
  async unregisterSyncTask(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
      if (isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
        console.log('[Background Sync] Task successfully unregistered.');
      }
    } catch (err) {
      console.error('[Background Sync] Unregistration failed:', err);
    }
  },
};
