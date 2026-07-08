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

let gisLoaded = false;

const loadGisScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    if (gisLoaded) {
      resolve();
      return;
    }
    if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      gisLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = (err) => {
      reject(err);
    };
    document.body.appendChild(script);
  });
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
   * Google Sign-in on Web using Google Identity Services (GSI/GIS) Token Client
   */
  async signInWeb(): Promise<UserSession> {
    if (typeof window === 'undefined') {
      throw new Error('Google Sign-In is only supported in a browser environment.');
    }

    const client_id = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const redirect_uri = window.location.origin;
    const scope = encodeURIComponent('email profile openid https://www.googleapis.com/auth/drive.appdata');
    const response_type = 'token';
    const prompt = 'consent';

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=${response_type}&scope=${scope}&prompt=${prompt}`;

    window.location.href = authUrl;

    // Return a promise that never resolves as the window is navigating away
    return new Promise(() => {});
  },

  async handleRedirectCallback(accessToken: string): Promise<UserSession> {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch user profile: ${res.statusText}`);
    }

    const data = await res.json();
    const session: UserSession = {
      id: data.sub,
      email: data.email,
      name: data.name || 'User',
      photoUrl: data.picture || null,
    };

    // Persist session locally
    await this.persistSession(session);
    await setSecureItem('googleAccessToken', accessToken);

    return session;
  },

  /**
   * Trigger Google Sign-In flow.
   */
  async signIn(): Promise<UserSession> {
    if (Platform.OS === 'web') {
      return this.signInWeb();
    }

    if (!GoogleSignin) {
      throw new Error('Google Sign-In SDK is not loaded on this native device');
    }

    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const session = this.mapGoogleUser(userInfo);
      
      // Persist session locally
      await this.persistSession(session);

      return session;
    } catch (error: any) {
      console.error('Google Sign-In failed:', error);
      throw error;
    }
  },

  async signInOffline(name: string): Promise<UserSession> {
    const session: UserSession = {
      id: 'offline_user',
      email: '',
      name: name,
      photoUrl: null
    };
    await this.persistSession(session);
    await setSecureItem('googleAccountId', 'offline_user');
    return session;
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
    await deleteSecureItem('googleAccessToken');
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
