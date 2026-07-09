import { useAppStore } from './appStore';
import { AuthService } from '../services/auth';
import { AccountRepository, CategoryRepository, TransactionRepository, BudgetRepository, GoalRepository, BillRepository, UserRepository } from '../db/repositories';
import { initDb } from '../db/client';

// Mock dependencies
jest.mock('../db/client', () => ({
  initDb: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../db/repositories', () => ({
  UserRepository: {
    getProfile: jest.fn().mockResolvedValue(null),
    upsertProfile: jest.fn().mockResolvedValue(undefined),
  },
  AccountRepository: {
    getAll: jest.fn().mockResolvedValue([]),
  },
  CategoryRepository: {
    getAll: jest.fn().mockResolvedValue([]),
  },
  TransactionRepository: {
    getAll: jest.fn().mockResolvedValue([]),
  },
  BudgetRepository: {
    getAll: jest.fn().mockResolvedValue([]),
  },
  GoalRepository: {
    getAll: jest.fn().mockResolvedValue([]),
  },
  BillRepository: {
    getAll: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../services/auth', () => ({
  AuthService: {
    getCurrentUser: jest.fn().mockResolvedValue(null),
    signInOffline: jest.fn().mockImplementation((name) => Promise.resolve({
      id: 'offline_user',
      email: '',
      name: name,
      photoUrl: null
    })),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../services/sync', () => ({
  SyncService: {
    runSync: jest.fn().mockResolvedValue({ success: true }),
    migrateOfflineData: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../services/notificationService', () => ({
  NotificationService: {
    scheduleDailyReminder: jest.fn().mockResolvedValue(undefined),
    cancelAllReminders: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('Zustand AppStore', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useAppStore.setState({
      activeTab: 'dashboard',
      theme: 'dark',
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
      accounts: [],
      categories: [],
      transactions: [],
      budgets: [],
      goals: [],
      bills: [],
      syncLoading: false,
      lastSyncTime: null,
      autoSyncEnabled: false,
    });
    jest.clearAllMocks();
  });

  it('has correct default initial state values', () => {
    const state = useAppStore.getState();
    expect(state.activeTab).toBe('dashboard');
    expect(state.theme).toBe('dark');
    expect(state.dbInitialized).toBe(false);
    expect(state.appLocked).toBe(false);
    expect(state.currency).toBe('USD');
  });

  it('updates tab when setTab is called', () => {
    useAppStore.getState().setTab('reports');
    expect(useAppStore.getState().activeTab).toBe('reports');
  });

  it('toggles theme when toggleTheme is called', async () => {
    expect(useAppStore.getState().theme).toBe('dark');
    await useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe('light');
    await useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe('dark');
  });

  it('sets showTxModal controls correctly', () => {
    const sampleTx = { id: 'tx_123', amount: 50 };
    useAppStore.getState().setShowTxModal(true, sampleTx);
    expect(useAppStore.getState().showTxModal).toBe(true);
    expect(useAppStore.getState().activeTxToEdit).toEqual(sampleTx);

    useAppStore.getState().setShowTxModal(false);
    expect(useAppStore.getState().showTxModal).toBe(false);
    expect(useAppStore.getState().activeTxToEdit).toBeNull();
  });

  it('initializes app correctly when initApp is called', async () => {
    const mockUser = { id: 'test_user', name: 'John Doe', email: 'john@example.com', photoUrl: null };
    (AuthService.getCurrentUser as jest.Mock).mockResolvedValueOnce(mockUser);
    (UserRepository.getProfile as jest.Mock).mockResolvedValueOnce({
      currency: 'EUR',
      notificationsEnabled: true,
    });

    await useAppStore.getState().initApp();

    expect(initDb).toHaveBeenCalledTimes(1);
    expect(AuthService.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().dbInitialized).toBe(true);
    expect(useAppStore.getState().user).toEqual(mockUser);
    expect(useAppStore.getState().currency).toBe('EUR');
    expect(useAppStore.getState().notificationsEnabled).toBe(true);
  });

  it('performs offline login correctly', async () => {
    const sampleAccounts = [{ id: 'acc_1', name: 'Cash' }];
    (AccountRepository.getAll as jest.Mock).mockResolvedValueOnce(sampleAccounts);

    await useAppStore.getState().loginOffline('Test Guest', 'INR');

    expect(AuthService.signInOffline).toHaveBeenCalledWith('Test Guest');
    expect(UserRepository.upsertProfile).toHaveBeenCalledWith({
      id: 'offline_user',
      googleId: 'offline_user',
      email: 'offline@ezfinance.local',
      displayName: 'Test Guest',
      currency: 'INR',
    });
    expect(useAppStore.getState().user).toEqual({
      id: 'offline_user',
      email: '',
      name: 'Test Guest',
      photoUrl: null,
    });
    expect(useAppStore.getState().currency).toBe('INR');
    expect(useAppStore.getState().accounts).toEqual(sampleAccounts);
  });

  it('resets state correctly on logout', async () => {
    useAppStore.setState({
      user: { id: 'offline_user', name: 'Test', email: '', photoUrl: null },
      accounts: [{ id: '1' }],
    });

    await useAppStore.getState().logout();

    expect(AuthService.signOut).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().user).toBeNull();
    expect(useAppStore.getState().accounts).toEqual([]);
  });
});
