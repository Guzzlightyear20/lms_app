'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { createCourse } from '@/lib/courses/courseOperations';
import { courseConverter } from '@/lib/models/courseConverters';
import type { Course } from '@/lib/models/types';

export default function CursosPage() {
  const { claims } = useAuth();
  const tenantId = claims?.tenantId;
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    async function loadCourses() {
      try {
        const db = getFirebaseFirestore();
        const coursesRef = collection(db, `tenants/${tenantId}/courses`).withConverter(courseConverter);
        const snapshot = await getDocs(query(coursesRef, orderBy('title')));
        setCourses(snapshot.docs.map((d) => d.data()));
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar los cursos');
      } finally {
        setLoading(false);
      }
    }

    loadCourses();
  }, [tenantId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!tenantId) return;
    setError(null);
    setSubmitting(true);
    try {
      const db = getFirebaseFirestore();
      const { id } = await createCourse(
        {
          createCourseDoc: async (tId, course) => {
            const ref = doc(collection(db, `tenants/${tId}/courses`));
            await setDoc(ref, course);
            return ref.id;
          },
          updateCourseDoc: async () => {},
          deleteCourseDoc: async () => {},
        },
        tenantId,
        { title, description },
      );
      window.location.href = `/panel/cursos/${id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el curso');
      setSubmitting(false);
    }
  }

  return (
    <main className="page-app">
      <div className="page-app-content">
        <div className="card">
          <h1>Mis cursos</h1>
          {loading ? (
            <p>Cargando...</p>
          ) : loadError ? (
            <p className="alert alert-error" role="alert">
              {loadError}
            </p>
          ) : (
            <ul className="course-list">
              {courses.map((course) => (
                <li key={course.id} className="course-card">
                  <a href={`/panel/cursos/${course.id}`}>{course.title}</a>
                  <p>{course.published ? 'Publicado' : 'Borrador'}</p>
                </li>
              ))}
            </ul>
          )}
          {!loading && !loadError && courses.length === 0 && <p>Todavía no creaste ningún curso.</p>}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h2>Crear curso</h2>
          <form onSubmit={handleCreate}>
            <label className="field">
              <span className="field-label">Título</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label className="field">
              <span className="field-label">Descripción</span>
              <input
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            {error && (
              <p className="alert alert-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creando...' : 'Crear curso'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
