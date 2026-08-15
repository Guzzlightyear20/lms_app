'use client';

import { useAuth } from '@/lib/auth/AuthProvider';

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const { claims, loading } = useAuth();

  if (loading) {
    return (
      <main className="page-app">
        <div className="page-app-content">
          <p>Cargando...</p>
        </div>
      </main>
    );
  }

  if (claims?.role !== 'owner' && claims?.role !== 'instructor') {
    return (
      <main className="page-app">
        <div className="page-app-content">
          <div className="card">
            <p>No tenés acceso a esta sección.</p>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
