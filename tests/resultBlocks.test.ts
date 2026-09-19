import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ResultPage from "../app/results/ResultPage";
import { resultBlocks } from "../app/results/resultBlocks";
import { createQrCodeDataUrl } from "../app/results/ShareCard";
import { resultThemes } from "../app/results/themes";
import type { AssessmentResult } from "../engine/result/types";
import { registeredAssessments } from "../registry/assessmentRegistry";

const result: AssessmentResult = {
  primaryResult: { id: "trail-spark", title: "Trail Spark", summary: "Curious and playful." },
  secondaryResult: { id: "open-harbor", title: "Open Harbor", summary: "Balanced and supportive." },
  dimensions: [
    { id: "curiosity", label: "Curiosity", raw: 5, normalized: 82 },
    { id: "order", label: "Order", raw: 2, normalized: 61 },
    { id: "empathy", label: "Empathy", raw: 4, normalized: 76 }
  ],
  rankings: [],
  matches: [
    { id: "trail-spark", title: "Trail Spark", similarity: 92, rank: 1 },
    { id: "open-harbor", title: "Open Harbor", similarity: 84, rank: 2 }
  ],
  tags: ["curious", "playful"],
  strengths: ["Curiosity", "Empathy"],
  weaknesses: ["Order"],
  metadata: {
    assessmentId: "render-test",
    assessmentVersion: "v1",
    completedAt: "2026-01-01T00:00:00.000Z",
    scoringStrategies: ["weighted-dimension", "normalize", "profile-match"]
  }
};

describe("result block system", () => {
  it("registers all eleven reusable result blocks", () => {
    assert.deepEqual(Object.keys(resultBlocks), [
      "hero",
      "radar",
      "ranking",
      "spectrum",
      "tags",
      "strengths",
      "weaknesses",
      "quote",
      "quadrant",
      "highlight",
      "compatibility"
    ]);
  });

  it("keeps reusable theme presets centrally registered", () => {
    assert.deepEqual(Object.keys(resultThemes), ["editorial", "aurora", "midnight", "playful", "warm", "electric"]);
  });

  it("selects blocks and preserves ordering from presentation configuration", () => {
    const personality = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-personality");
    assert.ok(personality);
    const byType = new Map(personality.presentation.blocks.map((block) => [block.type, block]));
    const blocks = [byType.get("quote"), byType.get("hero"), byType.get("strengths")].filter(
      (block): block is NonNullable<typeof block> => Boolean(block)
    );

    const markup = renderToStaticMarkup(
      createElement(ResultPage, {
        assessment: personality,
        assessmentTitle: personality.metadata.title,
        blocks,
        result,
        shareCard: personality.presentation.shareCard,
        theme: personality.presentation.theme
      })
    );
    const quoteIndex = markup.indexOf('data-block-type="quote"');
    const heroIndex = markup.indexOf('data-block-type="hero"');
    const strengthsIndex = markup.indexOf('data-block-type="strengths"');

    assert.ok(quoteIndex >= 0);
    assert.ok(quoteIndex < heroIndex);
    assert.ok(heroIndex < strengthsIndex);
    assert.doesNotMatch(markup, /data-block-type="ranking"/);
  });

  it("allows different assessments to declare distinct block combinations", () => {
    const combinations = Object.fromEntries(
      registeredAssessments.map((assessment) => [
        assessment.metadata.id,
        assessment.presentation.blocks.map((block) => block.type)
      ])
    );

    assert.deepEqual(combinations["demo-personality"], ["hero", "radar", "tags", "strengths", "weaknesses", "quote"]);
    assert.deepEqual(combinations["demo-ranking"], ["hero", "spectrum", "ranking", "highlight", "quote"]);
    assert.deepEqual(combinations["demo-relationship"], [
      "hero",
      "compatibility",
      "radar",
      "quadrant",
      "strengths",
      "weaknesses",
      "quote"
    ]);
  });

  it("renders from AssessmentResult and presentation config without raw answers", () => {
    const personality = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-personality");
    assert.ok(personality);
    const hero = personality.presentation.blocks.find((block) => block.type === "hero");
    assert.ok(hero);

    const markup = renderToStaticMarkup(
      createElement(ResultPage, {
        assessment: personality,
        assessmentTitle: personality.metadata.title,
        blocks: [hero],
        result,
        shareCard: personality.presentation.shareCard,
        theme: personality.presentation.theme
      })
    );
    assert.match(markup, /Trail Spark/);
    assert.match(markup, /92% 匹配/);
  });

  it("maps share card content from result and validated package config", () => {
    const personality = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-personality");
    assert.ok(personality);

    const markup = renderToStaticMarkup(
      createElement(ResultPage, {
        assessment: personality,
        assessmentTitle: personality.metadata.title,
        blocks: [],
        result,
        shareCard: personality.presentation.shareCard,
        theme: personality.presentation.theme
      })
    );

    assert.match(markup, /data-share-card/);
    assert.match(markup, /人格光谱小测/);
    assert.match(markup, /Trail Spark/);
    assert.doesNotMatch(markup, /q01|explore|answers/);
  });

  it("uses centralized Chinese copy for result accessibility and default share branding", () => {
    const personality = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-personality");
    assert.ok(personality);
    const shareCard = { ...personality.presentation.shareCard, brandingText: undefined };

    const markup = renderToStaticMarkup(
      createElement(ResultPage, {
        assessment: personality,
        assessmentTitle: personality.metadata.title,
        blocks: [],
        result,
        shareCard,
        theme: personality.presentation.theme
      })
    );

    assert.match(markup, /aria-label="测试结果"/);
    assert.match(markup, /轻测一下/);
    assert.doesNotMatch(markup, /Assessment Engine/);
  });

  it("lets QR generation fail without blocking share card rendering", async () => {
    const qrState = await createQrCodeDataUrl("/test/demo-personality", async () => {
      throw new Error("blocked storage or canvas environment");
    });

    assert.deepEqual(qrState, { dataUrl: "", failed: true });
  });

  it("renders compatibility block, selector, invite link, and pair share-card content", () => {
    const relationship = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-relationship");
    assert.ok(relationship);
    const compatibilityBlock = relationship.presentation.blocks.find((block) => block.type === "compatibility");
    assert.ok(compatibilityBlock);
    const relationshipResult: AssessmentResult = {
      ...result,
      primaryResult: { id: "open-trail", title: "开放行者", summary: "重视空间和弹性。" },
      secondaryResult: undefined,
      dimensions: [
        { id: "expression", label: "表达", raw: 2, normalized: 74 },
        { id: "independence", label: "边界", raw: 4, normalized: 88 },
        { id: "planning", label: "计划", raw: 1, normalized: 46 },
        { id: "warmth", label: "温度", raw: 3, normalized: 70 }
      ],
      matches: [{ id: "open-trail", title: "开放行者", similarity: 94, rank: 1 }],
      tags: ["自由", "真诚"],
      metadata: {
        ...result.metadata,
        assessmentId: "demo-relationship"
      }
    };

    const markup = renderToStaticMarkup(
      createElement(ResultPage, {
        assessment: relationship,
        assessmentTitle: relationship.metadata.title,
        blocks: [compatibilityBlock],
        inviteSourceResultId: "steady-harbor",
        result: relationshipResult,
        shareCard: relationship.presentation.shareCard,
        theme: relationship.presentation.theme
      })
    );

    assert.match(markup, /data-compatibility-selector/);
    assert.match(markup, /data-block-type="compatibility"/);
    assert.match(markup, /68%/);
    assert.match(markup, /邀请 TA 测一测/);
    assert.match(markup, /我们的匹配结果/);
    assert.match(markup, /pair=open-trail/);
    assert.doesNotMatch(markup, /answers|localStorage|q01/);
  });

  it("keeps compatibility controls presentation-driven", () => {
    const relationship = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-relationship");
    assert.ok(relationship);
    const compatibilityBlock = relationship.presentation.blocks.find((block) => block.type === "compatibility");
    assert.ok(compatibilityBlock);
    const relationshipResult: AssessmentResult = {
      ...result,
      primaryResult: { id: "open-trail", title: "开放小径", summary: "重视空间和弹性。" },
      secondaryResult: undefined,
      metadata: { ...result.metadata, assessmentId: "demo-relationship" }
    };

    const withInvite = renderToStaticMarkup(
      createElement(ResultPage, {
        assessment: relationship,
        assessmentTitle: relationship.metadata.title,
        blocks: [{ ...compatibilityBlock, showInvite: true }],
        result: relationshipResult,
        shareCard: relationship.presentation.shareCard,
        theme: relationship.presentation.theme
      })
    );
    const withoutInvite = renderToStaticMarkup(
      createElement(ResultPage, {
        assessment: relationship,
        assessmentTitle: relationship.metadata.title,
        blocks: [{ ...compatibilityBlock, showInvite: false }],
        result: relationshipResult,
        shareCard: relationship.presentation.shareCard,
        theme: relationship.presentation.theme
      })
    );
    const withoutBlock = renderToStaticMarkup(
      createElement(ResultPage, {
        assessment: relationship,
        assessmentTitle: relationship.metadata.title,
        blocks: relationship.presentation.blocks.filter((block) => block.type !== "compatibility"),
        result: relationshipResult,
        shareCard: relationship.presentation.shareCard,
        theme: relationship.presentation.theme
      })
    );

    assert.match(withInvite, /data-compatibility-selector/);
    assert.match(withInvite, /compatibility-invite/);
    assert.match(withoutInvite, /data-compatibility-selector/);
    assert.doesNotMatch(withoutInvite, /compatibility-invite/);
    assert.doesNotMatch(withoutBlock, /data-compatibility-selector/);
    assert.doesNotMatch(withoutBlock, /data-block-type="compatibility"/);
  });

  it("renders Chinese result content across all reusable themes", () => {
    const personality = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-personality");
    assert.ok(personality);
    const chineseResult: AssessmentResult = {
      ...result,
      primaryResult: { id: "trail-spark", title: "灵感行者", summary: "这是一段较长的中文结果摘要，用来验证换行与主题样式。" },
      secondaryResult: { id: "open-harbor", title: "开放港湾", summary: "次要结果摘要。" },
      dimensions: result.dimensions.map((dimension, index) => ({
        ...dimension,
        label: ["探索欲", "秩序感", "共情力"][index] ?? dimension.label
      })),
      tags: ["好奇", "行动前先观察", "温和但不拖延"]
    };

    for (const theme of Object.keys(resultThemes) as Array<keyof typeof resultThemes>) {
      const markup = renderToStaticMarkup(
        createElement(ResultPage, {
          assessment: personality,
          assessmentTitle: personality.metadata.title,
          blocks: personality.presentation.blocks,
          result: chineseResult,
          shareCard: personality.presentation.shareCard,
          theme
        })
      );
      assert.match(markup, new RegExp(`data-result-theme="${theme}"`));
      assert.match(markup, /灵感行者/);
    }
  });

  it("keeps the result page behind a lazy loading boundary", () => {
    const appSource = readFileSync(new URL("../app/App.tsx", import.meta.url), "utf8");

    assert.match(appSource, /lazy\(\(\) => import\("\.\/results\/ResultPage"\)\)/);
    assert.doesNotMatch(appSource, /import \{ ResultPage \} from "\.\/results\/ResultPage"/);
  });
});
