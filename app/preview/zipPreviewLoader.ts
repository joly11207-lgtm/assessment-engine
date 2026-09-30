import { strFromU8, unzipSync, type UnzipFileInfo } from "fflate";
import { scoreAssessment } from "../../engine/scoring/scorers";
import { validateAssessmentPackage, type AssessmentPackage } from "../../schema/assessmentSchema";
import type { Answers, AssessmentResult } from "../../engine/result/types";

export const previewZipLimits = {
  maxZipBytes: 10 * 1024 * 1024,
  maxFiles: 200,
  maxUncompressedBytes: 20 * 1024 * 1024
} as const;

export interface AcceptanceCase {
  id: string;
  title: string;
  answers: Answers;
  expectedResultId?: string;
}

export interface AcceptanceCaseRun {
  caseData: AcceptanceCase;
  actualResultId?: string;
  passed: boolean;
  result?: AssessmentResult;
  error?: string;
}

export interface PreviewPackageLoadResult {
  acceptanceCases: AcceptanceCase[];
  assessment?: AssessmentPackage;
  designReport?: string;
  errors: string[];
  rawPackage?: unknown;
  schemaStatus: "pass" | "fail";
  warnings: string[];
}

interface ZipEntry {
  path: string;
  data: Uint8Array;
}

export function loadPreviewPackageFromZip(input: Uint8Array, zipSize = input.byteLength): PreviewPackageLoadResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (zipSize > previewZipLimits.maxZipBytes) {
    return fail([`ZIP is too large: ${zipSize} bytes. Maximum is ${previewZipLimits.maxZipBytes} bytes.`]);
  }

  let entries: ZipEntry[];
  const preflight = {
    fileCount: 0,
    totalUncompressedBytes: 0,
    unsafePath: "",
    tooManyFiles: false,
    tooLarge: false
  };
  try {
    entries = Object.entries(
      unzipSync(input, {
        filter: (file) => shouldExtractPreviewFile(file, preflight)
      })
    ).map(([path, data]) => ({ path: normalizeZipPath(path), data }));
  } catch (error) {
    return fail([`Could not unzip package: ${error instanceof Error ? error.message : String(error)}`]);
  }

  if (preflight.tooManyFiles) {
    return fail([`ZIP contains too many files: ${preflight.fileCount}. Maximum is ${previewZipLimits.maxFiles}.`]);
  }
  if (preflight.unsafePath) {
    return fail([`Unsafe ZIP path rejected: ${preflight.unsafePath}`]);
  }
  if (preflight.tooLarge) {
    return fail([
      `ZIP uncompressed content is too large: ${preflight.totalUncompressedBytes} bytes. Maximum is ${previewZipLimits.maxUncompressedBytes}.`
    ]);
  }

  const testJsonEntries = entries.filter((entry) => basename(entry.path) === "test.json");
  if (testJsonEntries.length === 0) {
    return fail(["No test.json found in ZIP."]);
  }
  if (testJsonEntries.length > 1) {
    return fail([`Multiple test.json files found: ${testJsonEntries.map((entry) => entry.path).join(", ")}`]);
  }

  const rawPackage = parseJson(testJsonEntries[0], errors);
  if (rawPackage === undefined) {
    return fail(errors);
  }

  const validation = validateAssessmentPackage(rawPackage);
  const acceptanceCases = loadOptionalAcceptanceCases(entries, warnings, errors);
  const designReport = loadOptionalText(entries, "design-report.md", warnings);

  if (!validation.success) {
    return {
      acceptanceCases,
      designReport,
      errors: [...errors, ...validation.errors],
      rawPackage,
      schemaStatus: "fail",
      warnings
    };
  }

  return {
    acceptanceCases,
    assessment: validation.data,
    designReport,
    errors,
    rawPackage,
    schemaStatus: "pass",
    warnings
  };
}

export function runAcceptanceCase(assessment: AssessmentPackage, caseData: AcceptanceCase): AcceptanceCaseRun {
  try {
    const result = scoreAssessment(assessment, caseData.answers);
    const actualResultId = result.primaryResult?.id;
    return {
      actualResultId,
      caseData,
      passed: Boolean(caseData.expectedResultId && actualResultId === caseData.expectedResultId),
      result
    };
  } catch (error) {
    return {
      caseData,
      error: error instanceof Error ? error.message : String(error),
      passed: false
    };
  }
}

export function runAcceptanceCases(assessment: AssessmentPackage, cases: AcceptanceCase[]) {
  return cases.map((caseData) => runAcceptanceCase(assessment, caseData));
}

export function inferModel(input: AssessmentPackage | unknown): string {
  if (!isRecord(input)) {
    return "unknown";
  }
  const metadataModel = getStringPath(input, ["metadata", "model"]);
  if (metadataModel) {
    return metadataModel;
  }
  if (getBooleanPath(input, ["results", "compatibility", "enabled"])) {
    return "compatibility";
  }
  const strategies = getScoringStrategies(input);
  if (strategies.includes("entity-ranking")) {
    return "entity-ranking";
  }
  if (strategies.includes("profile-match")) {
    return "profile-match";
  }
  return strategies.length > 0 ? strategies.join(" -> ") : "unknown";
}

export function createQuickPreviewResult(
  assessment: AssessmentPackage,
  resultId: string,
  acceptanceCases: AcceptanceCase[] = []
): AssessmentResult {
  const matchingCase = acceptanceCases.find((caseData) => caseData.expectedResultId === resultId);
  if (matchingCase) {
    const run = runAcceptanceCase(assessment, matchingCase);
    if (run.passed && run.result) {
      return run.result;
    }
  }
  return createSyntheticPreviewResult(assessment, resultId);
}

function fail(errors: string[]): PreviewPackageLoadResult {
  return {
    acceptanceCases: [],
    errors,
    schemaStatus: "fail",
    warnings: []
  };
}

function loadOptionalAcceptanceCases(entries: ZipEntry[], warnings: string[], errors: string[]) {
  const matches = entries.filter((entry) => basename(entry.path) === "acceptance-cases.json");
  if (matches.length === 0) {
    return [];
  }
  if (matches.length > 1) {
    warnings.push(`Multiple acceptance-cases.json files found; using ${matches[0].path}.`);
  }
  const parsed = parseJson(matches[0], errors);
  if (parsed === undefined) {
    return [];
  }
  const rawCases = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.cases)
      ? parsed.cases
      : undefined;
  if (!rawCases) {
    errors.push("acceptance-cases.json must be an array or an object with a cases array.");
    return [];
  }
  return rawCases.flatMap((item, index) => normalizeAcceptanceCase(item, index, warnings));
}

function normalizeAcceptanceCase(input: unknown, index: number, warnings: string[]): AcceptanceCase[] {
  if (!isRecord(input) || !isRecord(input.answers)) {
    warnings.push(`Acceptance case ${index + 1} is missing answers and was ignored.`);
    return [];
  }
  const expectedResultId =
    typeof input.expectedPrimary === "string"
      ? input.expectedPrimary
      : typeof input.expectedResultId === "string"
        ? input.expectedResultId
        : isRecord(input.expected) && typeof input.expected.primaryResultId === "string"
          ? input.expected.primaryResultId
          : undefined;
  if (!expectedResultId) {
    warnings.push(`Acceptance case ${index + 1} is missing expectedResultId and was ignored.`);
    return [];
  }
  return [
    {
      id: typeof input.id === "string" ? input.id : `case-${index + 1}`,
      title: typeof input.title === "string" ? input.title : `Case ${index + 1}`,
      answers: Object.fromEntries(Object.entries(input.answers).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      expectedResultId
    }
  ];
}

function loadOptionalText(entries: ZipEntry[], fileName: string, warnings: string[]) {
  const matches = entries.filter((entry) => basename(entry.path).toLowerCase() === fileName);
  if (matches.length === 0) {
    return undefined;
  }
  if (matches.length > 1) {
    warnings.push(`Multiple ${fileName} files found; using ${matches[0].path}.`);
  }
  return strFromU8(matches[0].data);
}

function parseJson(entry: ZipEntry, errors: string[]) {
  try {
    return JSON.parse(strFromU8(entry.data));
  } catch (error) {
    errors.push(`${entry.path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function normalizeZipPath(path: string) {
  return path.replace(/\\/g, "/");
}

function shouldExtractPreviewFile(file: UnzipFileInfo, preflight: {
  fileCount: number;
  totalUncompressedBytes: number;
  unsafePath: string;
  tooManyFiles: boolean;
  tooLarge: boolean;
}) {
  const path = normalizeZipPath(file.name);
  preflight.fileCount += 1;
  preflight.totalUncompressedBytes += file.originalSize;
  if (!isSafeZipPath(path)) {
    preflight.unsafePath ||= path;
    return false;
  }
  if (preflight.fileCount > previewZipLimits.maxFiles) {
    preflight.tooManyFiles = true;
    return false;
  }
  if (preflight.totalUncompressedBytes > previewZipLimits.maxUncompressedBytes) {
    preflight.tooLarge = true;
    return false;
  }
  const name = basename(path).toLowerCase();
  return name === "test.json" || name === "acceptance-cases.json" || name === "design-report.md";
}

function isSafeZipPath(path: string) {
  return !path.startsWith("/") && !/^[a-zA-Z]:\//.test(path) && !path.split("/").some((segment) => segment === "..");
}

function basename(path: string) {
  const parts = path.split("/").filter(Boolean);
  return parts.at(-1) ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function createSyntheticPreviewResult(assessment: AssessmentPackage, resultId: string): AssessmentResult {
  const result = assessment.results.catalog.find((item) => item.id === resultId) ?? assessment.results.catalog[0];
  const targets = findDimensionTargets(assessment, result.id);
  const dimensions = assessment.dimensions.map((dimension) => ({
    id: dimension.id,
    label: dimension.label,
    raw: 0,
    normalized: clampScore(targets[dimension.id] ?? 50)
  }));
  const sortedDimensions = [...dimensions].sort((left, right) => right.normalized - left.normalized);
  return {
    primaryResult: result,
    dimensions,
    rankings: assessment.results.entities.some((entity) => entity.resultId === result.id)
      ? [{ id: result.id, title: result.title, score: 100, rank: 1, summary: result.summary }]
      : [],
    matches: assessment.results.profiles.some((profile) => profile.resultId === result.id)
      ? [{ id: result.id, title: result.title, similarity: 100, rank: 1, summary: result.summary }]
      : [],
    tags: result.tags,
    strengths: sortedDimensions.slice(0, 3).map((dimension) => dimension.label),
    weaknesses: sortedDimensions.slice(-3).reverse().map((dimension) => dimension.label),
    metadata: {
      assessmentId: assessment.metadata.id,
      assessmentVersion: assessment.metadata.version,
      completedAt: new Date().toISOString(),
      scoringStrategies: ["preview"]
    }
  };
}

function findDimensionTargets(assessment: AssessmentPackage, resultId: string): Record<string, number> {
  return (
    assessment.results.profiles.find((profile) => profile.resultId === resultId)?.dimensionTargets ??
    assessment.results.entities.find((entity) => entity.resultId === resultId)?.dimensionTargets ??
    {}
  );
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getScoringStrategies(input: Record<string, unknown>) {
  const pipeline = isRecord(input.scoring) && Array.isArray(input.scoring.pipeline) ? input.scoring.pipeline : [];
  return pipeline.flatMap((step) => (isRecord(step) && typeof step.strategy === "string" ? [step.strategy] : []));
}

function getStringPath(input: Record<string, unknown>, path: string[]) {
  let current: unknown = input;
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return typeof current === "string" ? current : undefined;
}

function getBooleanPath(input: Record<string, unknown>, path: string[]) {
  let current: unknown = input;
  for (const segment of path) {
    if (!isRecord(current)) {
      return false;
    }
    current = current[segment];
  }
  return current === true;
}
