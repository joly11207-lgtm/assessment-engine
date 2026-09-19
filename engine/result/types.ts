import type { AssessmentPackage } from "../../schema/assessmentSchema";

export interface ResultReference {
  id: string;
  title: string;
  summary: string;
}

export interface DimensionScore {
  id: string;
  label: string;
  raw: number;
  normalized: number;
}

export interface RankedResult {
  id: string;
  title: string;
  score: number;
  rank: number;
  summary?: string;
}

export interface MatchResult {
  id: string;
  title: string;
  similarity: number;
  rank: number;
  summary?: string;
}

export interface ResultMetadata {
  assessmentId: string;
  assessmentVersion: string;
  completedAt: string;
  scoringStrategies: string[];
}

export interface AssessmentResult {
  primaryResult?: ResultReference;
  secondaryResult?: ResultReference;
  dimensions: DimensionScore[];
  rankings: RankedResult[];
  matches: MatchResult[];
  tags: string[];
  strengths: string[];
  weaknesses: string[];
  metadata: ResultMetadata;
}

export type Answers = Record<string, string>;

export interface ScoringContext {
  assessment: AssessmentPackage;
  answers: Answers;
  result: AssessmentResult;
}
