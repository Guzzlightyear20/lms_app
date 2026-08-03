import { describe, it, expect } from 'vitest';
import { addCompletedLesson } from './addCompletedLesson';

describe('addCompletedLesson', () => {
  it('appends a new lesson id to the list', () => {
    expect(addCompletedLesson(['lesson-1'], 'lesson-2')).toEqual(['lesson-1', 'lesson-2']);
  });

  it('does not duplicate an already-completed lesson id', () => {
    expect(addCompletedLesson(['lesson-1', 'lesson-2'], 'lesson-1')).toEqual([
      'lesson-1',
      'lesson-2',
    ]);
  });

  it('returns a new array instance rather than mutating the input', () => {
    const original = ['lesson-1'];
    const result = addCompletedLesson(original, 'lesson-2');
    expect(result).not.toBe(original);
    expect(original).toEqual(['lesson-1']);
  });

  it('works from an empty list', () => {
    expect(addCompletedLesson([], 'lesson-1')).toEqual(['lesson-1']);
  });
});
