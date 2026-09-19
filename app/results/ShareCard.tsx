import { toPng } from "html-to-image";
import QRCode from "qrcode";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CompatibilityResolution } from "../../engine/compatibility/compatibility";
import type { AssessmentResult } from "../../engine/result/types";
import type { AssessmentPackage } from "../../schema/assessmentSchema";
import { formatCopy, zhCN } from "../i18n/zh-CN";
import { siteConfig } from "../siteConfig";
import type { ResultTheme } from "./themes";

type ShareCardConfig = AssessmentPackage["presentation"]["shareCard"];
type QrGenerator = (
  url: string,
  options: { margin: number; width: number; errorCorrectionLevel: "M" }
) => Promise<string>;

const shareLayouts = {
  portrait: { label: "3:4", width: 360, height: 480, exportScale: 3 },
  square: { label: "1:1", width: 360, height: 360, exportScale: 3 },
  story: { label: "9:16", width: 360, height: 640, exportScale: 3 }
} as const;

export function ShareCardPanel({
  assessmentTitle,
  compatibility,
  config,
  result,
  theme
}: {
  assessmentTitle: string;
  compatibility?: CompatibilityResolution;
  config: ShareCardConfig;
  result: AssessmentResult;
  theme: ResultTheme;
}) {
  const [layout, setLayout] = useState(config.layout);
  const [status, setStatus] = useState<string>("");

  if (!config.enabled) {
    return null;
  }

  return (
    <section className="result-card share-panel" data-block-type="share-card">
      <div className="share-panel__header">
        <div>
          <p className="result-kicker">{zhCN.share.title}</p>
          <h3 className="result-card__title">{zhCN.share.snapshot}</h3>
        </div>
        <div className="share-layout-tabs" aria-label={zhCN.share.layoutLabel}>
          {(Object.keys(shareLayouts) as Array<keyof typeof shareLayouts>).map((layoutId) => (
            <button
              aria-pressed={layout === layoutId}
              key={layoutId}
              onClick={() => setLayout(layoutId)}
              type="button"
            >
              {shareLayouts[layoutId].label}
            </button>
          ))}
        </div>
      </div>
      <ShareCard
        assessmentTitle={assessmentTitle}
        compatibility={compatibility}
        config={{ ...config, layout }}
        onStatus={setStatus}
        result={result}
        theme={theme}
      />
      {status ? <p className="share-status" role="status">{status}</p> : null}
    </section>
  );
}

export function ShareCard({
  assessmentTitle,
  compatibility,
  config,
  onStatus,
  result,
  theme
}: {
  assessmentTitle: string;
  compatibility?: CompatibilityResolution;
  config: ShareCardConfig;
  onStatus?: (status: string) => void;
  result: AssessmentResult;
  theme: ResultTheme;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const layout = shareLayouts[config.layout];
  const pairResult = compatibility?.status === "resolved" ? compatibility : undefined;
  const qrUrl = useAssessmentUrl(result.metadata.assessmentId, result.primaryResult?.id);
  const qrState = useQrCode(qrUrl, config.qrCode);
  const primary = result.primaryResult;
  const matchScore = getMatchScore(result);
  const dimensions = selectShareDimensions(result, config.dimensionIds);
  const subtitle = config.subtitle ?? primary?.summary ?? zhCN.share.fallbackSubtitle;
  const brandingText = config.brandingText ?? siteConfig.name ?? zhCN.share.defaultBranding;

  useEffect(() => {
    if (qrState.failed) {
      onStatus?.(zhCN.share.qrFailed);
    }
  }, [onStatus, qrState.failed]);

  async function exportCard() {
    const node = ref.current;
    if (!node) {
      return;
    }
    onStatus?.(zhCN.share.rendering);
    const previousInlineSize = {
      aspectRatio: node.style.aspectRatio,
      height: node.style.height,
      maxWidth: node.style.maxWidth,
      width: node.style.width
    };
    try {
      node.style.width = `${layout.width}px`;
      node.style.height = `${layout.height}px`;
      node.style.maxWidth = "none";
      node.style.aspectRatio = `${layout.width} / ${layout.height}`;
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: layout.exportScale,
        width: layout.width,
        height: layout.height,
        backgroundColor: theme.tokens.background
      });
      const link = document.createElement("a");
      link.download = `${result.metadata.assessmentId}-${config.layout}-share-card.png`;
      link.href = dataUrl;
      link.click();
      onStatus?.(zhCN.share.exported);
    } catch (error) {
      onStatus?.(zhCN.share.exportFailed);
      console.error(error);
    } finally {
      node.style.width = previousInlineSize.width;
      node.style.height = previousInlineSize.height;
      node.style.maxWidth = previousInlineSize.maxWidth;
      node.style.aspectRatio = previousInlineSize.aspectRatio;
    }
  }

  return (
    <div className="share-card-stage">
      <div
        className={`share-card share-card--${config.layout}`}
        data-share-card
        ref={ref}
        style={{
          "--share-width": `${layout.width}px`,
          "--share-height": `${layout.height}px`,
          "--share-bg": theme.tokens.background,
          "--share-surface": theme.tokens.surface,
          "--share-primary": theme.tokens.primary,
          "--share-secondary": theme.tokens.secondary,
          "--share-accent": theme.tokens.accent,
          "--share-text": theme.tokens.text,
          "--share-muted": theme.tokens.muted,
          "--share-border": theme.tokens.border,
          aspectRatio: `${layout.width} / ${layout.height}`
        } as CSSProperties}
      >
        <div className="share-card__mark">{assessmentTitle}</div>
        {pairResult ? (
          <CompatibilityShareContent compatibility={pairResult} />
        ) : (
          <div className="share-card__body">
            <p>{config.headline ?? zhCN.share.defaultHeadline}</p>
            <h4>{primary?.title ?? zhCN.share.fallbackTitle}</h4>
            <span>{subtitle}</span>
          </div>
        )}
        {!pairResult && config.showMatch && matchScore !== undefined ? (
          <div className="share-card__score" aria-label={`${matchScore}% ${zhCN.share.match}`}>
            <strong>{matchScore}%</strong>
            <span>{zhCN.share.match}</span>
          </div>
        ) : null}
        {!pairResult && config.showRadarSummary && dimensions.length > 0 ? (
          <dl className="share-card__dimensions">
            {dimensions.map((dimension) => (
              <div key={dimension.id}>
                <dt>{dimension.label}</dt>
                <dd>{dimension.normalized}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {!pairResult && config.showTags && result.tags.length > 0 ? (
          <ul className="share-card__tags">
            {result.tags.slice(0, 3).map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        ) : null}
        <div className="share-card__footer">
          <span>{brandingText}</span>
          {config.qrCode && qrState.dataUrl ? <img alt={zhCN.share.qrAlt} src={qrState.dataUrl} /> : null}
        </div>
      </div>
      <button className="share-export-button" onClick={exportCard} type="button">
        {zhCN.share.exportPng}
      </button>
    </div>
  );
}

function CompatibilityShareContent({ compatibility }: { compatibility: Extract<CompatibilityResolution, { status: "resolved" }> }) {
  return (
    <>
      <div className="share-card__body share-card__body--pair">
        <p>{zhCN.compatibility.shareHeadline}</p>
        <h4>
          {compatibility.sourceResult.title}
          <span aria-hidden="true">{zhCN.compatibility.pairJoiner}</span>
          {compatibility.targetResult.title}
        </h4>
        <span>{compatibility.summary}</span>
      </div>
      <div
        className="share-card__score"
        aria-label={formatCopy(zhCN.compatibility.scoreAlt, { score: compatibility.overallScore })}
      >
        <strong>{compatibility.overallScore}%</strong>
        <span>{zhCN.compatibility.overallScore}</span>
      </div>
      {compatibility.dimensions.length > 0 ? (
        <dl className="share-card__dimensions share-card__dimensions--pair">
          {compatibility.dimensions.slice(0, 3).map((dimension) => (
            <div key={dimension.id}>
              <dt>{dimension.label}</dt>
              <dd>{dimension.score}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
}

function useAssessmentUrl(assessmentId: string, resultId?: string) {
  return useMemo(() => {
    const pairParam = resultId ? `?pair=${encodeURIComponent(resultId)}` : "";
    if (typeof window === "undefined") {
      return `/test/${assessmentId}${pairParam}`;
    }
    return `${window.location.origin}/test/${assessmentId}${pairParam}`;
  }, [assessmentId, resultId]);
}

function useQrCode(url: string, enabled: boolean) {
  const [state, setState] = useState({ dataUrl: "", failed: false });

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setState({ dataUrl: "", failed: false });
      return;
    }
    createQrCodeDataUrl(url)
      .then((nextState) => {
        if (!cancelled) {
          setState(nextState);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, url]);

  return state;
}

export async function createQrCodeDataUrl(
  url: string,
  generator: QrGenerator = QRCode.toDataURL as QrGenerator
): Promise<{ dataUrl: string; failed: boolean }> {
  try {
    return {
      dataUrl: await generator(url, { margin: 1, width: 132, errorCorrectionLevel: "M" }),
      failed: false
    };
  } catch {
    return { dataUrl: "", failed: true };
  }
}

function getMatchScore(result: AssessmentResult) {
  const primaryId = result.primaryResult?.id;
  if (!primaryId) {
    return undefined;
  }
  return (
    result.matches.find((match) => match.id === primaryId)?.similarity ??
    result.rankings.find((ranking) => ranking.id === primaryId)?.score
  );
}

function selectShareDimensions(result: AssessmentResult, dimensionIds: string[]) {
  if (dimensionIds.length > 0) {
    const requested = new Set(dimensionIds);
    return result.dimensions.filter((dimension) => requested.has(dimension.id)).slice(0, 3);
  }
  return [...result.dimensions].sort((a, b) => b.normalized - a.normalized).slice(0, 3);
}
