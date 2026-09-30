# Assessment Engine Framework V1

This repository contains a reusable assessment engine built with React, TypeScript, Vite, React Router, Zustand, Zod, Motion, Recharts, html-to-image, and QRCode. V0.5.1 freezes the framework as V1 with a generic, backend-free compatibility system while preserving the frozen Core V1 runner, scoring pipeline, Result Block architecture, theme system, Chinese product shell, and JSON Test Package discovery.

## Architecture

- `content/tests/<test-id>/test.json` contains data-only Test Packages. Packages declare `schemaVersion`, metadata, typed discovery fields, dimensions, questions, scoring, results, presentation blocks, and assets.
- `app/i18n/zh-CN.ts` owns framework UI copy. Assessment-specific Chinese content remains in JSON Test Packages.
- `app/siteConfig.ts` owns the temporary product shell name, tagline, description, and default locale.
- `schema` owns the Zod schema and validation rules. It catches invalid versions, duplicate IDs, missing IDs, unknown dimension/result references, unsupported or incorrectly ordered scoring strategies, invalid weights, missing result data, and unsupported presentation blocks.
- `engine/scoring` owns strategy-based scoring. Current strategies are `weighted-dimension`, `normalize`, `profile-match`, and `entity-ranking`; their generic requirements and provided capabilities are declared in `engine/capabilities.ts`.
- `engine/result` defines the unified `AssessmentResult`. The UI receives this model and does not recalculate scores.
- `app/results` owns the lazy-loaded Result Page, central theme registry, Share Card renderer, and reusable Result Block registry. Current blocks are `hero`, `radar`, `ranking`, `spectrum`, `tags`, `strengths`, `weaknesses`, `quote`, `quadrant`, `highlight`, and `compatibility`.
- `app/preview` owns the development-only ZIP Test Previewer. It unzips Test Creator packages in the browser, validates them with the same Zod schema, and feeds valid in-memory packages into the existing runner, scoring engine, Result Page, themes, Share Card, and compatibility resolver without writing to `content/tests`.
- `presentation.theme`, `presentation.blocks`, and `presentation.shareCard` are typed, Zod-validated configuration. Test Packages choose visual theme, block composition, hero variant, share-card layout, and order without assessment-specific React code or executable CSS.
- The initial app bundle does not import the heavy result layer. `ResultPage` lazy-loads Motion, Recharts, html-to-image, QR generation, and future result-only dependencies after an assessment is complete.
- `engine/runner` owns runner state transitions.
- `engine/storage` owns validated localStorage progress using `assessment:{testId}:{testVersion}:progress` keys. Malformed, stale, or incompatible sessions are discarded, while blocked or failed storage writes leave the in-memory runner usable.
- `store` wraps runner actions in Zustand and persists unfinished progress.
- `registry` contains the generated assessment registry. `tools/generateAssessmentRegistry.ts` discovers JSON packages at build time, preserving static-hosting compatibility.
- `app` is a thin React Router presentation layer with `/`, `/test/:testId`, and `/test/:testId/run` routes. Share-card QR codes point to the public test landing route.

## Add A New Assessment

1. Create `content/tests/my-assessment/test.json`.
2. Include `"schemaVersion": "1.0"`, a unique metadata ID, validated discovery metadata, dimensions, questions, a scoring pipeline, results, presentation config, and assets.
3. Run `npm run validate`. This discovers and validates every package, then regenerates the registry only after validation succeeds.
4. Run `npm run build`. The assessment will appear automatically; no application or engine source edit is required.

Test Packages must contain JSON data only. No scoring or React source should change for a new valid assessment using existing strategies and Result Blocks. Add a scorer or block only when introducing a genuinely new reusable capability.

The current Vite setup remains intentionally unchanged for this hardening release. Before SEO or static-prerender work, the project should migrate to the then-current Vite and React Router Framework Mode baseline in a dedicated upgrade.

## Commands

```bash
npm install
npm run validate
npm run test
npm run build
```

## ZIP Test Previewer

Run the app locally and open `/preview`. Drop or upload a Test Creator ZIP containing one `test.json` at the root or inside a single top-level folder. Optional `acceptance-cases.json` and `design-report.md` are read in-browser only.

The previewer provides:

- `正常做题`: starts from question one and scores with the existing engine.
- `快速预览结果`: renders a chosen result through the existing Result Page, clearly marked as Preview.
- `Acceptance Cases`: runs provided answers through the existing scoring engine and reports expected versus actual results.

Invalid schema packages show Zod validation errors and cannot enter the runner.

`node_modules` and `dist` are generated locally and are excluded from source packages by `.gitignore`.

`npm run build` starts with the same package validation gate, so schema-invalid JSON cannot reach TypeScript or Vite. For a source-only ZIP from a Git checkout, use:

```bash
git archive --format=zip --output assessment-engine-framework-v1-source.zip HEAD
```

This packages tracked source files only, excluding ignored dependency, build, cache, and coverage folders.

## V0.4 Build Size Note

The previous V0.2 production build emitted one main JS bundle of about `791.12 kB` (`241.14 kB` gzip). V0.4 keeps the V0.3 lazy result boundary:

- initial app bundle: about `377.62 kB` (`116.17 kB` gzip)
- lazy result chunk: about `474.63 kB` (`149.20 kB` gzip)

The result chunk contains Recharts, Motion, Share Card export, and QR support, and is loaded only after the runner reaches a completed result.

Share-card exports are fixed at production social dimensions:

- `portrait`: `1080 x 1440`
- `square`: `1080 x 1080`
- `story`: `1080 x 1920`
