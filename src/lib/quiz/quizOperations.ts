import { validateQuizQuestion } from './validateQuizQuestion';
import type { Quiz, QuizQuestion } from '../models/types';

export interface QuizDeps {
  createQuizDoc: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
    quiz: Omit<Quiz, 'id'>,
  ) => Promise<string>;
  updateQuizQuestions: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
    quizId: string,
    questions: QuizQuestion[],
  ) => Promise<void>;
}

export async function createQuiz(
  deps: QuizDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
): Promise<{ id: string }> {
  const id = await deps.createQuizDoc(tenantId, courseId, moduleId, lessonId, {
    lessonId,
    questions: [],
  });
  return { id };
}

export async function addQuestion(
  deps: QuizDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  quizId: string,
  existingQuestions: QuizQuestion[],
  newQuestion: QuizQuestion,
): Promise<QuizQuestion[]> {
  const result = validateQuizQuestion(newQuestion);
  if (!result.valid) {
    throw new Error(result.error);
  }
  const updated = [...existingQuestions, newQuestion];
  await deps.updateQuizQuestions(tenantId, courseId, moduleId, lessonId, quizId, updated);
  return updated;
}

export async function updateQuestion(
  deps: QuizDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  quizId: string,
  existingQuestions: QuizQuestion[],
  index: number,
  updatedQuestion: QuizQuestion,
): Promise<QuizQuestion[]> {
  const result = validateQuizQuestion(updatedQuestion);
  if (!result.valid) {
    throw new Error(result.error);
  }
  const updated = existingQuestions.map((q, i) => (i === index ? updatedQuestion : q));
  await deps.updateQuizQuestions(tenantId, courseId, moduleId, lessonId, quizId, updated);
  return updated;
}

export async function deleteQuestion(
  deps: QuizDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  quizId: string,
  existingQuestions: QuizQuestion[],
  index: number,
): Promise<QuizQuestion[]> {
  const updated = existingQuestions.filter((_, i) => i !== index);
  await deps.updateQuizQuestions(tenantId, courseId, moduleId, lessonId, quizId, updated);
  return updated;
}
