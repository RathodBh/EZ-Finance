import { create } from 'zustand';
import { Platform, Alert } from 'react-native';
import { AuthService, UserSession } from '../services/auth';
import { 
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
  
  // Auth Session State
  user: UserSession | null;
  authLoading: boolean;

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
  login: () => Promise<void>;
  loginOffline: (name: string) => Promise<void>;
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
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'dashboard',
  theme: 'dark', // Slate Dark mode by default for premium feel
  dbInitialized: false,
  appLocked: false,
  isBootstrapping: true,
  user: null,
  authLoading: false,
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  goals: [],
  bills: [],
  syncLoading: false,
  lastSyncTime: null,
  autoSyncEnabled: false,

  initApp: async () => {
    try {
      // 1. Initialize SQLite Database
      await initDb();
      
      // 2. Fetch User Session
      const user = await AuthService.getCurrentUser();
      const signedIn = !!user;

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

      set({ 
        user, 
        authLoading: false, 
        dbInitialized: true,
        autoSyncEnabled,
        theme: savedTheme,
        isBootstrapping: false,
        // Set appLocked to false by default for better sandbox UX
        appLocked: false 
      });

      // 4. Load all DB data if logged in
      if (signedIn) {
        await get().refreshAllData();
        // Auto-trigger sync on startup if logged in with Google (not offline) and autoSync is enabled
        if (user && user.id !== 'offline_user' && autoSyncEnabled) {
          get().triggerSync();
        }
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

  login: async () => {
    set({ authLoading: true });
    try {
      const session = await AuthService.signIn();
      set({ user: session, authLoading: false, appLocked: false });
      await get().refreshAllData();
      // Auto-trigger sync on login to pull down cloud data
      get().triggerSync();
    } catch (e) {
      console.error('Login error:', e);
      set({ authLoading: false });
      throw e;
    }
  },

  loginOffline: async (name: string) => {
    set({ authLoading: true });
    try {
      const session = await AuthService.signInOffline(name);
      set({ user: session, authLoading: false, appLocked: false });
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
      const session = await AuthService.signIn();
      await SyncService.migrateOfflineData(session.id);
      set({ user: session, authLoading: false, appLocked: false });
      await get().refreshAllData();
      await get().triggerSync();
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
      } else {
        console.warn('Sync warning:', res.error);
      }
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      set({ syncLoading: false });
    }
  },
}));
