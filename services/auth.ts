import * as SecureStore from 'expo-secure-store';
import { UserRepository } from '../db/repositories';
import { Platform } from 'react-native';

let GoogleSignin: any = null;

// Only load native Google Sign-in on iOS / Android platforms
if (Platform.OS !== 'web') {
  try {
    const googleAuthModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = googleAuthModule.GoogleSignin;
    GoogleSignin.configure({
      scopes: ['https://www.googleapis.com/auth/drive.appdata'],
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
  } catch (e) {
    console.warn('Google Sign-In module loading failed on native platform:', e);
  }
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  photoUrl: string | null;
}

// Helper to store tokens depending on platform
const setSecureItem = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } else {
    await SecureStore.setItemAsync(key, value);
  }
};

const getSecureItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  } else {
    return await SecureStore.getItemAsync(key);
  }
};

const deleteSecureItem = async (key: string) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  } else {
    await SecureStore.deleteItemAsync(key);
  }
};

export const AuthService = {
  /**
   * Check if a user session is active.
   */
  async isSignedIn(): Promise<boolean> {
    const hasToken = await getSecureItem('googleAccountId');
    if (hasToken) return true;
    
    if (Platform.OS === 'web' || !GoogleSignin) {
      return false;
    }

    try {
      return await GoogleSignin.isSignedIn();
    } catch {
      return false;
    }
  },

  /**
   * Retrieve current signed-in user's details.
   */
  async getCurrentUser(): Promise<UserSession | null> {
    try {
      const storedUser = await getSecureItem('userSession');
      if (storedUser) {
        return JSON.parse(storedUser);
      }

      if (Platform.OS === 'web' || !GoogleSignin) {
        return null;
      }

      const googleUser = await GoogleSignin.getCurrentUser();
      if (googleUser) {
        const session = this.mapGoogleUser(googleUser);
        await this.persistSession(session);
        return session;
      }
    } catch (e) {
      console.error('Error fetching current user:', e);
    }
    return null;
  },

  /**
   * Trigger Google Sign-In flow.
   */
  async signIn(): Promise<UserSession> {
    if (Platform.OS === 'web' || !GoogleSignin) {
      console.log('Redirecting to developer Mock sign-in (Web environment/sandbox)...');
      return this.mockSignIn();
    }

    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const session = this.mapGoogleUser(userInfo);
      
      // Persist session locally
      await this.persistSession(session);

      // Sync user profile with local DB
      await UserRepository.upsertProfile({
        id: session.id,
        googleId: session.id,
        email: session.email,
        displayName: session.name,
        photoUrl: session.photoUrl || undefined,
      });

      return session;
    } catch (error: any) {
      console.error('Google Sign-In failed:', error);
      throw error;
    }
  },

  /**
   * Triggers developer mock sign-in for testing purposes.
   * Useful when Google API setup on the local build is pending.
   */
  async mockSignIn(): Promise<UserSession> {
    const mockSession = {
      id: 'mock_user_123',
      email: 'financeflow-developer@example.com',
      name: 'FinanceFlow Dev User',
      photoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
    };
    await this.persistSession(mockSession);
    await UserRepository.upsertProfile({
      id: mockSession.id,
      googleId: mockSession.id,
      email: mockSession.email,
      displayName: mockSession.name,
      photoUrl: mockSession.photoUrl,
    });
    return mockSession;
  },

  /**
   * Sign out and clear stored session.
   */
  async signOut(): Promise<void> {
    if (Platform.OS !== 'web' && GoogleSignin) {
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        console.warn('Google Sign-Out call skipped/failed:', e);
      }
    }
    await deleteSecureItem('googleAccountId');
    await deleteSecureItem('userSession');
  },

  mapGoogleUser(googleUser: any): UserSession {
    return {
      id: googleUser.user.id,
      email: googleUser.user.email,
      name: googleUser.user.name || 'User',
      photoUrl: googleUser.user.photo || null,
    };
  },

  async persistSession(session: UserSession) {
    await setSecureItem('googleAccountId', session.id);
    await setSecureItem('userSession', JSON.stringify(session));
  },
};
