// src/app/cuenta/page.tsx
'use client';

import { useAuth } from '@/lib/auth/AuthProvider';

export default function CuentaPage() {
  const { claims, loading } = useAuth();

  if (loading) {
    return <main>Cargando...</main>;
  }

  if (claims?.role === 'student') {
    return (
      <main>
        <h1>Ya estás inscripto</h1>
        <p>Pedile el link del curso a quien te inscribió.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Cuenta creada</h1>
      <p>Esperá a que te inscriban en un curso.</p>
    </main>
  );
}
