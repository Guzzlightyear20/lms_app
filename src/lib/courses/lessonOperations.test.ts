import { describe, it, expect, vi } from 'vitest';
import {
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  type LessonDeps,
} from './lessonOperations';
import type { Lesson } from '../models/types';

function makeDeps(overrides: Partial<LessonDeps> = {}): LessonDeps {
  return {
    createLessonDoc: vi.fn().mockResolvedValue('lesson-1'),
    updateLessonDoc: vi.fn().mockResolvedValue(undefined),
    deleteLessonDoc: vi.fn().mockResolvedValue(undefined),
    writeLessonOrder: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('createLesson', () => {
  it('rejects an empty title', async () => {
    const deps = makeDeps();
    await expect(
      createLesson(deps, 'tenant-a', 'course-1', 'module-1', { title: '  ', order: 0 }),
    ).rejects.toThrow('La lección necesita un título');
    expect(deps.createLessonDoc).not.toHaveBeenCalled();
  });

  it('creates a lesson with trimmed title and empty content defaults', async () => {
    const deps = makeDeps();
    const result = await createLesson(deps, 'tenant-a', 'course-1', 'module-1', {
      title: ' Lección 1 ',
      order: 1,
    });
    expect(deps.createLessonDoc).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1', {
      title: 'Lección 1',
      order: 1,
      videoUrl: null,
      textContent: null,
      attachmentUrls: [],
    });
    expect(result).toEqual({ id: 'lesson-1' });
  });
});

describe('updateLesson', () => {
  it('passes through to updateLessonDoc', async () => {
    const deps = makeDeps();
    await updateLesson(deps, 'tenant-a', 'course-1', 'module-1', 'lesson-1', { textContent: 'Hola' });
    expect(deps.updateLessonDoc).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1', 'lesson-1', {
      textContent: 'Hola',
    });
  });
});

describe('deleteLesson', () => {
  it('passes through to deleteLessonDoc', async () => {
    const deps = makeDeps();
    await deleteLesson(deps, 'tenant-a', 'course-1', 'module-1', 'lesson-1');
    expect(deps.deleteLessonDoc).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1', 'lesson-1');
  });
});

describe('reorderLessons', () => {
  const lessons: Lesson[] = [
    { id: 'l1', title: 'Uno', order: 0, videoUrl: null, textContent: null, attachmentUrls: [] },
    { id: 'l2', title: 'Dos', order: 1, videoUrl: null, textContent: null, attachmentUrls: [] },
  ];

  it('reorders and writes the new id order', async () => {
    const deps = makeDeps();
    const result = await reorderLessons(deps, 'tenant-a', 'course-1', 'module-1', lessons, 0, 1);
    expect(result.map((l) => l.id)).toEqual(['l2', 'l1']);
    expect(deps.writeLessonOrder).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1', ['l2', 'l1']);
  });
});
