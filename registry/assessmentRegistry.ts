import { discoveredAssessmentPackages } from "./generatedAssessmentPackages";
import { validateAssessmentPackage, type AssessmentPackage } from "../schema/assessmentSchema";

export const registeredAssessments: AssessmentPackage[] = discoveredAssessmentPackages.map(({ source, packageData }) => {
  const result = validateAssessmentPackage(packageData);
  if (!result.success) {
    throw new Error(`Invalid assessment package "${source}":\n${result.errors.join("\n")}`);
  }
  return result.data;
});

const duplicateIds = registeredAssessments
  .map((assessment) => assessment.metadata.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index);

if (duplicateIds.length > 0) {
  throw new Error(`Duplicate assessment IDs: ${Array.from(new Set(duplicateIds)).join(", ")}`);
}

export function getAssessmentById(id: string): AssessmentPackage | undefined {
  return registeredAssessments.find((assessment) => assessment.metadata.id === id);
}
