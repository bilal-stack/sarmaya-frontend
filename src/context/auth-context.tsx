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
  logout: () => void;
  isLoading: boolean;
};

const STORAGE_KEY = 'galsi_user_data';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const storedUser = window.localStorage.getItem(STORAGE_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user data from localStorage", error);
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback((userData: UserData) => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
    router.push('/dashboard');
  }, [router]);

  const logout = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    router.push('/login');
  }, [router]);

  const value = useMemo<AuthContextType>(
    () => ({ user, login, logout, isLoading }),
    [user, login, logout, isLoading],
  );

  return (
    <AuthContext.Provider value={value}>
      {isLoading ? null : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
