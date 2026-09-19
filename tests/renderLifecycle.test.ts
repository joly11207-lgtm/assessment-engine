import assert from "node:assert/strict";
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
});
