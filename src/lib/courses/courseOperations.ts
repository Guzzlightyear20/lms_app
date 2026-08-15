import type { Course } from '../models/types';

export interface CourseDeps {
  createCourseDoc: (tenantId: string, course: Omit<Course, 'id'>) => Promise<string>;
  updateCourseDoc: (
    tenantId: string,
    courseId: string,
    updates: Partial<Omit<Course, 'id'>>,
  ) => Promise<void>;
  deleteCourseDoc: (tenantId: string, courseId: string) => Promise<void>;
}

export async function createCourse(
  deps: CourseDeps,
  tenantId: string,
  input: { title: string; description: string },
): Promise<{ id: string }> {
  const title = input.title.trim();
  if (!title) {
    throw new Error('El curso necesita un título');
  }
  const id = await deps.createCourseDoc(tenantId, {
    title,
    description: input.description.trim(),
    published: false,
    requiredQuizzes: false,
    minQuizScore: 60,
  });
  return { id };
}

export async function updateCourse(
  deps: CourseDeps,
  tenantId: string,
  courseId: string,
  updates: Partial<Pick<Course, 'title' | 'description' | 'published' | 'requiredQuizzes' | 'minQuizScore'>>,
): Promise<void> {
  await deps.updateCourseDoc(tenantId, courseId, updates);
}

export async function deleteCourse(
  deps: CourseDeps,
  tenantId: string,
  courseId: string,
): Promise<void> {
  await deps.deleteCourseDoc(tenantId, courseId);
}
