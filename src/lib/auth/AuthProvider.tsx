'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  claims: null,
  loading: true,
  signOut: async () => {},
  refreshClaims: async () => {},
});

function parseClaims(rawClaims: Record<string, unknown>): AuthClaims {
  return {
    tenantId: typeof rawClaims.tenantId === 'string' ? rawClaims.tenantId : undefined,
    role: typeof rawClaims.role === 'string' ? (rawClaims.role as AuthClaims['role']) : undefined,
  };
}

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
        setClaims(parseClaims(tokenResult.claims));
      } else {
        setClaims(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signOut = useCallback(async () => {
    const auth = getAuth(getFirebaseApp());
    await firebaseSignOut(auth);
  }, []);

  const refreshClaims = useCallback(async () => {
    const auth = getAuth(getFirebaseApp());
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }
    const tokenResult = await currentUser.getIdTokenResult(true);
    setClaims(parseClaims(tokenResult.claims));
  }, []);

  const value = useMemo(
    () => ({ user, claims, loading, signOut, refreshClaims }),
    [user, claims, loading, signOut, refreshClaims],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
