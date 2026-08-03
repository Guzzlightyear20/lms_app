'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getAuth, onIdTokenChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase/client';

export interface AuthClaims {
  tenantId?: string;
  role?: 'owner' | 'instructor' | 'student';
}

interface AuthContextValue {
  user: User | null;
  claims: AuthClaims | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  claims: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<AuthClaims | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const unsubscribe = onIdTokenChanged(auth, async (nextUser) => {
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

  async function signOut() {
    const auth = getAuth(getFirebaseApp());
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, claims, loading, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
