import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("production package validation gate", () => {
  it("exits unsuccessfully for a syntactically valid package with an invalid schema", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "tools/validateAssessments.ts",
        "--tests-root",
        resolve("tests", "fixtures")
      ],
      { cwd: resolve("."), encoding: "utf8" }
    );

    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /FAIL tests\/fixtures\/invalid-test-package\/test\.json/);
    assert.match(result.stdout, /Required/);
  });
});
