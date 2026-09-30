import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { App } from "../app/App";
import { useAssessmentStore } from "../store/assessmentStore";

describe("assessment runner rendering", () => {
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

    assert.match(landingSource, /loadCompletedResult/);
    assert.match(landingSource, /<ResultPage/);
    assert.doesNotMatch(landingSource, /viewLastResult/);
    assert.doesNotMatch(landingSource, /clearCompletedResult/);
    assert.doesNotMatch(landingSource, /restartAssessment/);
  });
});
