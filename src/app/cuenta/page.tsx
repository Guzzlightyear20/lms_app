// src/app/cuenta/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function CuentaPage() {
  const { claims, loading, refreshClaims } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshClaims();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (claims?.role === 'student') {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <div className="card">
            <h1>Ya estás inscripto</h1>
            <p>Pedile el link del curso a quien te inscribió.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-app">
      <div className="page-app-content">
        <div className="card">
          <h1>Cuenta creada</h1>
          <p>Esperá a que te inscriban en un curso.</p>
          <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Actualizando...' : 'Ya me inscribieron — actualizar'}
          </button>
        </div>
      </div>
    </div>
  );
}
