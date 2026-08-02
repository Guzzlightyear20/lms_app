export interface Course {
  id: string;
  title: string;
  description: string;
  published: boolean;
  requiredQuizzes: boolean;
  minQuizScore: number; // percentage, 0-100
}

export interface Module {
  id: string;
  title: string;
  order: number;
}

export interface Lesson {
  id: string;
  title: string;
  order: number;
  videoUrl: string | null;
  textContent: string | null;
  attachmentUrls: string[];
}

export interface QuizQuestion {
  text: string;
  options: string[];
  correctOptionIndex: number;
}

export interface Quiz {
  id: string;
  lessonId: string;
  questions: QuizQuestion[];
}

export interface Progress {
  courseId: string;
  lessonsCompleted: string[];
  quizScores: Record<string, number>;
  certificateUrl: string | null;
}
