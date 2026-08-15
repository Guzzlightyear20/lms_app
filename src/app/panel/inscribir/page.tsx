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
    <div className="page-app">
      <div className="page-app-content">
        <div className="card">
          <h1>Inscribir alumno</h1>
          <form onSubmit={handleSubmit}>
            <label className="field">
              <span className="field-label">Email del alumno</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">ID del curso</span>
              <input
                className="input"
                type="text"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Inscribiendo...' : 'Inscribir'}
            </button>
          </form>
          {message && (
            <p
              className={`alert ${status === 'error' ? 'alert-error' : 'alert-info'}`}
              role="status"
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
