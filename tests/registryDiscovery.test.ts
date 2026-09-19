import assert from "node:assert/strict";
import { relative, resolve, sep } from "node:path";
import { describe, it } from "node:test";
import { discoveredAssessmentPackages } from "../registry/generatedAssessmentPackages";
import { discoverTestPackageFiles } from "../tools/generateAssessmentRegistry";

describe("JSON Test Package discovery", () => {
  it("discovers every test.json package without manual imports", async () => {
    const projectRoot = resolve(".");
    const files = await discoverTestPackageFiles(resolve(projectRoot, "content", "tests"));
    const sources = files.map((file) => relative(projectRoot, file).split(sep).join("/"));

    assert.deepEqual(
      discoveredAssessmentPackages.map((entry) => entry.source),
      sources
    );
    assert.equal(sources.every((source) => source.endsWith("/test.json")), true);
  });
});
