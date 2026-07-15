import { create } from 'zustand';
import { Platform, Alert } from 'react-native';
import { AuthService, UserSession } from '../services/auth';
import { 
  UserRepository,
  AccountRepository, 
  CategoryRepository, 
  TransactionRepository, 
  BudgetRepository, 
  GoalRepository,
  BillRepository 
} from '../db/repositories';
import { initDb } from '../db/client';
import { SyncService } from '../services/sync';

export type AppTab = 'dashboard' | 'transactions' | 'reports' | 'budgets' | 'more';
// Navigation tabs type

interface AppState {
  // Navigation & UI State
  activeTab: AppTab;
  theme: 'light' | 'dark';
  dbInitialized: boolean;
  appLocked: boolean;
  isBootstrapping: boolean;
  
  // Preferences State
  currency: string;
  notificationsEnabled: boolean;
  setCurrency: (currency: string) => Promise<void>;
  toggleNotifications: (enabled: boolean) => Promise<void>;

  // SlideUpModal controls for Transaction overlay
  showTxModal: boolean;
  activeTxToEdit: any | null;
  setShowTxModal: (show: boolean, txToEdit?: any | null) => void;

  // Auth Session State
  user: UserSession | null;
  authLoading: boolean;
  tempGoogleSession: UserSession | null;
  setTempGoogleSession: (session: UserSession | null) => void;

  // Data States
  accounts: any[];
  categories: any[];
  transactions: any[];
  budgets: any[];
  goals: any[];
  bills: any[];

  // Sync States
  syncLoading: boolean;
  lastSyncTime: number | null;

  autoSyncEnabled: boolean;

  // Core Actions
  initApp: () => Promise<void>;
  setTab: (tab: AppTab) => void;
  toggleTheme: () => Promise<void>;
  setLocked: (locked: boolean) => void;
  toggleAutoSync: () => Promise<void>;
  
  // Auth Actions
  login: (session: UserSession, currencyPreference?: string) => Promise<void>;
  loginOffline: (name: string, currencyPreference?: string) => Promise<void>;
  connectGoogleAccount: () => Promise<void>;
  logout: () => Promise<void>;

  // Data Refresh Actions
  refreshAllData: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  refreshBudgets: () => Promise<void>;
  refreshGoals: () => Promise<void>;
  refreshBills: () => Promise<void>;

  // Sync Action
  triggerSync: () => Promise<void>;

  // Toast state & actions
  toast: {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  };
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'dashboard',
  theme: 'dark', // Slate Dark mode by default for premium feel
  dbInitialized: false,
  appLocked: false,
  isBootstrapping: true,
  currency: 'USD',
  notificationsEnabled: false,
  showTxModal: false,
  activeTxToEdit: null,
  user: null,
  authLoading: false,
  tempGoogleSession: null,
  setTempGoogleSession: (session) => set({ tempGoogleSession: session }),
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  goals: [],
  bills: [],
  syncLoading: false,
  lastSyncTime: null,
  autoSyncEnabled: false,

  toast: {
    visible: false,
    message: '',
    type: 'info',
  },
  showToast: (message, type = 'info') => {
    set({ toast: { visible: true, message, type } });
  },
  hideToast: () => {
    set((state) => ({ toast: { ...state.toast, visible: false } }));
  },

  initApp: async () => {
    console.log('🚀 [initApp] ===== APP INITIALIZATION STARTED =====');
    console.log(`🚀 [initApp] Platform: ${Platform.OS}`);
    try {
      // 1. Initialize SQLite Database
      console.log('🗄️ [initApp] Step 1: Initializing database...');
      await initDb();
      console.log('🗄️ [initApp] Step 1: Database initialized successfully.');
      
      // 1b. Check for Google OAuth Redirect hash on web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        console.log(`🌐 [initApp] Step 1b: Checking URL hash for OAuth redirect. Hash present: ${!!hash}, Contains access_token: ${hash?.includes('access_token=')}`);
        console.log(`🌐 [initApp] Step 1b: Full hash value: "${hash || '(empty)'}"`);
        if (hash && hash.includes('access_token=')) {
          console.log('🔑 [initApp] Step 1b: OAuth redirect detected! Parsing access_token...');
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          console.log(`🔑 [initApp] Step 1b: Access token parsed: ${accessToken ? `YES (length: ${accessToken.length})` : 'NO — token missing from hash'}`);
          if (accessToken) {
            // Clean URL hash
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            console.log('🔑 [initApp] Step 1b: URL hash cleaned.');
            try {
              set({ authLoading: true });
              console.log('👤 [initApp] Step 1b: Fetching user profile from Google using access token...');
              const session = await AuthService.handleRedirectCallback(accessToken);
              console.log(`👤 [initApp] Step 1b: User profile fetched. email: "${session.email}", id: "${session.id}"`);
              console.log(`👤 [initApp] Step 1b: googleAccessToken in localStorage AFTER handleRedirectCallback: ${typeof window !== 'undefined' ? (localStorage.getItem('googleAccessToken') ? `YES (length: ${localStorage.getItem('googleAccessToken')!.length})` : 'NOT FOUND') : 'N/A'}`);
              console.log(`👤 [initApp] Step 1b: googleAccountId in localStorage AFTER handleRedirectCallback: ${typeof window !== 'undefined' ? (localStorage.getItem('googleAccountId') || 'NOT FOUND') : 'N/A'}`);
              
              // ALWAYS restore from Google Drive FIRST when logging in with Google.
              // Do NOT check local DB profile beforehand because local storage / DB might have been cleared!
              console.log('☁️ [initApp] Step 1b: Running cloud restore for Google user...');
              console.log(`☁️ [initApp] Step 1b: Passing explicitGoogleAccountId="${session.id}", explicitAccessToken=${accessToken ? `YES (length: ${accessToken.length})` : 'NONE'}`);
              get().showToast('Checking Google Drive for your data...', 'info');
              
              const restoreResult = await SyncService.restoreFromCloud(session.id, accessToken);
              console.log(`☁️ [initApp] Step 1b: restoreFromCloud result: success=${restoreResult.success}, downloaded=${restoreResult.downloaded}, error=${restoreResult.error || 'none'}`);
              
              // Now check if profile/currency exists post-restore, or use saved/default currency
              const profile = await UserRepository.getProfile(session.id);
              const effectiveCurrency = profile?.currency || (typeof window !== 'undefined' ? localStorage.getItem('currency') : null) || 'USD';
              console.log(`📋 [initApp] Step 1b: Post-restore profile found: ${profile ? 'YES' : 'NO'}, effectiveCurrency: "${effectiveCurrency}"`);

              // Ensure profile is saved to DB
              await UserRepository.upsertProfile({
                id: session.id,
                googleId: session.id,
                email: session.email,
                displayName: session.name,
                photoUrl: session.photoUrl || undefined,
                currency: effectiveCurrency,
              });

              set({ user: session, currency: effectiveCurrency, authLoading: false, appLocked: false });
              console.log('🔄 [initApp] Step 1b: User session established. Refreshing local store data...');
              await get().refreshAllData();

              if (restoreResult.success && restoreResult.downloaded > 0) {
                get().showToast(`Data restored! ${restoreResult.downloaded} records loaded from Drive.`, 'success');
              } else if (!restoreResult.error) {
                get().showToast('Signed in with Google!', 'info');
              } else {
                get().showToast('Signed in, but could not restore from Drive. Try Sync later.', 'error');
              }
            } catch (err) {
              console.error('❌ [initApp] Step 1b: Error handling OAuth redirect:', err);
              set({ authLoading: false });
            }
          }
        } else {
          console.log('🌐 [initApp] Step 1b: No OAuth redirect detected. Normal startup.');
        }
      }
      
      // 2. Fetch User Session
      console.log('👤 [initApp] Step 2: Fetching stored user session...');
      const user = await AuthService.getCurrentUser();
      const signedIn = !!user;
      console.log(`👤 [initApp] Step 2: Stored user session: ${user ? `"${user.email}" (id: "${user.id}")` : 'NONE — not signed in'}`);

      // 3. Load auto sync preference
      let autoSyncEnabled = false;
      if (Platform.OS === 'web') {
        autoSyncEnabled = localStorage.getItem('autoSyncEnabled') === 'true';
      } else {
        try {
          const SecureStore = require('expo-secure-store');
          const val = await SecureStore.getItemAsync('autoSyncEnabled');
          autoSyncEnabled = val === 'true';
        } catch {}
      }

      // Load theme preference
      let savedTheme: 'light' | 'dark' = 'dark';
      if (Platform.OS === 'web') {
        const themeVal = localStorage.getItem('theme');
        if (themeVal === 'light' || themeVal === 'dark') {
          savedTheme = themeVal;
        }
      } else {
        try {
          const SecureStore = require('expo-secure-store');
          const val = await SecureStore.getItemAsync('theme');
          if (val === 'light' || val === 'dark') {
            savedTheme = val;
          }
        } catch {}
      }

      // Load currency preference
      let savedCurrency: string = 'USD';
      if (Platform.OS === 'web') {
        const currVal = localStorage.getItem('currency');
        if (currVal) {
          savedCurrency = currVal;
        }
      } else {
        try {
          const SecureStore = require('expo-secure-store');
          const val = await SecureStore.getItemAsync('currency');
          if (val) {
            savedCurrency = val;
          }
        } catch {}
      }

      // Load notifications preference
      let savedNotifications = false;
      if (Platform.OS === 'web') {
        savedNotifications = localStorage.getItem('notificationsEnabled') === 'true';
      } else {
        try {
          const SecureStore = require('expo-secure-store');
          savedNotifications = await SecureStore.getItemAsync('notificationsEnabled') === 'true';
        } catch {}
      }

      console.log(`⚙️ [initApp] Step 3: Setting app state — user: ${user ? user.email : 'null'}, dbInitialized: true, theme: ${savedTheme}, currency: ${savedCurrency}`);
      set({ 
        user, 
        authLoading: false, 
        dbInitialized: true,
        autoSyncEnabled,
        theme: savedTheme,
        currency: savedCurrency,
        notificationsEnabled: savedNotifications,
        isBootstrapping: false,
        // Set appLocked to false by default for better sandbox UX
        appLocked: false 
      });
      console.log('⚙️ [initApp] Step 3: App state set successfully.');

      // 4. Load all DB data if logged in
      if (signedIn) {
        console.log(`📊 [initApp] Step 4: User is signed in. Loading all data from DB...`);
        await get().refreshAllData();
        console.log('📊 [initApp] Step 4: refreshAllData complete.');

        // Sync with user preferences stored in the DB if available
        if (user) {
          try {
            console.log(`📋 [initApp] Step 4: Loading user preferences from DB profile for "${user.id}"...`);
            const profile = await UserRepository.getProfile(user.id);
            console.log(`📋 [initApp] Step 4: DB profile: ${profile ? JSON.stringify({ currency: profile.currency, notificationsEnabled: profile.notificationsEnabled }) : 'NOT FOUND'}`);
            if (profile) {
              let dbCurrency = get().currency;
              let dbNotifs = get().notificationsEnabled;
              if (profile.currency) {
                dbCurrency = profile.currency;
              }
              if (profile.notificationsEnabled !== undefined && profile.notificationsEnabled !== null) {
                dbNotifs = !!profile.notificationsEnabled;
              }
              set({ currency: dbCurrency, notificationsEnabled: dbNotifs });
              console.log(`📋 [initApp] Step 4: Preferences applied — currency: ${dbCurrency}, notifications: ${dbNotifs}`);

              // Persist synced values locally
              if (Platform.OS === 'web') {
                localStorage.setItem('currency', dbCurrency);
                localStorage.setItem('notificationsEnabled', String(dbNotifs));
              } else {
                try {
                  const SecureStore = require('expo-secure-store');
                  await SecureStore.setItemAsync('currency', dbCurrency);
                  await SecureStore.setItemAsync('notificationsEnabled', String(dbNotifs));
                } catch {}
              }
            }
          } catch (profileErr) {
            console.error('❌ [initApp] Step 4: Failed to sync DB user preferences on init:', profileErr);
          }
        }

        // Auto-trigger sync on startup if logged in with Google (not offline) and autoSync is enabled
        if (user && user.id !== 'offline_user' && autoSyncEnabled) {
          console.log('🔄 [initApp] Step 4: autoSync is enabled. Triggering background sync...');
          get().triggerSync();
        } else {
          console.log(`🔄 [initApp] Step 4: autoSync skipped — autoSyncEnabled=${autoSyncEnabled}, userId=${user?.id}`);
        }
      } else {
        console.log('👤 [initApp] Step 4: No signed-in user. Skipping data load.');
      }
      console.log('🏁 [initApp] ===== INITIALIZATION COMPLETE =====');

      // Schedule or cancel reminders based on loaded preference
      try {
        const { NotificationService } = require('../services/notificationService');
        if (get().notificationsEnabled) {
          await NotificationService.scheduleDailyReminder();
        } else {
          await NotificationService.cancelAllReminders();
        }
      } catch (notifErr) {
        console.warn('Failed to schedule daily reminders on init:', notifErr);
      }
    } catch (e) {
      console.error('App initialization failed:', e);
      set({ authLoading: false, isBootstrapping: false });
    }
  },

  setTab: (tab) => set({ activeTab: tab }),
  toggleTheme: async () => {
    const nextTheme = get().theme === 'light' ? 'dark' : 'light';
    set({ theme: nextTheme });
    if (Platform.OS === 'web') {
      localStorage.setItem('theme', nextTheme);
    } else {
      try {
        const SecureStore = require('expo-secure-store');
        await SecureStore.setItemAsync('theme', nextTheme);
      } catch (e) {
        console.error('Failed to save theme setting:', e);
      }
    }
  },
  setLocked: (locked) => set({ appLocked: locked }),

  toggleAutoSync: async () => {
    const nextVal = !get().autoSyncEnabled;
    set({ autoSyncEnabled: nextVal });
    if (Platform.OS === 'web') {
      localStorage.setItem('autoSyncEnabled', String(nextVal));
    } else {
      try {
        const SecureStore = require('expo-secure-store');
        await SecureStore.setItemAsync('autoSyncEnabled', String(nextVal));
      } catch {}
    }
  },

  setCurrency: async (currency) => {
    set({ currency });
    if (Platform.OS === 'web') {
      localStorage.setItem('currency', currency);
    } else {
      try {
        const SecureStore = require('expo-secure-store');
        await SecureStore.setItemAsync('currency', currency);
      } catch (e) {
        console.error('Failed to save currency preference:', e);
      }
    }
    const { user } = get();
    if (user) {
      try {
        await UserRepository.upsertProfile({
          id: user.id,
          googleId: user.id,
          email: user.email || 'offline@ezfinance.local',
          currency,
        });
      } catch (e) {
        console.error('Failed to save currency preference to database:', e);
      }
    }
  },

  toggleNotifications: async (enabled) => {
    set({ notificationsEnabled: enabled });
    if (Platform.OS === 'web') {
      localStorage.setItem('notificationsEnabled', String(enabled));
    } else {
      try {
        const SecureStore = require('expo-secure-store');
        await SecureStore.setItemAsync('notificationsEnabled', String(enabled));
      } catch (e) {
        console.error('Failed to save notifications preference:', e);
      }
    }
    const { user } = get();
    if (user) {
      try {
        await UserRepository.upsertProfile({
          id: user.id,
          googleId: user.id,
          email: user.email || 'offline@ezfinance.local',
          notificationsEnabled: enabled,
        });
      } catch (e) {
        console.error('Failed to save notifications preference to database:', e);
      }
    }

    try {
      const { NotificationService } = require('../services/notificationService');
      if (enabled) {
        await NotificationService.scheduleDailyReminder();
      } else {
        await NotificationService.cancelAllReminders();
      }
    } catch (notifErr) {
      console.warn('Failed to toggle scheduled notifications:', notifErr);
    }
  },

  setShowTxModal: (show, txToEdit = null) => {
    set({ showTxModal: show, activeTxToEdit: txToEdit });
  },

  login: async (session: UserSession, currencyPreference = 'USD') => {
    console.log(`\n🔐 [login] ===== LOGIN STARTED =====`);
    console.log(`🔐 [login] session.id: "${session.id}", session.email: "${session.email}", currencyPreference: "${currencyPreference}"`);
    console.log(`🔐 [login] _accessToken embedded in session: ${ (session as any)._accessToken ? `YES (length: ${(session as any)._accessToken.length})` : 'NO' }`);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      console.log(`🔐 [login] localStorage.googleAccountId: ${localStorage.getItem('googleAccountId') || 'NOT SET'}`);
      console.log(`🔐 [login] localStorage.googleAccessToken: ${localStorage.getItem('googleAccessToken') ? `present (length: ${localStorage.getItem('googleAccessToken')!.length})` : 'NOT SET'}`);
    }
    set({ authLoading: true });
    try {
      console.log('🔐 [login] Setting user state and clearing tempGoogleSession...');
      set({ user: session, currency: currencyPreference, tempGoogleSession: null, authLoading: false, appLocked: false });
      if (Platform.OS === 'web') {
        localStorage.setItem('currency', currencyPreference);
        console.log(`🔐 [login] currency "${currencyPreference}" saved to localStorage.`);
      } else {
        try {
          const SecureStore = require('expo-secure-store');
          await SecureStore.setItemAsync('currency', currencyPreference);
        } catch {}
      }

      console.log('🔐 [login] Upserting user profile in DB...');
      await UserRepository.upsertProfile({
        id: session.id,
        googleId: session.id,
        email: session.email,
        displayName: session.name,
        photoUrl: session.photoUrl || undefined,
        currency: currencyPreference,
      });
      console.log('🔐 [login] User profile upserted.');

      console.log('📊 [login] Calling refreshAllData...');
      await get().refreshAllData();
      console.log('📊 [login] refreshAllData complete.');

      // Always attempt to restore from Drive when logging in with Google.
      if (session.id !== 'offline_user') {
        // Extract the raw access token if initApp embedded it in the session object.
        const rawAccessToken = (session as any)._accessToken || null;
        console.log(`☁️ [login] Google user detected. Preparing to restore from Drive...`);
        console.log(`☁️ [login] Raw _accessToken from session: ${rawAccessToken ? `YES (length: ${rawAccessToken.length})` : 'NOT embedded'}`);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const lsToken = localStorage.getItem('googleAccessToken');
          console.log(`☁️ [login] localStorage.googleAccessToken at restore time: ${lsToken ? `present (length: ${lsToken.length})` : 'NOT SET — this will cause token failure if no explicit token passed!'}`);
          const lsAccountId = localStorage.getItem('googleAccountId');
          console.log(`☁️ [login] localStorage.googleAccountId at restore time: ${lsAccountId || 'NOT SET'}`);
        }
        console.log(`☁️ [login] Calling SyncService.restoreFromCloud("${session.id}", explicitToken=${rawAccessToken ? 'YES' : 'NO'})`);
        get().showToast('Checking Google Drive for your data...', 'info');
        const restoreResult = await SyncService.restoreFromCloud(session.id, rawAccessToken ?? undefined);
        console.log(`☁️ [login] restoreFromCloud result: success=${restoreResult.success}, downloaded=${restoreResult.downloaded}, error=${restoreResult.error || 'none'}`);
        if (restoreResult.success && restoreResult.downloaded > 0) {
          console.log(`✅ [login] Drive restore complete. ${restoreResult.downloaded} records loaded. Refreshing data...`);
          get().showToast(`Data restored from Drive! ${restoreResult.downloaded} records loaded.`, 'success');
          await get().refreshAllData();
          console.log('✅ [login] refreshAllData after restore complete.');
        } else if (!restoreResult.error) {
          console.log('ℹ️ [login] Drive restore ran but found 0 new records (Drive may be empty or already up to date).');
          get().showToast('Signed in with Google! No prior backup found in Drive.', 'info');
        } else {
          console.warn('⚠️ [login] Drive restore had an error:', restoreResult.error);
          get().showToast('Signed in, but could not load data from Drive. Try using Sync later.', 'error');
        }
      } else {
        console.log('👤 [login] Offline user — skipping Drive restore.');
      }
      console.log('🏁 [login] ===== LOGIN COMPLETE =====');
    } catch (e) {
      console.error('❌ [login] Login error:', e);
      set({ authLoading: false });
      throw e;
    }
  },

  loginOffline: async (name: string, currencyPreference = 'USD') => {
    set({ authLoading: true });
    try {
      const session = await AuthService.signInOffline(name);
      
      set({ user: session, currency: currencyPreference, authLoading: false, appLocked: false });
      if (Platform.OS === 'web') {
        localStorage.setItem('currency', currencyPreference);
      } else {
        try {
          const SecureStore = require('expo-secure-store');
          await SecureStore.setItemAsync('currency', currencyPreference);
        } catch {}
      }

      await UserRepository.upsertProfile({
        id: 'offline_user',
        googleId: 'offline_user',
        email: 'offline@ezfinance.local',
        displayName: name,
        currency: currencyPreference,
      });

      await get().refreshAllData();
    } catch (e) {
      console.error('Offline login error:', e);
      set({ authLoading: false });
      throw e;
    }
  },

  connectGoogleAccount: async () => {
    set({ authLoading: true });
    try {
      const currentCurrency = get().currency;
      const currentNotifications = get().notificationsEnabled;
      const session = await AuthService.signIn();

      await UserRepository.upsertProfile({
        id: session.id,
        googleId: session.id,
        email: session.email,
        displayName: session.name,
        photoUrl: session.photoUrl || undefined,
        currency: currentCurrency,
        notificationsEnabled: currentNotifications,
      });

      set({ user: session, authLoading: false, appLocked: false });

      // Determine whether local DB is empty or has existing data
      const hasData = await SyncService.hasLocalData();
      console.log(`[connectGoogleAccount] Has local data: ${hasData}`);

      if (!hasData) {
        // Empty local DB — restore all data from Google Drive
        console.log('[connectGoogleAccount] No local data found. Restoring from Google Drive...');
        get().showToast('Restoring your data from Google Drive...', 'info');
        // Pass session.id explicitly — localStorage may not have 'googleAccountId' yet
        const restoreResult = await SyncService.restoreFromCloud(session.id);
        if (restoreResult.success && restoreResult.downloaded > 0) {
          console.log(`[connectGoogleAccount] Restore complete. ${restoreResult.downloaded} records restored.`);
          get().showToast(`Data restored successfully! ${restoreResult.downloaded} records loaded.`, 'success');
        } else if (restoreResult.downloaded === 0) {
          console.log('[connectGoogleAccount] No Drive data found to restore.');
          get().showToast('Google account connected. No previous data found in Drive.', 'info');
        } else {
          console.warn('[connectGoogleAccount] Restore had issues:', restoreResult.error);
          get().showToast('Could not fully restore from Drive. You can try syncing again.', 'error');
        }
      } else {
        // Has local data — mark all records as dirty and upload to Drive
        console.log('[connectGoogleAccount] Local data found. Migrating and uploading to Google Drive...');
        await SyncService.migrateOfflineData(session.id);
        await get().triggerSync();
      }

      await get().refreshAllData();
    } catch (e) {
      console.error('Connect Google error:', e);
      set({ authLoading: false });
      throw e;
    }
  },

  logout: async () => {
    set({ authLoading: true });
    try {
      await AuthService.signOut();
      set({ 
        user: null, 
        authLoading: false,
        accounts: [],
        categories: [],
        transactions: [],
        budgets: [],
        goals: [],
        bills: [],
        activeTab: 'dashboard'
      });
    } catch (e) {
      console.error('Logout error:', e);
      set({ authLoading: false });
    }
  },

  refreshAllData: async () => {
    await Promise.all([
      get().refreshAccounts(),
      get().refreshCategories(),
      get().refreshTransactions(),
      get().refreshBudgets(),
      get().refreshGoals(),
      get().refreshBills(),
    ]);
  },

  refreshAccounts: async () => {
    const list = await AccountRepository.getAll();
    set({ accounts: list });
  },

  refreshCategories: async () => {
    const list = await CategoryRepository.getAll();
    set({ categories: list });
  },

  refreshTransactions: async () => {
    const list = await TransactionRepository.getAll(150, 0); // Load latest 150 transactions
    set({ transactions: list });
  },

  refreshBudgets: async () => {
    const list = await BudgetRepository.getAll();
    set({ budgets: list });
  },

  refreshGoals: async () => {
    const list = await GoalRepository.getAll();
    set({ goals: list });
  },

  refreshBills: async () => {
    const list = await BillRepository.getAll();
    set({ bills: list });
  },

  triggerSync: async () => {
    const currentUser = get().user;
    if (!currentUser || currentUser.id === 'offline_user') {
      if (Platform.OS === 'web') {
        const confirmLogin = window.confirm(
          'Google Login Required\n\nCloud synchronization requires a Google account. Would you like to Sign In with Google now and upload all your existing offline data?'
        );
        if (confirmLogin) {
          try {
            await get().connectGoogleAccount();
          } catch (err) {
            // error handled in connectGoogleAccount
          }
        }
      } else {
        Alert.alert(
          'Google Login Required',
          'Cloud synchronization requires a Google account. Would you like to Sign In with Google now and upload all your existing offline data?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Sign In', 
              onPress: async () => {
                try {
                  await get().connectGoogleAccount();
                } catch (err) {
                  // error handled in connectGoogleAccount
                }
              } 
            }
          ]
        );
      }
      return;
    }

    if (get().syncLoading) return;
    set({ syncLoading: true });
    try {
      const res = await SyncService.runSync('MANUAL');
      if (res.success) {
        set({ lastSyncTime: Date.now() });
        // Refresh local data to pull in merged records
        await get().refreshAllData();
        get().showToast("Sync completed successfully!", "success");
      } else {
        console.warn('Sync warning:', res.error);
        get().showToast(`Sync failed: ${res.error}`, "error");
      }
    } catch (e: any) {
      console.error('Sync failed:', e);
      get().showToast(`Sync failed: ${e.message}`, "error");
    } finally {
      set({ syncLoading: false });
    }
  },
}));
