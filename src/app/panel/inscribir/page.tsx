'use client';

import { useState, type FormEvent } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase/client';

export default function InscribirPage() {
  const [email, setEmail] = useState('');
  const [courseId, setCourseId] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('submitting');
    setMessage(null);
    try {
      const functions = getFirebaseFunctions();
      const enrollStudent = httpsCallable(functions, 'enrollStudent');
      await enrollStudent({ email, courseId });
      setStatus('done');
      setMessage('Alumno inscripto correctamente.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'No se pudo inscribir al alumno');
    }
  }

  return (
    <main>
      <h1>Inscribir alumno</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email del alumno
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          ID del curso
          <input type="text" value={courseId} onChange={(e) => setCourseId(e.target.value)} required />
        </label>
        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Inscribiendo...' : 'Inscribir'}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </main>
  );
}
