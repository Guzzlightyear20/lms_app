// src/app/cuenta/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function CuentaPage() {
  const { claims, loading, signOut, refreshClaims } = useAuth();
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
    return <main>Cargando...</main>;
  }

  if (claims?.role === 'student') {
    return (
      <main>
        <h1>Ya estás inscripto</h1>
        <button onClick={() => signOut()}>Cerrar sesión</button>
        <p>Pedile el link del curso a quien te inscribió.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Cuenta creada</h1>
      <button onClick={() => signOut()}>Cerrar sesión</button>
      <p>Esperá a que te inscriban en un curso.</p>
      <button onClick={handleRefresh} disabled={refreshing}>
        {refreshing ? 'Actualizando...' : 'Ya me inscribieron — actualizar'}
      </button>
    </main>
  );
}
