'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, claims, signOut } = useAuth();

  if (!user || pathname === '/embed' || pathname?.startsWith('/embed/')) {
    return null;
  }

  return (
    <header className="app-header">
      <a href="/" className="logo">
        LMS SaaS
      </a>
      <div className="user-info">
        {(claims?.role === 'owner' || claims?.role === 'instructor') && (
          <a href="/panel/cursos" className="btn btn-secondary">
            Mis cursos
          </a>
        )}
        <span className="user-email">{user.email}</span>
        {claims?.role && <span className="badge">{claims.role}</span>}
        <button
          className="btn btn-secondary"
          onClick={async () => {
            await signOut();
            router.push('/login');
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
