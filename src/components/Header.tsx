'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';

export function Header() {
  const pathname = usePathname();
  const { user, claims, signOut } = useAuth();

  if (!user || pathname?.startsWith('/embed')) {
    return null;
  }

  return (
    <header className="app-header">
      <a href="/" className="logo">
        LMS SaaS
      </a>
      <div className="user-info">
        <span>{user.email}</span>
        {claims?.role && <span className="badge">{claims.role}</span>}
        <button className="btn btn-secondary" onClick={() => signOut()}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
