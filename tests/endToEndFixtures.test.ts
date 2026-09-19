import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isComplete, createRunnerSession, answerQuestion, nextQuestion } from "../engine/runner/runner";
import { scoreAssessment } from "../engine/scoring/scorers";
import { registeredAssessments } from "../registry/assessmentRegistry";

describe("fixture assessments", () => {
  it("all registered fixtures complete through the shared runner and scorer", () => {
    registeredAssessments.forEach((assessment) => {
      let session = createRunnerSession(assessment);

      assessment.questions.forEach((question, index) => {
        session = answerQuestion(session, question.id, question.options[0].id);
        if (index < assessment.questions.length - 1) {
          session = nextQuestion(assessment, session);
        }
      });

      const result = scoreAssessment(assessment, session.answers);

      assert.equal(isComplete(assessment, session), true);
      assert.equal(result.metadata.assessmentId, assessment.metadata.id);
      assert.equal(result.dimensions.length, assessment.dimensions.length);
      assert.ok(result.primaryResult);
    });
  });
});
