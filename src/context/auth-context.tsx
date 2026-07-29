'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

type UserData = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  access_token: string;
  token_type: string;
  // Optional fields that may not always be present
  is_social_login?: boolean;
  client_id?: string | null;
  organization_name?: string | null;
  industry?: string | null;
  goals?: string | null;
  last_login_at?: string | null;
  profile_setup_completed?: boolean;
  created_at?: string;
  updated_at?: string;
  refresh_token?: string;
  expires_in?: number;
};

type AuthContextType = {
  user: UserData | null;
  login: (userData: UserData) => void;
  /**
   * Patch the stored session in place, without navigating.
   *
   * Needed because `login` always redirects to the dashboard: changing your
   * password mints a fresh token (the old one is deliberately revoked), and
   * that token has to replace the stored one silently or the user is bounced
   * to the login screen straight after succeeding.
   */
  updateUser: (patch: Partial<UserData>) => void;
  logout: () => void;
  isLoading: boolean;
};

const STORAGE_KEY = 'sarmaya_user_data';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to check if token is expired
const isTokenExpired = (expiresIn?: number, lastLoginTime?: string): boolean => {
  if (!expiresIn || !lastLoginTime) return false;

  const loginTimestamp = new Date(lastLoginTime).getTime();
  const expirationTime = loginTimestamp + expiresIn * 1000; // Convert seconds to milliseconds
  const currentTime = Date.now();

  return currentTime >= expirationTime;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = () => {
      try {
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
          const parsedUser = JSON.parse(storedData) as UserData;

          // Check if token is expired
          if (isTokenExpired(parsedUser.expires_in, parsedUser.last_login_at)) {
            console.log('Token expired, clearing user data');
            localStorage.removeItem(STORAGE_KEY);
            setUser(null);
          } else {
            setUser(parsedUser);
          }
        }
      } catch (error) {
        console.error('Error loading user from localStorage:', error);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Check token expiration periodically (every minute)
  useEffect(() => {
    if (!user) return;

    const checkTokenExpiration = () => {
      if (isTokenExpired(user.expires_in, user.last_login_at)) {
        console.log('Token expired during session, logging out');
        logout();
      }
    };

    // Check immediately
    checkTokenExpiration();

    // Check every minute
    const interval = setInterval(checkTokenExpiration, 60000);

    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback(
    (userData: UserData) => {
      // Add last login timestamp if not present
      const userDataWithTimestamp = {
        ...userData,
        last_login_at: userData.last_login_at || new Date().toISOString(),
      };

      setUser(userDataWithTimestamp);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userDataWithTimestamp));
      router.push('/dashboard');
    },
    [router],
  );

  const updateUser = useCallback((patch: Partial<UserData>) => {
    setUser((previous) => {
      if (!previous) return previous;
      const next = { ...previous, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    router.push('/login');
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      login,
      updateUser,
      logout,
      isLoading,
    }),
    [user, login, updateUser, logout, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
