import { describe, it, expect, vi } from 'vitest';
import { createCourse, updateCourse, deleteCourse, type CourseDeps } from './courseOperations';

function makeDeps(overrides: Partial<CourseDeps> = {}): CourseDeps {
  return {
    createCourseDoc: vi.fn().mockResolvedValue('course-1'),
    updateCourseDoc: vi.fn().mockResolvedValue(undefined),
    deleteCourseDoc: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('createCourse', () => {
  it('rejects an empty title without calling createCourseDoc', async () => {
    const deps = makeDeps();
    await expect(createCourse(deps, 'tenant-a', { title: '  ', description: '' })).rejects.toThrow(
      'El curso necesita un título',
    );
    expect(deps.createCourseDoc).not.toHaveBeenCalled();
  });

  it('creates a course with trimmed title and sensible defaults', async () => {
    const deps = makeDeps();
    const result = await createCourse(deps, 'tenant-a', {
      title: '  Ecommerce 101  ',
      description: 'Intro',
    });
    expect(deps.createCourseDoc).toHaveBeenCalledWith('tenant-a', {
      title: 'Ecommerce 101',
      description: 'Intro',
      published: false,
      requiredQuizzes: false,
      minQuizScore: 60,
    });
    expect(result).toEqual({ id: 'course-1' });
  });
});

describe('updateCourse', () => {
  it('passes updates through to updateCourseDoc', async () => {
    const deps = makeDeps();
    await updateCourse(deps, 'tenant-a', 'course-1', { published: true });
    expect(deps.updateCourseDoc).toHaveBeenCalledWith('tenant-a', 'course-1', { published: true });
  });
});

describe('deleteCourse', () => {
  it('passes through to deleteCourseDoc', async () => {
    const deps = makeDeps();
    await deleteCourse(deps, 'tenant-a', 'course-1');
    expect(deps.deleteCourseDoc).toHaveBeenCalledWith('tenant-a', 'course-1');
  });
});
