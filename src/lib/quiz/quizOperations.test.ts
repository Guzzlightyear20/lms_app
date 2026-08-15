import { describe, it, expect, vi } from 'vitest';
import {
  createQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  type QuizDeps,
} from './quizOperations';
import type { QuizQuestion } from '../models/types';

function makeDeps(overrides: Partial<QuizDeps> = {}): QuizDeps {
  return {
    createQuizDoc: vi.fn().mockResolvedValue('quiz-1'),
    updateQuizQuestions: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const validQuestion: QuizQuestion = {
  text: '¿Cuál es la capital de Francia?',
  options: ['Madrid', 'París'],
  correctOptionIndex: 1,
};

describe('createQuiz', () => {
  it('creates an empty quiz', async () => {
    const deps = makeDeps();
    const result = await createQuiz(deps, 'tenant-a', 'course-1', 'module-1', 'lesson-1');
    expect(deps.createQuizDoc).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1', 'lesson-1', {
      lessonId: 'lesson-1',
      questions: [],
    });
    expect(result).toEqual({ id: 'quiz-1' });
  });
});

describe('addQuestion', () => {
  it('rejects an invalid question without writing', async () => {
    const deps = makeDeps();
    const invalid: QuizQuestion = { text: '', options: ['a'], correctOptionIndex: 0 };
    await expect(
      addQuestion(deps, 'tenant-a', 'course-1', 'module-1', 'lesson-1', 'quiz-1', [], invalid),
    ).rejects.toThrow();
    expect(deps.updateQuizQuestions).not.toHaveBeenCalled();
  });

  it('appends a valid question and writes the full list', async () => {
    const deps = makeDeps();
    const result = await addQuestion(
      deps,
      'tenant-a',
      'course-1',
      'module-1',
      'lesson-1',
      'quiz-1',
      [],
      validQuestion,
    );
    expect(result).toEqual([validQuestion]);
    expect(deps.updateQuizQuestions).toHaveBeenCalledWith(
      'tenant-a',
      'course-1',
      'module-1',
      'lesson-1',
      'quiz-1',
      [validQuestion],
    );
  });
});

describe('updateQuestion', () => {
  it('replaces the question at the given index', async () => {
    const deps = makeDeps();
    const second: QuizQuestion = { text: 'Otra', options: ['x', 'y'], correctOptionIndex: 0 };
    const result = await updateQuestion(
      deps,
      'tenant-a',
      'course-1',
      'module-1',
      'lesson-1',
      'quiz-1',
      [validQuestion],
      0,
      second,
    );
    expect(result).toEqual([second]);
  });
});

describe('deleteQuestion', () => {
  it('removes the question at the given index', async () => {
    const deps = makeDeps();
    const result = await deleteQuestion(
      deps,
      'tenant-a',
      'course-1',
      'module-1',
      'lesson-1',
      'quiz-1',
      [validQuestion],
      0,
    );
    expect(result).toEqual([]);
    expect(deps.updateQuizQuestions).toHaveBeenCalledWith(
      'tenant-a',
      'course-1',
      'module-1',
      'lesson-1',
      'quiz-1',
      [],
    );
  });
});
