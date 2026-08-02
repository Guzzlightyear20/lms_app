// functions/src/progress/computeCompletion.ts
export interface Course {
  id: string;
  title: string;
  description: string;
  published: boolean;
  requiredQuizzes: boolean;
  minQuizScore: number;
}

export interface Progress {
  courseId: string;
  lessonsCompleted: string[];
  quizScores: Record<string, number>;
  certificateUrl: string | null;
}

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
