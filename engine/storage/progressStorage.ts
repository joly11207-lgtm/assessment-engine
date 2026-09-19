import { z } from "zod";
import type { AssessmentPackage } from "../../schema/assessmentSchema";
import type { RunnerSession } from "../runner/runner";

const RunnerSessionSchema = z
  .object({
    assessmentId: z.string().min(1),
    assessmentVersion: z.string().min(1),
    currentIndex: z.number().int().nonnegative(),
    answers: z.record(z.string().min(1)),
    startedAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .strict();

export function progressStorageKey(testId: string, testVersion: string) {
  return `assessment:${testId}:${testVersion}:progress`;
}

export function loadProgress(assessment: AssessmentPackage): RunnerSession | undefined {
  if (!hasLocalStorage()) {
    return undefined;
  }
  const key = progressStorageKey(assessment.metadata.id, assessment.metadata.version);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return undefined;
    }
    const result = RunnerSessionSchema.safeParse(JSON.parse(raw));
    if (!result.success || !isCompatibleSession(assessment, result.data)) {
      discardProgress(key);
      return undefined;
    }
    return result.data;
  } catch {
    discardProgress(key);
    return undefined;
  }
}

export function saveProgress(session: RunnerSession) {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    localStorage.setItem(progressStorageKey(session.assessmentId, session.assessmentVersion), JSON.stringify(session));
  } catch {
    // In-memory runner state remains authoritative when persistence is unavailable.
  }
}

export function clearProgress(assessment: AssessmentPackage) {
  if (!hasLocalStorage()) {
    return;
  }
  discardProgress(progressStorageKey(assessment.metadata.id, assessment.metadata.version));
}

function hasLocalStorage() {
  return typeof localStorage !== "undefined";
}

function isCompatibleSession(assessment: AssessmentPackage, session: RunnerSession): boolean {
  if (session.assessmentId !== assessment.metadata.id || session.assessmentVersion !== assessment.metadata.version) {
    return false;
  }
  if (session.currentIndex >= assessment.questions.length) {
    return false;
  }

  const questionsById = new Map(assessment.questions.map((question) => [question.id, question]));
  return Object.entries(session.answers).every(([questionId, optionId]) => {
    const question = questionsById.get(questionId);
    return Boolean(question?.options.some((option) => option.id === optionId));
  });
}

function discardProgress(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable even when the global exists.
  }
}
