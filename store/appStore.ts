import { create } from 'zustand';
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

  // Core Actions
  initApp: () => Promise<void>;
  setTab: (tab: AppTab) => void;
  toggleTheme: () => void;
  setLocked: (locked: boolean) => void;
  
  // Auth Actions
  login: (mock?: boolean) => Promise<void>;
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
  user: null,
  authLoading: true,
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  goals: [],
  bills: [],
  syncLoading: false,
  lastSyncTime: null,

  initApp: async () => {
    try {
      // 1. Initialize SQLite Database
      await initDb();
      
      // 2. Fetch User Session
      const user = await AuthService.getCurrentUser();
      const signedIn = !!user;

      set({ 
        user, 
        authLoading: false, 
        dbInitialized: true,
        // Set appLocked to false by default for better sandbox UX
        appLocked: false 
      });

      // 3. Load all DB data if logged in
      if (signedIn) {
        await get().refreshAllData();
      }
    } catch (e) {
      console.error('App initialization failed:', e);
      set({ authLoading: false });
    }
  },

  setTab: (tab) => set({ activeTab: tab }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  setLocked: (locked) => set({ appLocked: locked }),

  login: async (mock = false) => {
    set({ authLoading: true });
    try {
      const session = mock ? await AuthService.mockSignIn() : await AuthService.signIn();
      set({ user: session, authLoading: false, appLocked: false });
      await get().refreshAllData();
    } catch (e) {
      console.error('Login error:', e);
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
