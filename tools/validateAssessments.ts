import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAssessmentPackage } from "../schema/assessmentSchema";
import {
  defaultTestsRoot,
  generateAssessmentRegistry,
  loadTestPackages,
  type DiscoveredTestPackage
} from "./generateAssessmentRegistry";

export function validateDiscoveredPackages(
  packages: readonly DiscoveredTestPackage[],
  log: (message: string) => void = console.log
): boolean {
  let hasFailure = false;
  const ids = new Set<string>();

  packages.forEach(({ source, packageData }) => {
    const result = validateAssessmentPackage(packageData);
    if (result.success) {
      if (ids.has(result.data.metadata.id)) {
        hasFailure = true;
        log(`FAIL ${source}`);
        log(`duplicate assessment ID "${result.data.metadata.id}"`);
        return;
      }
      ids.add(result.data.metadata.id);
      log(`PASS ${result.data.metadata.id}`);
      const compatibilityReport = describeCompatibilityCoverage(result.data);
      if (compatibilityReport) {
        log(compatibilityReport);
      }
      return;
    }
    hasFailure = true;
    log(`FAIL ${source}`);
    result.errors.forEach(log);
  });

  return !hasFailure;
}

function describeCompatibilityCoverage(assessment: import("../schema/assessmentSchema").AssessmentPackage) {
  if (!assessment.results.compatibility.enabled) {
    return undefined;
  }
  const resultCount = assessment.results.catalog.length;
  const mode = assessment.results.compatibility.mode;
  const expected =
    mode === "symmetric" ? (resultCount * (resultCount + 1)) / 2 : resultCount * resultCount;
  const defined = assessment.results.compatibilityPairs.length;
  const coverage = expected > 0 ? Math.round((defined / expected) * 100) : 0;
  const partial = assessment.results.compatibility.allowPartialCoverage ? "partial allowed" : "complete expected";
  return `  Compatibility: Results ${resultCount}, Possible ${mode} pairs ${expected}, Defined ${defined}, Coverage ${coverage}% (${partial})`;
}

export async function validateAndGenerate(testsRoot = defaultTestsRoot): Promise<boolean> {
  const packages = await loadTestPackages(testsRoot);
  const isValid = validateDiscoveredPackages(packages);
  if (isValid && testsRoot === defaultTestsRoot) {
    await generateAssessmentRegistry(packages);
  }
  return isValid;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const rootArgumentIndex = process.argv.indexOf("--tests-root");
  const testsRoot = rootArgumentIndex >= 0 ? resolve(process.argv[rootArgumentIndex + 1] ?? "") : defaultTestsRoot;
  if (!(await validateAndGenerate(testsRoot))) {
    process.exitCode = 1;
  }
}
