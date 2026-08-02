'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase/client';

export interface AuthClaims {
  tenantId?: string;
  role?: 'owner' | 'instructor' | 'student';
}

interface AuthContextValue {
  user: User | null;
  claims: AuthClaims | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, claims: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<AuthClaims | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const tokenResult = await nextUser.getIdTokenResult();
        setClaims({
          tenantId:
            typeof tokenResult.claims.tenantId === 'string' ? tokenResult.claims.tenantId : undefined,
          role:
            typeof tokenResult.claims.role === 'string'
              ? (tokenResult.claims.role as AuthClaims['role'])
              : undefined,
        });
      } else {
        setClaims(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={{ user, claims, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
