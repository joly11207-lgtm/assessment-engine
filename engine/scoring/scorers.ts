import type { AssessmentPackage, ScoringStep } from "../../schema/assessmentSchema";
import type { ScoringStrategyId } from "../capabilities";
import { assertValidSubmission } from "../runner/runner";
import type { Answers, AssessmentResult, DimensionScore, ResultReference, ScoringContext } from "../result/types";

type Scorer = (context: ScoringContext, step: ScoringStep) => ScoringContext;

export const scorers = {
  "weighted-dimension": weightedDimensionScorer,
  normalize: normalizeScorer,
  "profile-match": profileMatchScorer,
  "entity-ranking": entityRankingScorer
} satisfies Record<ScoringStrategyId, Scorer>;

export function scoreAssessment(assessment: AssessmentPackage, answers: Answers): AssessmentResult {
  assertValidSubmission(assessment, answers);
  const result = createEmptyResult(assessment);
  const finalContext = assessment.scoring.pipeline.reduce<ScoringContext>((context, step) => {
    const scorer = scorers[step.strategy];
    if (!scorer) {
      throw new Error(`Unsupported scoring strategy "${step.strategy}"`);
    }
    return scorer(context, step);
  }, { assessment, answers, result });

  return finalizeResult(finalContext.result);
}

function createEmptyResult(assessment: AssessmentPackage): AssessmentResult {
  return {
    dimensions: assessment.dimensions.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
      raw: 0,
      normalized: 0
    })),
    rankings: [],
    matches: [],
    tags: [],
    strengths: [],
    weaknesses: [],
    metadata: {
      assessmentId: assessment.metadata.id,
      assessmentVersion: assessment.metadata.version,
      completedAt: new Date().toISOString(),
      scoringStrategies: assessment.scoring.pipeline.map((step) => step.strategy)
    }
  };
}

function weightedDimensionScorer(context: ScoringContext): ScoringContext {
  const dimensionScores = new Map(context.result.dimensions.map((dimension) => [dimension.id, { ...dimension }]));

  context.assessment.questions.forEach((question) => {
    const answerId = context.answers[question.id];
    if (!answerId) {
      return;
    }
    const selectedOption = question.options.find((option) => option.id === answerId);
    if (!selectedOption) {
      return;
    }
    Object.entries(selectedOption.weights).forEach(([dimensionId, delta]) => {
      const existing = dimensionScores.get(dimensionId);
      if (existing) {
        existing.raw += delta;
      }
    });
  });

  return {
    ...context,
    result: {
      ...context.result,
      dimensions: Array.from(dimensionScores.values())
    }
  };
}

function normalizeScorer(context: ScoringContext): ScoringContext {
  const byId = new Map(context.assessment.dimensions.map((dimension) => [dimension.id, dimension]));
  return {
    ...context,
    result: {
      ...context.result,
      dimensions: context.result.dimensions.map((dimension) => {
        const definition = byId.get(dimension.id);
        if (!definition) {
          return dimension;
        }
        const normalized = ((dimension.raw - definition.min) / (definition.max - definition.min)) * 100;
        return {
          ...dimension,
          normalized: roundScore(clamp(normalized, 0, 100))
        };
      })
    }
  };
}

function profileMatchScorer(context: ScoringContext, step: ScoringStep): ScoringContext {
  const catalog = resultCatalog(context.assessment);
  const userProfile = normalizedDimensionMap(context.result.dimensions);
  const matches = context.assessment.results.profiles
    .map((profile) => {
      const result = catalog.get(profile.resultId);
      return {
        id: profile.resultId,
        title: result?.title ?? profile.resultId,
        summary: result?.summary,
        similarity: similarity(userProfile, profile.dimensionTargets),
        rank: 0
      };
    })
    .sort((left, right) => right.similarity - left.similarity)
    .map((match, index) => ({ ...match, similarity: roundScore(match.similarity), rank: index + 1 }))
    .slice(0, step.topN ?? context.assessment.results.profiles.length);

  const primary = matches[0] ? toResultReference(context.assessment, matches[0].id) : undefined;
  const secondary = matches[1] ? toResultReference(context.assessment, matches[1].id) : undefined;
  const tags = primary ? catalog.get(primary.id)?.tags ?? [] : [];

  return {
    ...context,
    result: {
      ...context.result,
      primaryResult: primary,
      secondaryResult: secondary,
      matches,
      tags: unique([...context.result.tags, ...tags])
    }
  };
}

function entityRankingScorer(context: ScoringContext, step: ScoringStep): ScoringContext {
  const catalog = resultCatalog(context.assessment);
  const userProfile = normalizedDimensionMap(context.result.dimensions);
  const rankings = context.assessment.results.entities
    .map((entity) => {
      const result = catalog.get(entity.resultId);
      return {
        id: entity.resultId,
        title: result?.title ?? entity.resultId,
        summary: result?.summary,
        score: similarity(userProfile, entity.dimensionTargets),
        rank: 0
      };
    })
    .sort((left, right) => right.score - left.score)
    .map((ranking, index) => ({ ...ranking, score: roundScore(ranking.score), rank: index + 1 }))
    .slice(0, step.topN ?? context.assessment.results.entities.length);

  return {
    ...context,
    result: {
      ...context.result,
      rankings,
      primaryResult: rankings[0] ? toResultReference(context.assessment, rankings[0].id) : context.result.primaryResult
    }
  };
}

function finalizeResult(result: AssessmentResult): AssessmentResult {
  const sorted = [...result.dimensions].sort((left, right) => right.normalized - left.normalized);
  return {
    ...result,
    strengths: sorted.slice(0, 3).map((dimension) => dimension.label),
    weaknesses: sorted.slice(-3).reverse().map((dimension) => dimension.label)
  };
}

function resultCatalog(assessment: AssessmentPackage) {
  return new Map(assessment.results.catalog.map((result) => [result.id, result]));
}

function toResultReference(assessment: AssessmentPackage, resultId: string): ResultReference | undefined {
  const result = assessment.results.catalog.find((item) => item.id === resultId);
  if (!result) {
    return undefined;
  }
  return {
    id: result.id,
    title: result.title,
    summary: result.summary
  };
}

function normalizedDimensionMap(dimensions: DimensionScore[]) {
  return Object.fromEntries(dimensions.map((dimension) => [dimension.id, dimension.normalized]));
}

function similarity(userProfile: Record<string, number>, targetProfile: Record<string, number>) {
  const dimensionIds = Object.keys(targetProfile);
  if (dimensionIds.length === 0) {
    return 0;
  }
  const meanDistance =
    dimensionIds.reduce((sum, dimensionId) => {
      const userValue = userProfile[dimensionId] ?? 0;
      const targetValue = targetProfile[dimensionId];
      return sum + Math.abs(userValue - targetValue);
    }, 0) / dimensionIds.length;
  return clamp(100 - meanDistance, 0, 100);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
