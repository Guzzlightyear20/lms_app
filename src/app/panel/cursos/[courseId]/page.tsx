// src/app/panel/cursos/[courseId]/page.tsx
'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { courseConverter } from '@/lib/models/courseConverters';
import { updateCourse, type CourseDeps } from '@/lib/courses/courseOperations';
import {
  createModule,
  deleteModule,
  reorderModules,
  type ModuleDeps,
} from '@/lib/courses/moduleOperations';
import {
  createLesson,
  deleteLesson,
  reorderLessons,
  type LessonDeps,
} from '@/lib/courses/lessonOperations';
import type { Course, Module, Lesson } from '@/lib/models/types';

interface ModuleWithLessons extends Module {
  lessons: Lesson[];
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export default function CourseEditorPage({ params }: { params: { courseId: string } }) {
  const { claims } = useAuth();
  const tenantId = claims?.tenantId;
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newLessonTitles, setNewLessonTitles] = useState<Record<string, string>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!tenantId) return;
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function loadCourse() {
    if (!tenantId) return;
    const db = getFirebaseFirestore();
    const courseSnap = await getDoc(
      doc(db, `tenants/${tenantId}/courses/${params.courseId}`).withConverter(courseConverter),
    );
    if (courseSnap.exists()) {
      setCourse(courseSnap.data());
    }

    const modulesSnap = await getDocs(
      query(collection(db, `tenants/${tenantId}/courses/${params.courseId}/modules`), orderBy('order')),
    );
    const loadedModules: ModuleWithLessons[] = [];
    for (const moduleDoc of modulesSnap.docs) {
      const data = moduleDoc.data();
      const lessonsSnap = await getDocs(
        query(
          collection(
            db,
            `tenants/${tenantId}/courses/${params.courseId}/modules/${moduleDoc.id}/lessons`,
          ),
          orderBy('order'),
        ),
      );
      const lessons: Lesson[] = lessonsSnap.docs.map((lessonDoc) => {
        const lessonData = lessonDoc.data();
        return {
          id: lessonDoc.id,
          title: lessonData.title,
          order: lessonData.order,
          videoUrl: lessonData.videoUrl ?? null,
          textContent: lessonData.textContent ?? null,
          attachmentUrls: lessonData.attachmentUrls ?? [],
        };
      });
      loadedModules.push({ id: moduleDoc.id, title: data.title, order: data.order, lessons });
    }
    setModules(loadedModules);
    setLoading(false);
  }

  function moduleDeps(): ModuleDeps {
    const db = getFirebaseFirestore();
    return {
      createModuleDoc: async (tId, courseId, moduleData) => {
        const ref = doc(collection(db, `tenants/${tId}/courses/${courseId}/modules`));
        await setDoc(ref, moduleData);
        return ref.id;
      },
      updateModuleDoc: async () => {},
      deleteModuleDoc: async (tId, courseId, moduleId) => {
        await deleteDoc(doc(db, `tenants/${tId}/courses/${courseId}/modules/${moduleId}`));
      },
      writeModuleOrder: async (tId, courseId, orderedIds) => {
        const batch = writeBatch(db);
        orderedIds.forEach((id, index) => {
          batch.update(doc(db, `tenants/${tId}/courses/${courseId}/modules/${id}`), { order: index });
        });
        await batch.commit();
      },
    };
  }

  function lessonDeps(): LessonDeps {
    const db = getFirebaseFirestore();
    return {
      createLessonDoc: async (tId, courseId, moduleId, lessonData) => {
        const ref = doc(
          collection(db, `tenants/${tId}/courses/${courseId}/modules/${moduleId}/lessons`),
        );
        await setDoc(ref, lessonData);
        return ref.id;
      },
      updateLessonDoc: async () => {},
      deleteLessonDoc: async (tId, courseId, moduleId, lessonId) => {
        await deleteDoc(
          doc(db, `tenants/${tId}/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`),
        );
      },
      writeLessonOrder: async (tId, courseId, moduleId, orderedIds) => {
        const batch = writeBatch(db);
        orderedIds.forEach((id, index) => {
          batch.update(
            doc(db, `tenants/${tId}/courses/${courseId}/modules/${moduleId}/lessons/${id}`),
            { order: index },
          );
        });
        await batch.commit();
      },
    };
  }

  async function handleAddModule(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !newModuleTitle.trim()) return;
    const { id } = await createModule(moduleDeps(), tenantId, params.courseId, {
      title: newModuleTitle,
      order: modules.length,
    });
    setModules([...modules, { id, title: newModuleTitle.trim(), order: modules.length, lessons: [] }]);
    setNewModuleTitle('');
  }

  async function handleDeleteModule(moduleId: string) {
    if (!tenantId) return;
    await deleteModule(moduleDeps(), tenantId, params.courseId, moduleId);
    setModules(modules.filter((m) => m.id !== moduleId));
  }

  async function handleModuleDragEnd(event: DragEndEvent) {
    if (!tenantId) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = modules.findIndex((m) => m.id === active.id);
    const toIndex = modules.findIndex((m) => m.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const reordered = await reorderModules(
      moduleDeps(),
      tenantId,
      params.courseId,
      modules,
      fromIndex,
      toIndex,
    );
    setModules(reordered as ModuleWithLessons[]);
  }

  async function handleAddLesson(moduleId: string) {
    if (!tenantId) return;
    const title = newLessonTitles[moduleId];
    if (!title || !title.trim()) return;
    const targetModule = modules.find((m) => m.id === moduleId);
    if (!targetModule) return;
    const { id } = await createLesson(lessonDeps(), tenantId, params.courseId, moduleId, {
      title,
      order: targetModule.lessons.length,
    });
    setModules(
      modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              lessons: [
                ...m.lessons,
                {
                  id,
                  title: title.trim(),
                  order: m.lessons.length,
                  videoUrl: null,
                  textContent: null,
                  attachmentUrls: [],
                },
              ],
            }
          : m,
      ),
    );
    setNewLessonTitles({ ...newLessonTitles, [moduleId]: '' });
  }

  async function handleDeleteLesson(moduleId: string, lessonId: string) {
    if (!tenantId) return;
    await deleteLesson(lessonDeps(), tenantId, params.courseId, moduleId, lessonId);
    setModules(
      modules.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m,
      ),
    );
  }

  async function handleLessonDragEnd(moduleId: string, event: DragEndEvent) {
    if (!tenantId) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const targetModule = modules.find((m) => m.id === moduleId);
    if (!targetModule) return;
    const fromIndex = targetModule.lessons.findIndex((l) => l.id === active.id);
    const toIndex = targetModule.lessons.findIndex((l) => l.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const reordered = await reorderLessons(
      lessonDeps(),
      tenantId,
      params.courseId,
      moduleId,
      targetModule.lessons,
      fromIndex,
      toIndex,
    );
    setModules(modules.map((m) => (m.id === moduleId ? { ...m, lessons: reordered } : m)));
  }

  async function handleSaveCourseMeta(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !course) return;
    const deps: CourseDeps = {
      createCourseDoc: async () => '',
      updateCourseDoc: async (tId, courseId, updates) => {
        const db = getFirebaseFirestore();
        await setDoc(doc(db, `tenants/${tId}/courses/${courseId}`), updates, { merge: true });
      },
      deleteCourseDoc: async () => {},
    };
    await updateCourse(deps, tenantId, params.courseId, {
      title: course.title,
      description: course.description,
      published: course.published,
    });
  }

  if (loading || !course) {
    return (
      <main className="page-app">
        <div className="page-app-content">
          <p>Cargando...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-app">
      <div className="page-app-content">
        <div className="card">
          <h1>Editar curso</h1>
          <form onSubmit={handleSaveCourseMeta}>
            <label className="field">
              <span className="field-label">Título</span>
              <input
                className="input"
                value={course.title}
                onChange={(e) => setCourse({ ...course, title: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Descripción</span>
              <input
                className="input"
                value={course.description}
                onChange={(e) => setCourse({ ...course, description: e.target.value })}
              />
            </label>
            <label className="field">
              <input
                type="checkbox"
                checked={course.published}
                onChange={(e) => setCourse({ ...course, published: e.target.checked })}
              />{' '}
              Publicado
            </label>
            <button type="submit" className="btn btn-primary">
              Guardar
            </button>
          </form>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            {modules.map((moduleItem) => (
              <div key={moduleItem.id} className="card" style={{ marginTop: 16 }}>
                <SortableRow id={moduleItem.id}>
                  <h3 style={{ cursor: 'grab' }}>{moduleItem.title}</h3>
                </SortableRow>
                <button className="btn btn-secondary" onClick={() => handleDeleteModule(moduleItem.id)}>
                  Borrar módulo
                </button>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => handleLessonDragEnd(moduleItem.id, event)}
                >
                  <SortableContext
                    items={moduleItem.lessons.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="lesson-sidebar-list">
                      {moduleItem.lessons.map((lesson) => (
                        <SortableRow key={lesson.id} id={lesson.id}>
                          <li style={{ display: 'flex', justifyContent: 'space-between', cursor: 'grab' }}>
                            <a
                              href={`/panel/cursos/${params.courseId}/lecciones/${lesson.id}?moduleId=${moduleItem.id}`}
                            >
                              {lesson.title}
                            </a>
                            <button
                              className="btn btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLesson(moduleItem.id, lesson.id);
                              }}
                            >
                              Borrar
                            </button>
                          </li>
                        </SortableRow>
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddLesson(moduleItem.id);
                  }}
                >
                  <input
                    className="input"
                    placeholder="Título de la lección"
                    value={newLessonTitles[moduleItem.id] ?? ''}
                    onChange={(e) =>
                      setNewLessonTitles({ ...newLessonTitles, [moduleItem.id]: e.target.value })
                    }
                  />
                  <button type="submit" className="btn btn-secondary">
                    + Lección
                  </button>
                </form>
              </div>
            ))}
          </SortableContext>
        </DndContext>

        <div className="card" style={{ marginTop: 16 }}>
          <form onSubmit={handleAddModule}>
            <input
              className="input"
              placeholder="Título del módulo"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              + Módulo
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
