import type { AssessmentPackage } from "../../schema/assessmentSchema";
import type { Answers } from "../result/types";

export interface RunnerSession {
  assessmentId: string;
  assessmentVersion: string;
  currentIndex: number;
  answers: Answers;
  startedAt: string;
  updatedAt: string;
}

export class InvalidSubmissionError extends Error {
  constructor(public readonly validationErrors: string[]) {
    super(`Invalid assessment submission: ${validationErrors.join("; ")}`);
    this.name = "InvalidSubmissionError";
  }
}

export function createRunnerSession(assessment: AssessmentPackage): RunnerSession {
  return {
    assessmentId: assessment.metadata.id,
    assessmentVersion: assessment.metadata.version,
    currentIndex: 0,
    answers: {},
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function answerQuestion(session: RunnerSession, questionId: string, optionId: string): RunnerSession {
  return touch({
    ...session,
    answers: {
      ...session.answers,
      [questionId]: optionId
    }
  });
}

export function previousQuestion(session: RunnerSession): RunnerSession {
  return touch({
    ...session,
    currentIndex: Math.max(0, session.currentIndex - 1)
  });
}

export function nextQuestion(assessment: AssessmentPackage, session: RunnerSession): RunnerSession {
  if (!canProceed(assessment, session)) {
    return session;
  }
  return touch({
    ...session,
    currentIndex: Math.min(assessment.questions.length - 1, session.currentIndex + 1)
  });
}

export function canProceed(assessment: AssessmentPackage, session: RunnerSession): boolean {
  const question = assessment.questions[session.currentIndex];
  if (!question || !question.required) {
    return true;
  }
  return Boolean(session.answers[question.id]);
}

export function isComplete(assessment: AssessmentPackage, session: RunnerSession): boolean {
  return assessment.questions.every((question) => !question.required || Boolean(session.answers[question.id]));
}

export function validateSubmission(assessment: AssessmentPackage, answers: Answers): string[] {
  const errors: string[] = [];
  const questionsById = new Map(assessment.questions.map((question) => [question.id, question]));

  Object.entries(answers).forEach(([questionId, optionId]) => {
    const question = questionsById.get(questionId);
    if (!question) {
      errors.push(`unknown question "${questionId}"`);
      return;
    }
    if (!question.options.some((option) => option.id === optionId)) {
      errors.push(`unknown option "${optionId}" for question "${questionId}"`);
    }
  });

  assessment.questions.forEach((question) => {
    if (question.required && !answers[question.id]) {
      errors.push(`required question "${question.id}" is unanswered`);
    }
  });

  return errors;
}

export function assertValidSubmission(assessment: AssessmentPackage, answers: Answers): void {
  const errors = validateSubmission(assessment, answers);
  if (errors.length > 0) {
    throw new InvalidSubmissionError(errors);
  }
}

export function progressPercent(assessment: AssessmentPackage, session: RunnerSession): number {
  return Math.round(((session.currentIndex + 1) / assessment.questions.length) * 100);
}

function touch(session: RunnerSession): RunnerSession {
  return {
    ...session,
    updatedAt: new Date().toISOString()
  };
}
