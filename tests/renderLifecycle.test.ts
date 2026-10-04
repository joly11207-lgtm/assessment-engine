import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { App } from "../app/App";
import { createRunnerSession } from "../engine/runner/runner";
import { scoreAssessment } from "../engine/scoring/scorers";
import { registeredAssessments } from "../registry/assessmentRegistry";
import { sessionKey, useAssessmentStore } from "../store/assessmentStore";

describe("assessment runner rendering", () => {
  it("renders the public homepage without published test cards or ids", () => {
    useAssessmentStore.setState({ sessions: {}, results: {} });

    const markup = renderToString(
      createElement(
        MemoryRouter,
        { initialEntries: ["/"] },
        createElement(App)
      )
    );

    assert.doesNotMatch(markup, /assessment-card/);
    assert.doesNotMatch(markup, /demo-personality/);
    assert.doesNotMatch(markup, /demo-ranking/);
    assert.doesNotMatch(markup, /all-tests-title/);
  });

  it("keeps direct test landing routes public", () => {
    useAssessmentStore.setState({ sessions: {}, results: {} });

    const markup = renderToString(
      createElement(
        MemoryRouter,
        { initialEntries: ["/test/demo-personality"] },
        createElement(App)
      )
    );

    assert.match(markup, /test-landing/);
    assert.ok(markup.includes(registeredAssessments.find((item) => item.metadata.id === "demo-personality")!.metadata.title));
  });

  it("does not initialize runner state during render", () => {
    useAssessmentStore.setState({ sessions: {}, results: {} });

    renderToString(
      createElement(
        MemoryRouter,
        { initialEntries: ["/test/demo-personality/run"] },
        createElement(App)
      )
    );

    assert.deepEqual(useAssessmentStore.getState().sessions, {});
  });

  it("renders stored completed results from the test landing without retake controls", () => {
    const appSource = readFileSync("app/App.tsx", "utf8");
    const landingSource = appSource.slice(
      appSource.indexOf("function TestLandingPage()"),
      appSource.indexOf("function AssessmentRunner()")
    );
    const completedResultBranch = landingSource.slice(
      landingSource.indexOf("if (canUseCompletedRecord)"),
      landingSource.indexOf("return (", landingSource.indexOf("if (canUseCompletedRecord)") + 1)
    );

    assert.match(landingSource, /loadCompletedResult/);
    assert.match(landingSource, /<ResultPage/);
    assert.doesNotMatch(landingSource, /viewLastResult/);
    assert.doesNotMatch(landingSource, /clearCompletedResult/);
    assert.doesNotMatch(landingSource, /restartAssessment/);
    assert.doesNotMatch(completedResultBranch, /backToTests/);
    assert.doesNotMatch(completedResultBranch, /link-button/);
  });

  it("keeps the answering page back control pointed at the current test landing", () => {
    const appSource = readFileSync("app/App.tsx", "utf8");
    const runnerSource = appSource.slice(
      appSource.indexOf("function AssessmentRunner()"),
      appSource.indexOf("function safePairParam")
    );

    assert.match(runnerSource, /!result \?/);
    assert.match(runnerSource, /zhCN\.common\.backToTest/);
    assert.match(runnerSource, /navigate\(`\/test\/\$\{assessment\.metadata\.id\}`\)/);
  });

  it("does not render the test-list back link on the normal test landing", () => {
    useAssessmentStore.setState({ sessions: {}, results: {} });

    const markup = renderToString(
      createElement(
        MemoryRouter,
        { initialEntries: ["/test/demo-personality"] },
        createElement(App)
      )
    );

    assert.doesNotMatch(markup, /link-button/);
  });

  it("does not render a retake entry after completing a test on the run route", () => {
    const assessment = registeredAssessments.find((item) => item.metadata.id === "demo-personality");
    assert.ok(assessment);
    const answers = Object.fromEntries(assessment.questions.map((question) => [question.id, question.options[0].id]));
    const key = sessionKey(assessment);
    useAssessmentStore.setState({
      sessions: { [key]: { ...createRunnerSession(assessment), answers } },
      results: { [key]: scoreAssessment(assessment, answers) }
    });

    const markup = renderToString(
      createElement(
        MemoryRouter,
        { initialEntries: ["/test/demo-personality/run"] },
        createElement(App)
      )
    );

    assert.doesNotMatch(markup, /重新测试/);
    assert.doesNotMatch(markup, /link-button/);
    assert.doesNotMatch(markup, /result-actions/);
  });
});
