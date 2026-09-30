import { z } from "zod";
import type { AssessmentPackage } from "../../schema/assessmentSchema";
import type { Answers, AssessmentResult } from "../result/types";

const ResultReferenceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    summary: z.string()
  })
  .strict();

const DimensionScoreSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    raw: z.number(),
    normalized: z.number()
  })
  .strict();

const RankedResultSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    score: z.number(),
    rank: z.number().int().positive(),
    summary: z.string().optional()
  })
  .strict();

const MatchResultSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    similarity: z.number(),
    rank: z.number().int().positive(),
    summary: z.string().optional()
  })
  .strict();

const AssessmentResultSchema = z
  .object({
    primaryResult: ResultReferenceSchema.optional(),
    secondaryResult: ResultReferenceSchema.optional(),
    dimensions: z.array(DimensionScoreSchema),
    rankings: z.array(RankedResultSchema),
    matches: z.array(MatchResultSchema),
    tags: z.array(z.string()),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    metadata: z
      .object({
        assessmentId: z.string().min(1),
        assessmentVersion: z.string().min(1),
        completedAt: z.string().datetime(),
        scoringStrategies: z.array(z.string().min(1))
      })
      .strict()
  })
  .strict();

const CompletedResultRecordSchema = z
  .object({
    answers: z.record(z.string().min(1)),
    result: AssessmentResultSchema,
    completedAt: z.string().datetime(),
    testVersion: z.string().min(1)
  })
  .strict();

export interface CompletedResultRecord {
  answers: Answers;
  result: AssessmentResult;
  completedAt: string;
  testVersion: string;
}

export function completedResultStorageKey(testId: string) {
  return `assessment:${testId}:completed`;
}

export function loadCompletedResult(assessment: AssessmentPackage): CompletedResultRecord | undefined {
  if (!hasLocalStorage()) {
    return undefined;
  }
  const key = completedResultStorageKey(assessment.metadata.id);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return undefined;
    }
    const parsed = CompletedResultRecordSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || !isCompatibleCompletedResult(assessment, parsed.data)) {
      discardCompletedResult(key);
      return undefined;
    }
    return parsed.data;
  } catch {
    discardCompletedResult(key);
    return undefined;
  }
}

export function saveCompletedResult(assessment: AssessmentPackage, answers: Answers, result: AssessmentResult) {
  if (!hasLocalStorage()) {
    return;
  }
  const completedAt = result.metadata.completedAt;
  const record: CompletedResultRecord = {
    answers,
    result,
    completedAt,
    testVersion: assessment.metadata.version
  };
  try {
    localStorage.setItem(completedResultStorageKey(assessment.metadata.id), JSON.stringify(record));
  } catch {
    // Completed-result persistence is optional; the in-memory result remains usable.
  }
}

export function clearCompletedResult(assessment: AssessmentPackage) {
  if (!hasLocalStorage()) {
    return;
  }
  discardCompletedResult(completedResultStorageKey(assessment.metadata.id));
}

function hasLocalStorage() {
  return typeof localStorage !== "undefined";
}

function isCompatibleCompletedResult(assessment: AssessmentPackage, record: CompletedResultRecord): boolean {
  if (record.testVersion !== assessment.metadata.version) {
    return false;
  }
  if (
    record.result.metadata.assessmentId !== assessment.metadata.id ||
    record.result.metadata.assessmentVersion !== assessment.metadata.version
  ) {
    return false;
  }
  if (record.result.primaryResult && !assessment.results.catalog.some((result) => result.id === record.result.primaryResult?.id)) {
    return false;
  }

  const questionsById = new Map(assessment.questions.map((question) => [question.id, question]));
  return Object.entries(record.answers).every(([questionId, optionId]) => {
    const question = questionsById.get(questionId);
    return Boolean(question?.options.some((option) => option.id === optionId));
  });
}

function discardCompletedResult(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable even when the global exists.
  }
}
