import { create } from "zustand";
import type { StoreApi } from "zustand";
import { createRunnerSession, answerQuestion, nextQuestion, previousQuestion, type RunnerSession } from "../engine/runner/runner";
import { scoreAssessment } from "../engine/scoring/scorers";
import { clearProgress, loadProgress, saveProgress } from "../engine/storage/progressStorage";
import type { AssessmentResult } from "../engine/result/types";
import type { AssessmentPackage } from "../schema/assessmentSchema";

interface AssessmentStore {
  sessions: Record<string, RunnerSession>;
  results: Record<string, AssessmentResult>;
  startAssessment: (assessment: AssessmentPackage) => RunnerSession;
  answer: (assessment: AssessmentPackage, questionId: string, optionId: string) => void;
  previous: (assessment: AssessmentPackage) => void;
  next: (assessment: AssessmentPackage) => void;
  submit: (assessment: AssessmentPackage) => AssessmentResult;
  restartAssessment: (assessment: AssessmentPackage) => RunnerSession;
}

export const useAssessmentStore = create<AssessmentStore>((set, get) => ({
  sessions: {},
  results: {},
  startAssessment: (assessment) => {
    const key = sessionKey(assessment);
    const existing = get().sessions[key];
    if (existing) {
      return existing;
    }
    const session = loadProgress(assessment) ?? createRunnerSession(assessment);
    set((state) => ({ sessions: { ...state.sessions, [key]: session } }));
    saveProgress(session);
    return session;
  },
  answer: (assessment, questionId, optionId) => {
    updateSession(assessment, (session) => answerQuestion(session, questionId, optionId), set, get);
  },
  previous: (assessment) => {
    updateSession(assessment, previousQuestion, set, get);
  },
  next: (assessment) => {
    updateSession(assessment, (session) => nextQuestion(assessment, session), set, get);
  },
  submit: (assessment) => {
    const key = sessionKey(assessment);
    const session = get().sessions[key] ?? loadProgress(assessment) ?? createRunnerSession(assessment);
    const result = scoreAssessment(assessment, session.answers);
    clearProgress(assessment);
    set((state) => ({
      sessions: { ...state.sessions, [key]: session },
      results: { ...state.results, [key]: result }
    }));
    return result;
  },
  restartAssessment: (assessment) => {
    const key = sessionKey(assessment);
    const session = createRunnerSession(assessment);
    clearProgress(assessment);
    saveProgress(session);
    set((state) => {
      const { [key]: _removedResult, ...remainingResults } = state.results;
      return {
        sessions: { ...state.sessions, [key]: session },
        results: remainingResults
      };
    });
    return session;
  }
}));

export function sessionKey(assessment: AssessmentPackage) {
  return `${assessment.metadata.id}:${assessment.metadata.version}`;
}

function updateSession(
  assessment: AssessmentPackage,
  updater: (session: RunnerSession) => RunnerSession,
  set: StoreApi<AssessmentStore>["setState"],
  get: StoreApi<AssessmentStore>["getState"]
) {
  const key = sessionKey(assessment);
  const current = get().sessions[key] ?? loadProgress(assessment) ?? createRunnerSession(assessment);
  const next = updater(current);
  saveProgress(next);
  set((state) => ({ sessions: { ...state.sessions, [key]: next } }));
}
