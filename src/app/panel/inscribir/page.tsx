'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFirestore, getFirebaseFunctions } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthProvider';

interface CourseOption {
  id: string;
  title: string;
}

export default function InscribirPage() {
  const { claims } = useAuth();
  const tenantId = claims?.tenantId;
  const [email, setEmail] = useState('');
  const [courseId, setCourseId] = useState('');
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    async function loadCourses() {
      try {
        const db = getFirebaseFirestore();
        const snap = await getDocs(
          query(collection(db, `tenants/${tenantId}/courses`), orderBy('title')),
        );
        setCourses(snap.docs.map((d) => ({ id: d.id, title: d.data().title ?? d.id })));
      } catch (err) {
        setCoursesError(err instanceof Error ? err.message : 'No se pudieron cargar los cursos');
      } finally {
        setCoursesLoading(false);
      }
    }

    loadCourses();
  }, [tenantId]);

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
    <main className="page-app">
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
              <span className="field-label">Curso</span>
              {coursesLoading && <p>Cargando cursos...</p>}
              {coursesError && (
                <p className="alert alert-error" role="alert">
                  {coursesError}
                </p>
              )}
              {!coursesLoading && !coursesError && courses.length === 0 && (
                <p>Todavía no creaste ningún curso.</p>
              )}
              {!coursesLoading && courses.length > 0 && (
                <select
                  className="input"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Elegí un curso
                  </option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={status === 'submitting' || !courseId}
            >
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
    </main>
  );
}
