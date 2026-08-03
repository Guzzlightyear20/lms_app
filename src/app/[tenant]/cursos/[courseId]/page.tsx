// src/app/[tenant]/cursos/[courseId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { getFirebaseApp } from '@/lib/firebase/client';
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

  useEffect(() => {
    if (authLoading || !user || claims?.role !== 'student' || claims.tenantId !== params.tenant) {
      return;
    }

    async function loadCourseContent() {
      const db = getFirestore(getFirebaseApp());

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
      }

      setDataLoading(false);
    }

    loadCourseContent();
  }, [authLoading, user, claims, params.tenant, params.courseId]);

  async function markComplete(lessonId: string) {
    if (!user) return;
    const db = getFirestore(getFirebaseApp());
    const updated = addCompletedLesson(lessonsCompleted, lessonId);
    await updateDoc(
      doc(db, `tenants/${params.tenant}/students/${user.uid}/progress/${params.courseId}`),
      { lessonsCompleted: updated },
    );
    setLessonsCompleted(updated);
  }

  if (authLoading) {
    return <main>Cargando...</main>;
  }

  if (!user) {
    return (
      <main>
        <p>Tenés que iniciar sesión para ver este curso.</p>
        <a href="/login">Iniciar sesión</a>
      </main>
    );
  }

  if (claims?.role !== 'student' || claims.tenantId !== params.tenant) {
    return <main>No tenés acceso a este curso.</main>;
  }

  if (dataLoading) {
    return <main>Cargando contenido del curso...</main>;
  }

  const selectedLesson = lessons.find((l) => l.id === selectedLessonId) ?? null;

  return (
    <main>
      <aside>
        <ul>
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <button onClick={() => setSelectedLessonId(lesson.id)}>
                {lessonsCompleted.includes(lesson.id) ? '✓ ' : ''}
                {lesson.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        {selectedLesson && (
          <>
            <h1>{selectedLesson.title}</h1>
            {selectedLesson.videoUrl && (
              <video src={selectedLesson.videoUrl} controls style={{ width: '100%' }} />
            )}
            {selectedLesson.textContent && <p>{selectedLesson.textContent}</p>}
            <button onClick={() => markComplete(selectedLesson.id)}>
              Marcar como completada
            </button>
          </>
        )}
      </section>
    </main>
  );
}
