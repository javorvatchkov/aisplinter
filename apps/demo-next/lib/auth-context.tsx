'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextValue {
  sessionToken: string | null;
  userId: string | null;
  email: string | null;
  setSession: (token: string, userId: string, email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const tok = localStorage.getItem('aisplinter_session');
    const uid = localStorage.getItem('aisplinter_user_id');
    const em = localStorage.getItem('aisplinter_email');
    if (tok) setSessionToken(tok);
    if (uid) setUserId(uid);
    if (em) setEmail(em);
    setHydrated(true);
  }, []);

  const setSession = (token: string, userId: string, email: string) => {
    localStorage.setItem('aisplinter_session', token);
    localStorage.setItem('aisplinter_user_id', userId);
    localStorage.setItem('aisplinter_email', email);
    setSessionToken(token);
    setUserId(userId);
    setEmail(email);
  };

  const logout = () => {
    localStorage.removeItem('aisplinter_session');
    localStorage.removeItem('aisplinter_user_id');
    localStorage.removeItem('aisplinter_email');
    setSessionToken(null);
    setUserId(null);
    setEmail(null);
  };

  if (!hydrated) return null;

  return (
    <AuthContext.Provider value={{ sessionToken, userId, email, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
