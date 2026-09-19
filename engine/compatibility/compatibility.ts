import type { AssessmentPackage } from "../../schema/assessmentSchema";
import type { ResultReference } from "../result/types";

export interface CompatibilityDimensionScore {
  id: string;
  label: string;
  score: number;
}

export interface CompatibilityResult {
  status: "resolved";
  mode: "symmetric" | "directional";
  pairId: string;
  sourceResult: ResultReference;
  targetResult: ResultReference;
  overallScore: number;
  dimensions: CompatibilityDimensionScore[];
  strengths: string[];
  frictionPoints: string[];
  summary: string;
  advice?: string;
  metadata: {
    assessmentId: string;
    assessmentVersion: string;
    reversed: boolean;
    resolvedAt: string;
  };
}

export interface MissingCompatibilityResult {
  status: "missing";
  reason: "disabled" | "unknown-source" | "unknown-target" | "missing-pair";
  sourceResult?: ResultReference;
  targetResult?: ResultReference;
  metadata: {
    assessmentId: string;
    assessmentVersion: string;
    resolvedAt: string;
  };
}

export type CompatibilityResolution = CompatibilityResult | MissingCompatibilityResult;

export function hasCompatibility(assessment: AssessmentPackage) {
  return assessment.results.compatibility.enabled && assessment.results.compatibilityPairs.length > 0;
}

export function getCompatibilityResultOptions(assessment: AssessmentPackage) {
  return assessment.results.catalog.map((result) => ({
    id: result.id,
    title: result.title,
    summary: result.summary
  }));
}

export function isValidResultIdParam(value: string | null | undefined) {
  return Boolean(value && /^[a-zA-Z0-9-_]+$/.test(value));
}

export function resolveCompatibility(
  assessment: AssessmentPackage,
  sourceResultId: string | undefined,
  targetResultId: string | undefined
): CompatibilityResolution {
  const metadata = {
    assessmentId: assessment.metadata.id,
    assessmentVersion: assessment.metadata.version,
    resolvedAt: new Date().toISOString()
  };

  if (!hasCompatibility(assessment)) {
    return { status: "missing", reason: "disabled", metadata };
  }

  const sourceResult = sourceResultId ? toResultReference(assessment, sourceResultId) : undefined;
  const targetResult = targetResultId ? toResultReference(assessment, targetResultId) : undefined;

  if (!sourceResult) {
    return { status: "missing", reason: "unknown-source", targetResult, metadata };
  }
  if (!targetResult) {
    return { status: "missing", reason: "unknown-target", sourceResult, metadata };
  }

  const directPair = assessment.results.compatibilityPairs.find(
    (pair) => pair.resultAId === sourceResult.id && pair.resultBId === targetResult.id
  );
  const reversedPair = assessment.results.compatibilityPairs.find((pair) => {
    return (
      assessment.results.compatibility.mode === "symmetric" &&
      pair.resultAId === targetResult.id &&
      pair.resultBId === sourceResult.id
    );
  });
  const pair = directPair ?? reversedPair;

  if (!pair) {
    return { status: "missing", reason: "missing-pair", sourceResult, targetResult, metadata };
  }

  const mode = assessment.results.compatibility.mode;
  const dimensionLabels = new Map(assessment.results.compatibility.dimensions.map((dimension) => [dimension.id, dimension.label]));
  const dimensions = Object.entries(pair.scores)
    .filter(([id]) => id !== "overall")
    .map(([id, score]) => ({
      id,
      label: dimensionLabels.get(id) ?? id,
      score
    }));

  return {
    status: "resolved",
    mode,
    pairId: pair.id,
    sourceResult,
    targetResult,
    overallScore: pair.scores.overall,
    dimensions,
    strengths: pair.strengths,
    frictionPoints: pair.frictionPoints,
    summary: pair.summary ?? pair.relationshipCopy ?? "",
    advice: pair.advice,
    metadata: {
      ...metadata,
      reversed: Boolean(reversedPair && !directPair)
    }
  };
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
