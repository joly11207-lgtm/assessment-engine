import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreAssessment } from "../engine/scoring/scorers";
import { InvalidSubmissionError } from "../engine/runner/runner";
import { registeredAssessments } from "../registry/assessmentRegistry";

const assessment = registeredAssessments.find((item) => item.metadata.id === "demo-personality");
assert.ok(assessment);

const completeAnswers = Object.fromEntries(
  assessment.questions.map((question) => [question.id, question.options[0].id])
);

describe("submission validation", () => {
  it("rejects an incomplete required assessment", () => {
    assert.throws(() => scoreAssessment(assessment, {}), InvalidSubmissionError);
  });

  it("rejects an unknown question ID", () => {
    assert.throws(
      () => scoreAssessment(assessment, { ...completeAnswers, unknownQuestion: "unknownOption" }),
      /unknown question/
    );
  });

  it("rejects an unknown option ID", () => {
    assert.throws(
      () => scoreAssessment(assessment, { ...completeAnswers, [assessment.questions[0].id]: "unknownOption" }),
      /unknown option/
    );
  });

  it("accepts a complete valid submission", () => {
    const result = scoreAssessment(assessment, completeAnswers);
    assert.equal(result.metadata.assessmentId, assessment.metadata.id);
    assert.ok(result.primaryResult);
  });
});
