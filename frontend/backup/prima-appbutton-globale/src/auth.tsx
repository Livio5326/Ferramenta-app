import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { api, AuthUser, eliminaAuthToken, leggiAuthToken, sessioneAccessoValidaOggi } from './api';

import { useAppStore } from './store';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const setMode = useAppStore((state) => state.setMode);

  const refreshUser = useCallback(async () => {
    const token = await leggiAuthToken();
    const sessioneValidaOggi = await sessioneAccessoValidaOggi();

    if (!token || !sessioneValidaOggi) {
      await eliminaAuthToken();
      setUser(null);
      setMode('cliente');
      setLoading(false);
      return;
    }

    try {
      const currentUser = await api.getCurrentUser();

      setUser(currentUser);
      setMode('gestore');
    } catch {
      await eliminaAuthToken();

      setUser(null);
      setMode('cliente');
    } finally {
      setLoading(false);
    }
  }, [setMode]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, password: string) => {
    const response = await api.login(username, password);

    setUser(response.user);
    setMode('gestore');
  };

  const logout = async () => {
    await api.logout();

    setUser(null);
    setMode('cliente');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve essere usato dentro AuthProvider');
  }

  return context;
}
