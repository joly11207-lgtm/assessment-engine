import type { ComponentType, CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar as RechartsRadar,
  RadarChart,
  ResponsiveContainer
} from "recharts";
import type { PresentationBlockId } from "../../engine/capabilities";
import type { CompatibilityResolution } from "../../engine/compatibility/compatibility";
import type { AssessmentResult } from "../../engine/result/types";
import type { PresentationBlockConfig } from "../../schema/assessmentSchema";
import { formatCopy, zhCN } from "../i18n/zh-CN";

type ConfigFor<T extends PresentationBlockId> = Extract<PresentationBlockConfig, { type: T }>;

interface ResultBlockProps<T extends PresentationBlockId> {
  compatibility?: CompatibilityResolution;
  config: ConfigFor<T>;
  index: number;
  result: AssessmentResult;
}

type ResultBlockRegistry = {
  [K in PresentationBlockId]: ComponentType<ResultBlockProps<K>>;
};

interface BlockShellProps {
  children: ReactNode;
  className?: string;
  index: number;
  type: PresentationBlockId;
}

function BlockShell({ children, className = "", index, type }: BlockShellProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.article
      className={`result-card ${className}`.trim()}
      data-block-type={type}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: reduceMotion ? 0 : Math.min(index * 0.07, 0.35), ease: "easeOut" }}
    >
      {children}
    </motion.article>
  );
}

export function HeroBlock({ config, index, result }: ResultBlockProps<"hero">) {
  const primary = result.primaryResult;
  const matchScore = primary
    ? result.matches.find((match) => match.id === primary.id)?.similarity ??
      result.rankings.find((ranking) => ranking.id === primary.id)?.score
    : undefined;

  return (
    <BlockShell className={`result-hero result-hero--${config.variant}`} index={index} type={config.type}>
      <div className="result-hero__topline">
        <p className="result-kicker">{config.title ?? zhCN.result.defaultHeroTitle}</p>
        {config.showMatch && matchScore !== undefined ? (
          <span className="result-score" aria-label={formatCopy(zhCN.result.percentMatch, { score: matchScore })}>
            {formatCopy(zhCN.result.percentMatch, { score: matchScore })}
          </span>
        ) : null}
      </div>
      <h2>{primary?.title ?? zhCN.result.defaultHeroTitle}</h2>
      {primary?.summary ? <p className="result-hero__summary">{primary.summary}</p> : null}
      {config.showSecondary && result.secondaryResult ? (
        <p className="result-secondary">
          {formatCopy(zhCN.result.alsoCloseTo, { title: result.secondaryResult.title })}
        </p>
      ) : null}
      {config.showTags && result.tags.length > 0 ? <TagList tags={result.tags} /> : null}
    </BlockShell>
  );
}

export function RadarBlock({ config, index, result }: ResultBlockProps<"radar">) {
  const reduceMotion = useReducedMotion();
  const data = result.dimensions.map((dimension) => ({
    dimension: dimension.label,
    value: dimension.normalized,
    fullMark: config.max
  }));

  return (
    <BlockShell index={index} type={config.type}>
      <BlockHeading>{config.title ?? zhCN.result.profileShape}</BlockHeading>
      <div className="radar-wrap" role="img" aria-label={zhCN.result.radarAlt}>
        <div className="radar-chart" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="76%" margin={{ top: 6, right: 18, bottom: 6, left: 18 }}>
              <PolarGrid stroke="var(--result-border)" radialLines={false} />
              <PolarAngleAxis dataKey="dimension" tick={{ fill: "var(--result-text)", fontSize: 11, fontWeight: 750 }} />
              <PolarRadiusAxis angle={90} domain={[0, config.max]} tickCount={5} tick={false} axisLine={false} />
              <RechartsRadar
                dataKey="value"
                stroke="var(--result-primary)"
                fill="var(--result-primary)"
                fillOpacity={0.26}
                strokeWidth={3}
                dot={{ fill: "var(--result-accent)", r: 4, strokeWidth: 0 }}
                isAnimationActive={!reduceMotion}
                animationDuration={700}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <ul className="sr-only">
          {result.dimensions.map((dimension) => (
            <li key={dimension.id}>
              {formatCopy(zhCN.result.dimensionScore, {
                label: dimension.label,
                score: dimension.normalized,
                max: config.max
              })}
            </li>
          ))}
        </ul>
      </div>
    </BlockShell>
  );
}

export function RankingBlock({ config, index, result }: ResultBlockProps<"ranking">) {
  const reduceMotion = useReducedMotion();
  const rankings = result.rankings.slice(0, config.limit);

  return (
    <BlockShell index={index} type={config.type}>
      <BlockHeading>{config.title ?? zhCN.result.bestMatches}</BlockHeading>
      {rankings.length > 0 ? (
        <ol className="ranking-list">
          {rankings.map((ranking, rankingIndex) => (
            <motion.li
              key={ranking.id}
              className={rankingIndex === 0 ? "ranking-item ranking-item--top" : "ranking-item"}
              initial={reduceMotion ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: reduceMotion ? 0 : 0.12 + rankingIndex * 0.06 }}
            >
              <span className="ranking-position">#{ranking.rank}</span>
              <span className="ranking-copy">
                <strong>{ranking.title}</strong>
                {ranking.summary ? <small>{ranking.summary}</small> : null}
              </span>
              <strong className="ranking-score">{ranking.score}%</strong>
            </motion.li>
          ))}
        </ol>
      ) : (
        <p className="result-empty">{zhCN.result.noRankings}</p>
      )}
    </BlockShell>
  );
}

export function SpectrumBlock({ config, index, result }: ResultBlockProps<"spectrum">) {
  const reduceMotion = useReducedMotion();

  return (
    <BlockShell index={index} type={config.type}>
      <BlockHeading>{config.title ?? zhCN.result.dimensions}</BlockHeading>
      <div className="spectrum-list">
        {result.dimensions.map((dimension, dimensionIndex) => {
          const endpoints = config.endpoints[dimension.id];
          const width = Math.max(0, Math.min(100, (dimension.normalized / config.max) * 100));
          return (
            <div className="spectrum-row" key={dimension.id}>
              <div className="spectrum-label">
                <strong>{dimension.label}</strong>
                <span>{dimension.normalized}</span>
              </div>
              <div className="spectrum-track" aria-hidden="true">
                <motion.div
                  className="spectrum-fill"
                  style={{ "--spectrum-value": `${width}%` } as CSSProperties}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.55, delay: reduceMotion ? 0 : dimensionIndex * 0.05 }}
                />
              </div>
              {endpoints ? (
                <div className="spectrum-endpoints">
                  <span>{endpoints.left}</span>
                  <span>{endpoints.right}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </BlockShell>
  );
}

export function TagsBlock({ config, index, result }: ResultBlockProps<"tags">) {
  if (result.tags.length === 0) {
    return null;
  }
  return (
    <BlockShell index={index} type={config.type}>
      <BlockHeading>{config.title ?? zhCN.result.atAGlance}</BlockHeading>
      <TagList tags={result.tags} />
    </BlockShell>
  );
}

export function StrengthsBlock({ config, index, result }: ResultBlockProps<"strengths">) {
  return (
    <BlockShell className="result-card--accent" index={index} type={config.type}>
      <BlockHeading>{config.title ?? zhCN.result.strengths}</BlockHeading>
      <ResultList items={result.strengths} />
    </BlockShell>
  );
}

export function WeaknessesBlock({ config, index, result }: ResultBlockProps<"weaknesses">) {
  return (
    <BlockShell className="result-card--warm" index={index} type={config.type}>
      <BlockHeading>{config.title ?? zhCN.result.weaknesses}</BlockHeading>
      <ResultList items={result.weaknesses} />
    </BlockShell>
  );
}

export function QuoteBlock({ config, index, result }: ResultBlockProps<"quote">) {
  const statement = result.primaryResult
    ? config.statements.find((item) => item.resultId === result.primaryResult?.id)?.text
    : undefined;
  const quote = statement ?? config.fallback;
  if (!quote) {
    return null;
  }

  return (
    <BlockShell className="quote-card" index={index} type={config.type}>
      {config.title ? <p className="result-kicker">{config.title}</p> : null}
      <blockquote>{quote}</blockquote>
    </BlockShell>
  );
}

export function QuadrantBlock({ config, index, result }: ResultBlockProps<"quadrant">) {
  const x = result.dimensions.find((dimension) => dimension.id === config.xDimension);
  const y = result.dimensions.find((dimension) => dimension.id === config.yDimension);
  if (!x || !y) {
    return null;
  }

  const xValue = clampPercent(x.normalized);
  const yValue = clampPercent(y.normalized);

  return (
    <BlockShell index={index} type={config.type}>
      <BlockHeading>{config.title ?? zhCN.result.quadrant}</BlockHeading>
      <div
        className="quadrant"
        role="img"
        aria-label={formatCopy(zhCN.result.quadrantAlt, {
          xLabel: x.label,
          xScore: xValue,
          yLabel: y.label,
          yScore: yValue
        })}
      >
        <span className="quadrant__label quadrant__label--top">
          {config.labels.top ?? formatCopy(zhCN.result.highDimension, { label: y.label })}
        </span>
        <span className="quadrant__label quadrant__label--right">
          {config.labels.right ?? formatCopy(zhCN.result.highDimension, { label: x.label })}
        </span>
        <span className="quadrant__label quadrant__label--bottom">
          {config.labels.bottom ?? formatCopy(zhCN.result.lowDimension, { label: y.label })}
        </span>
        <span className="quadrant__label quadrant__label--left">
          {config.labels.left ?? formatCopy(zhCN.result.lowDimension, { label: x.label })}
        </span>
        <div className="quadrant__plane" aria-hidden="true">
          <span className="quadrant__axis quadrant__axis--x" />
          <span className="quadrant__axis quadrant__axis--y" />
          <span
            className="quadrant__point"
            style={{ "--quadrant-x": `${xValue}%`, "--quadrant-y": `${100 - yValue}%` } as CSSProperties}
          />
        </div>
      </div>
      <p className="quadrant__text">
        {formatCopy(zhCN.result.quadrantText, { xLabel: x.label, xScore: xValue, yLabel: y.label, yScore: yValue })}
      </p>
    </BlockShell>
  );
}

export function HighlightBlock({ config, index, result }: ResultBlockProps<"highlight">) {
  const facts = config.facts
    .map((fact) => resolveHighlightFact(fact, result))
    .filter((fact): fact is { label: string; value: string } => Boolean(fact));

  return (
    <BlockShell className="highlight-card" index={index} type={config.type}>
      <BlockHeading>{config.title ?? zhCN.result.highlights}</BlockHeading>
      <dl className="highlight-grid">
        {facts.map((fact) => (
          <div key={`${fact.label}-${fact.value}`}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </BlockShell>
  );
}

export function CompatibilityBlock({ compatibility, config, index }: ResultBlockProps<"compatibility">) {
  if (!compatibility || compatibility.status !== "resolved") {
    return (
      <BlockShell className="compatibility-card" index={index} type={config.type}>
        <BlockHeading>{config.title ?? zhCN.compatibility.title}</BlockHeading>
        <p className="result-empty">{zhCN.compatibility.missing}</p>
      </BlockShell>
    );
  }

  return (
    <BlockShell className="compatibility-card" index={index} type={config.type}>
      <div className="compatibility-card__top">
        <BlockHeading>{config.title ?? zhCN.compatibility.title}</BlockHeading>
        <div
          className="compatibility-score"
          aria-label={formatCopy(zhCN.compatibility.scoreAlt, { score: compatibility.overallScore })}
        >
          <strong>{compatibility.overallScore}%</strong>
          <span>{zhCN.compatibility.overallScore}</span>
        </div>
      </div>

      <div className="compatibility-identities">
        <ResultIdentity label={zhCN.compatibility.sourceLabel} title={compatibility.sourceResult.title} />
        <span aria-hidden="true">{zhCN.compatibility.pairJoiner}</span>
        <ResultIdentity label={zhCN.compatibility.targetLabel} title={compatibility.targetResult.title} />
      </div>

      {compatibility.dimensions.length > 0 ? (
        <div className="compatibility-dimensions" aria-label={zhCN.compatibility.dimensions}>
          {compatibility.dimensions.map((dimension) => (
            <div className="compatibility-dimension" key={dimension.id}>
              <div>
                <strong>{dimension.label}</strong>
                <span>{dimension.score}</span>
              </div>
              <div className="compatibility-meter" aria-hidden="true">
                <span style={{ width: `${clampPercent(dimension.score)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <p className="compatibility-summary">
        <strong>{zhCN.compatibility.summary}</strong>
        {compatibility.summary}
      </p>

      <div className="compatibility-lists">
        <section>
          <h4>{zhCN.compatibility.strengths}</h4>
          <ResultList items={compatibility.strengths} />
        </section>
        <section>
          <h4>{zhCN.compatibility.frictionPoints}</h4>
          <ResultList items={compatibility.frictionPoints} />
        </section>
      </div>

      {compatibility.advice ? (
        <p className="compatibility-advice">
          <strong>{zhCN.compatibility.advice}</strong>
          {compatibility.advice}
        </p>
      ) : null}
    </BlockShell>
  );
}

export const resultBlocks = {
  hero: HeroBlock,
  radar: RadarBlock,
  ranking: RankingBlock,
  spectrum: SpectrumBlock,
  tags: TagsBlock,
  strengths: StrengthsBlock,
  weaknesses: WeaknessesBlock,
  quote: QuoteBlock,
  quadrant: QuadrantBlock,
  highlight: HighlightBlock,
  compatibility: CompatibilityBlock
} satisfies ResultBlockRegistry;

export function ConfiguredResultBlock({
  compatibility,
  config,
  index,
  result
}: {
  compatibility?: CompatibilityResolution;
  config: PresentationBlockConfig;
  index: number;
  result: AssessmentResult;
}) {
  const Component = resultBlocks[config.type] as ComponentType<{
    compatibility?: CompatibilityResolution;
    config: PresentationBlockConfig;
    index: number;
    result: AssessmentResult;
  }>;
  return <Component compatibility={compatibility} config={config} index={index} result={result} />;
}

function BlockHeading({ children }: { children: ReactNode }) {
  return <h3 className="result-card__title">{children}</h3>;
}

function TagList({ tags }: { tags: string[] }) {
  return (
    <ul className="tag-list" aria-label={zhCN.result.atAGlance}>
      {tags.map((tag) => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  );
}

function ResultList({ items }: { items: string[] }) {
  return (
    <ul className="result-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ResultIdentity({ label, title }: { label: string; title: string }) {
  return (
    <div className="compatibility-identity">
      <span>{label}</span>
      <strong>{title}</strong>
    </div>
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveHighlightFact(
  fact: ConfigFor<"highlight">["facts"][number],
  result: AssessmentResult
): { label: string; value: string } | undefined {
  if (fact.source === "custom") {
    return { label: fact.label, value: fact.value };
  }
  if (fact.source === "primary-title") {
    return result.primaryResult ? { label: fact.label ?? zhCN.result.primaryResult, value: result.primaryResult.title } : undefined;
  }
  if (fact.source === "top-ranking") {
    const ranking = result.rankings[0];
    return ranking ? { label: fact.label ?? zhCN.result.topRanking, value: `#${ranking.rank} ${ranking.title}` } : undefined;
  }
  if (fact.source === "match-percentage") {
    const primaryId = result.primaryResult?.id;
    const score = primaryId
      ? result.matches.find((match) => match.id === primaryId)?.similarity ??
        result.rankings.find((ranking) => ranking.id === primaryId)?.score
      : undefined;
    return score === undefined ? undefined : { label: fact.label ?? zhCN.result.match, value: `${score}%` };
  }
  if (fact.source === "dimension-count-high") {
    const count = result.dimensions.filter((dimension) => dimension.normalized >= fact.threshold).length;
    return { label: fact.label ?? zhCN.result.highDimensions, value: `${count} / ${result.dimensions.length}` };
  }
  return undefined;
}
