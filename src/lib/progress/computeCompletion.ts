import type { Course, Progress } from '../models/types';

export function isCourseComplete(
  course: Course,
  progress: Progress,
  totalLessonIds: string[],
): boolean {
  const allLessonsDone = totalLessonIds.every((id) =>
    progress.lessonsCompleted.includes(id),
  );
  if (!allLessonsDone) {
    return false;
  }

  if (!course.requiredQuizzes) {
    return true;
  }

  const scores = Object.values(progress.quizScores);
  if (scores.length === 0) {
    return false;
  }

  return scores.every((score) => score >= course.minQuizScore);
}
