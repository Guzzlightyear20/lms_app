// src/app/cuenta/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthProvider';

interface EnrolledCourse {
  id: string;
  title: string;
}

export default function CuentaPage() {
  const { user, claims, loading, refreshClaims } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || claims?.role !== 'student' || !claims.tenantId) {
      return;
    }

    async function loadEnrolledCourses() {
      try {
        const db = getFirebaseFirestore();
        const progressSnap = await getDocs(
          collection(db, `tenants/${claims!.tenantId}/students/${user!.uid}/progress`),
        );

        const loaded: EnrolledCourse[] = [];
        for (const progressDoc of progressSnap.docs) {
          const courseSnap = await getDoc(
            doc(db, `tenants/${claims!.tenantId}/courses/${progressDoc.id}`),
          );
          if (courseSnap.exists()) {
            loaded.push({ id: progressDoc.id, title: courseSnap.data().title ?? progressDoc.id });
          }
        }
        setCourses(loaded);
      } catch (err) {
        setCoursesError(err instanceof Error ? err.message : 'No se pudieron cargar tus cursos');
      } finally {
        setCoursesLoading(false);
      }
    }

    loadEnrolledCourses();
  }, [loading, user, claims]);

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
      <main className="page-app">
        <div className="page-app-content">
          <p>Cargando...</p>
        </div>
      </main>
    );
  }

  if (claims?.role === 'student') {
    return (
      <main className="page-app">
        <div className="page-app-content">
          <div className="card">
            <h1>Tus cursos</h1>
            {coursesLoading && <p>Cargando cursos...</p>}
            {coursesError && (
              <p className="alert alert-error" role="alert">
                {coursesError}
              </p>
            )}
            {!coursesLoading && !coursesError && courses.length === 0 && (
              <p>Todavía no estás inscripto en ningún curso.</p>
            )}
            {!coursesLoading && courses.length > 0 && (
              <ul className="course-list">
                {courses.map((course) => (
                  <li key={course.id} className="course-card">
                    <a href={`/${claims.tenantId}/cursos/${course.id}`}>{course.title}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-app">
      <div className="page-app-content">
        <div className="card">
          <h1>Cuenta creada</h1>
          <p>Esperá a que te inscriban en un curso.</p>
          <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Actualizando...' : 'Ya me inscribieron — actualizar'}
          </button>
        </div>
      </div>
    </main>
  );
}
