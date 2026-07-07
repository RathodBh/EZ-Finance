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
    await loadGisScript();

    return new Promise((resolve, reject) => {
      try {
        if (!(window as any).google || !(window as any).google.accounts) {
          throw new Error('Google Identity Services library failed to load');
        }

        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
          scope: 'email profile openid https://www.googleapis.com/auth/drive.appdata',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              reject(tokenResponse);
              return;
            }
            if (tokenResponse.access_token) {
              try {
                // Fetch user profile using access token
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
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
                await setSecureItem('googleAccessToken', tokenResponse.access_token);

                // Sync user profile with local DB
                await UserRepository.upsertProfile({
                  id: session.id,
                  googleId: session.id,
                  email: session.email,
                  displayName: session.name,
                  photoUrl: session.photoUrl || undefined,
                });

                resolve(session);
              } catch (err) {
                reject(err);
              }
            } else {
              reject(new Error('Access token not returned from Google login'));
            }
          },
        });

        client.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        reject(err);
      }
    });
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
