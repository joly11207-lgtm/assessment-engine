import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  getCompatibilityResultOptions,
  hasCompatibility,
  resolveCompatibility,
  type CompatibilityResolution
} from "../../engine/compatibility/compatibility";
import type { AssessmentResult } from "../../engine/result/types";
import type { PresentationThemeId } from "../../engine/capabilities";
import type { AssessmentPackage, PresentationBlockConfig } from "../../schema/assessmentSchema";
import { zhCN } from "../i18n/zh-CN";
import { ConfiguredResultBlock } from "./resultBlocks";
import { ShareCardPanel } from "./ShareCard";
import { getResultTheme } from "./themes";

function ResultPage({
  assessment,
  assessmentTitle,
  blocks,
  inviteSourceResultId,
  result,
  shareCard,
  theme
}: {
  assessment: AssessmentPackage;
  assessmentTitle: string;
  blocks: PresentationBlockConfig[];
  inviteSourceResultId?: string;
  result: AssessmentResult;
  shareCard: AssessmentPackage["presentation"]["shareCard"];
  theme: PresentationThemeId;
}) {
  const resultTheme = getResultTheme(theme);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const primaryResultId = result.primaryResult?.id;
  const compatibilityBlock = blocks.find((block) => block.type === "compatibility");
  const compatibilityEnabled = Boolean(compatibilityBlock) && hasCompatibility(assessment) && Boolean(primaryResultId);
  const compatibilityOptions = compatibilityEnabled ? getCompatibilityResultOptions(assessment) : [];
  const selectedCompatibilityTargetId = inviteSourceResultId ? primaryResultId : selectedTargetId || undefined;
  const selectedCompatibilitySourceId = inviteSourceResultId ?? primaryResultId;
  const compatibility = useMemo<CompatibilityResolution | undefined>(() => {
    if (!compatibilityEnabled) {
      return undefined;
    }
    return resolveCompatibility(assessment, selectedCompatibilitySourceId, selectedCompatibilityTargetId);
  }, [assessment, compatibilityEnabled, selectedCompatibilitySourceId, selectedCompatibilityTargetId]);
  const inviteUrl = primaryResultId ? buildInviteUrl(assessment.metadata.id, primaryResultId) : "";

  return (
    <section
      aria-label={zhCN.result.assessmentLabel}
      className={`result-page ${resultTheme.className}`}
      data-result-theme={resultTheme.id}
      style={{
        "--result-bg": resultTheme.tokens.background,
        "--result-surface": resultTheme.tokens.surface,
        "--result-primary": resultTheme.tokens.primary,
        "--result-secondary": resultTheme.tokens.secondary,
        "--result-accent": resultTheme.tokens.accent,
        "--result-text": resultTheme.tokens.text,
        "--result-muted": resultTheme.tokens.muted,
        "--result-border": resultTheme.tokens.border,
        "--result-shadow": resultTheme.tokens.shadow
      } as CSSProperties}
    >
      {compatibilityEnabled ? (
        <CompatibilityControls
          compatibility={compatibility}
          inviteSourceResultId={inviteSourceResultId}
          inviteUrl={inviteUrl}
          options={compatibilityOptions}
          selectedTargetId={selectedTargetId}
          setSelectedTargetId={setSelectedTargetId}
          showInvite={compatibilityBlock?.showInvite ?? true}
        />
      ) : null}
      {blocks.map((block, index) => (
        <ConfiguredResultBlock
          compatibility={compatibility}
          config={block}
          index={index}
          key={`${block.type}-${index}`}
          result={result}
        />
      ))}
      <ShareCardPanel
        assessmentTitle={assessmentTitle}
        compatibility={compatibility}
        config={shareCard}
        result={result}
        theme={resultTheme}
      />
    </section>
  );
}

export default ResultPage;

function CompatibilityControls({
  compatibility,
  inviteSourceResultId,
  inviteUrl,
  options,
  selectedTargetId,
  setSelectedTargetId,
  showInvite
}: {
  compatibility?: CompatibilityResolution;
  inviteSourceResultId?: string;
  inviteUrl: string;
  options: Array<{ id: string; title: string; summary: string }>;
  selectedTargetId: string;
  setSelectedTargetId: (value: string) => void;
  showInvite: boolean;
}) {
  return (
    <section className="result-card compatibility-controls" data-compatibility-selector>
      <div>
        <p className="result-kicker">{zhCN.compatibility.title}</p>
        <h3 className="result-card__title">
          {inviteSourceResultId ? zhCN.compatibility.inviteHint : zhCN.compatibility.selectorTitle}
        </h3>
      </div>
      {inviteSourceResultId ? null : (
        <label className="compatibility-select">
          <span>{zhCN.compatibility.selectorLabel}</span>
          <select value={selectedTargetId} onChange={(event) => setSelectedTargetId(event.target.value)}>
            <option value="">{zhCN.compatibility.selectorPlaceholder}</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {compatibility?.status === "resolved" ? (
        <p className="compatibility-controls__status">
          {compatibility.sourceResult.title} {zhCN.compatibility.pairJoiner} {compatibility.targetResult.title} ·{" "}
          {compatibility.overallScore}% {zhCN.compatibility.overallScore}
        </p>
      ) : null}
      {showInvite && inviteUrl ? (
        <a className="button compatibility-invite" href={inviteUrl}>
          {zhCN.compatibility.inviteButton}
        </a>
      ) : null}
    </section>
  );
}

function buildInviteUrl(testId: string, resultId: string) {
  const path = `/test/${encodeURIComponent(testId)}?pair=${encodeURIComponent(resultId)}`;
  if (typeof window === "undefined") {
    return path;
  }
  return `${window.location.origin}${path}`;
}
