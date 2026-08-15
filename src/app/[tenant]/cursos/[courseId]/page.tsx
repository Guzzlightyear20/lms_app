// src/app/[tenant]/cursos/[courseId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { addCompletedLesson } from '@/lib/progress/addCompletedLesson';
import type { Lesson } from '@/lib/models/types';

interface LessonWithModule extends Lesson {
  moduleId: string;
}

export default function CursoPage({
  params,
}: {
  params: { tenant: string; courseId: string };
}) {
  const { user, claims, loading: authLoading } = useAuth();
  const [lessons, setLessons] = useState<LessonWithModule[]>([]);
  const [lessonsCompleted, setLessonsCompleted] = useState<string[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    if (authLoading || !user || claims?.role !== 'student' || claims.tenantId !== params.tenant) {
      return;
    }

    async function loadCourseContent() {
      try {
        const db = getFirebaseFirestore();

        const modulesSnap = await getDocs(
          query(
            collection(db, `tenants/${params.tenant}/courses/${params.courseId}/modules`),
            orderBy('order'),
          ),
        );

        const allLessons: LessonWithModule[] = [];
        for (const moduleDoc of modulesSnap.docs) {
          const lessonsSnap = await getDocs(
            query(
              collection(
                db,
                `tenants/${params.tenant}/courses/${params.courseId}/modules/${moduleDoc.id}/lessons`,
              ),
              orderBy('order'),
            ),
          );
          lessonsSnap.forEach((lessonDoc) => {
            const data = lessonDoc.data();
            allLessons.push({
              id: lessonDoc.id,
              moduleId: moduleDoc.id,
              title: data.title,
              order: data.order,
              videoUrl: data.videoUrl ?? null,
              textContent: data.textContent ?? null,
              attachmentUrls: data.attachmentUrls ?? [],
            });
          });
        }
        setLessons(allLessons);
        if (allLessons.length > 0) {
          setSelectedLessonId(allLessons[0].id);
        }

        const progressSnap = await getDoc(
          doc(db, `tenants/${params.tenant}/students/${user!.uid}/progress/${params.courseId}`),
        );
        if (progressSnap.exists()) {
          setLessonsCompleted(progressSnap.data().lessonsCompleted ?? []);
          setIsEnrolled(true);
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el curso');
      } finally {
        setDataLoading(false);
      }
    }

    loadCourseContent();
  }, [authLoading, user, claims, params.tenant, params.courseId]);

  async function markComplete(lessonId: string) {
    if (!user || !isEnrolled) return;
    const db = getFirebaseFirestore();
    const updated = addCompletedLesson(lessonsCompleted, lessonId);
    setActionError(null);
    try {
      await updateDoc(
        doc(db, `tenants/${params.tenant}/students/${user.uid}/progress/${params.courseId}`),
        { lessonsCompleted: updated },
      );
      setLessonsCompleted(updated);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo marcar la lección como completada',
      );
    }
  }

  if (authLoading) {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <div className="card">
            <p>Tenés que iniciar sesión para ver este curso.</p>
            <a href="/login" className="btn btn-primary" style={{ marginTop: 12 }}>
              Iniciar sesión
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (claims?.role !== 'student' || claims.tenantId !== params.tenant) {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <div className="card">
            <p>No tenés acceso a este curso.</p>
          </div>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <p>Cargando contenido del curso...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <div className="card">
            <p className="alert alert-error" role="alert">
              Error al cargar el curso: {loadError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectedLesson = lessons.find((l) => l.id === selectedLessonId) ?? null;

  return (
    <div className="page-app">
      <div className="lesson-layout">
        <aside className="card">
          <ul className="lesson-sidebar-list">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <button
                  className={lesson.id === selectedLessonId ? 'active' : ''}
                  onClick={() => setSelectedLessonId(lesson.id)}
                >
                  {lessonsCompleted.includes(lesson.id) ? '✓ ' : ''}
                  {lesson.title}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="card">
          {selectedLesson && (
            <>
              <h1>{selectedLesson.title}</h1>
              {selectedLesson.videoUrl && (
                <video src={selectedLesson.videoUrl} controls style={{ width: '100%' }} />
              )}
              {selectedLesson.textContent && <p>{selectedLesson.textContent}</p>}
              {isEnrolled ? (
                <>
                  <button className="btn btn-primary" onClick={() => markComplete(selectedLesson.id)}>
                    Marcar como completada
                  </button>
                  {actionError && (
                    <p className="alert alert-error" role="alert">
                      {actionError}
                    </p>
                  )}
                </>
              ) : (
                <p>No estás inscripto en este curso.</p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
