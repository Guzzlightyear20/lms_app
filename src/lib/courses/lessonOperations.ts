import { reorderItems } from './reorderItems';
import type { Lesson } from '../models/types';

export interface LessonDeps {
  createLessonDoc: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    lesson: Omit<Lesson, 'id'>,
  ) => Promise<string>;
  updateLessonDoc: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
    updates: Partial<Omit<Lesson, 'id'>>,
  ) => Promise<void>;
  deleteLessonDoc: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
  ) => Promise<void>;
  writeLessonOrder: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    orderedIds: string[],
  ) => Promise<void>;
}

export async function createLesson(
  deps: LessonDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  input: { title: string; order: number },
): Promise<{ id: string }> {
  const title = input.title.trim();
  if (!title) {
    throw new Error('La lección necesita un título');
  }
  const id = await deps.createLessonDoc(tenantId, courseId, moduleId, {
    title,
    order: input.order,
    videoUrl: null,
    textContent: null,
    attachmentUrls: [],
  });
  return { id };
}

export async function updateLesson(
  deps: LessonDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  updates: Partial<Pick<Lesson, 'title' | 'videoUrl' | 'textContent'>>,
): Promise<void> {
  await deps.updateLessonDoc(tenantId, courseId, moduleId, lessonId, updates);
}

export async function deleteLesson(
  deps: LessonDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
): Promise<void> {
  await deps.deleteLessonDoc(tenantId, courseId, moduleId, lessonId);
}

export async function reorderLessons(
  deps: LessonDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessons: Lesson[],
  fromIndex: number,
  toIndex: number,
): Promise<Lesson[]> {
  const reordered = reorderItems(lessons, fromIndex, toIndex).map((l, index) => ({
    ...l,
    order: index,
  }));
  await deps.writeLessonOrder(
    tenantId,
    courseId,
    moduleId,
    reordered.map((l) => l.id),
  );
  return reordered;
}
