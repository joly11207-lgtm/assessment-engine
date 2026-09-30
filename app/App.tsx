import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { DiscoveryCategoryId } from "../engine/capabilities";
import { hasCompatibility, isValidResultIdParam } from "../engine/compatibility/compatibility";
import { canProceed, isComplete, progressPercent } from "../engine/runner/runner";
import { clearCompletedResult, loadCompletedResult, saveCompletedResult, type CompletedResultRecord } from "../engine/storage/completedResultStorage";
import { getAssessmentById, registeredAssessments } from "../registry/assessmentRegistry";
import { sessionKey, useAssessmentStore } from "../store/assessmentStore";
import { formatCopy, zhCN } from "./i18n/zh-CN";
import { siteConfig } from "./siteConfig";

const ResultPage = lazy(() => import("./results/ResultPage"));
const PreviewPage = lazy(() => import("./preview/PreviewPage"));

const categoryOrder: Array<DiscoveryCategoryId | "all"> = [
  "all",
  "personality",
  "love",
  "career",
  "interest",
  "city",
  "literature",
  "trending"
];

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/preview"
        element={
          <Suspense fallback={<main className="page"><p className="state-message">{zhCN.common.loadingAssessment}</p></main>}>
            <PreviewPage />
          </Suspense>
        }
      />
      <Route path="/test/:testId" element={<TestLandingPage />} />
      <Route path="/test/:testId/run" element={<AssessmentRunner />} />
      <Route path="/assessment/:testId" element={<LegacyAssessmentRedirect />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function HomePage() {
  const [category, setCategory] = useState<DiscoveryCategoryId | "all">("all");
  const featuredAssessments = registeredAssessments.filter((assessment) => assessment.metadata.discovery.featured);
  const visibleAssessments = registeredAssessments.filter(
    (assessment) => category === "all" || assessment.metadata.discovery.category === category
  );

  return (
    <main className="page home-page">
      <header className="product-hero">
        <p className="product-kicker">{siteConfig.tagline}</p>
        <h1>{siteConfig.name}</h1>
        <p>{siteConfig.description}</p>
      </header>

      <section className="home-section" aria-labelledby="featured-title">
        <div className="section-heading">
          <h2 id="featured-title">{zhCN.homepage.featured}</h2>
        </div>
        <div className="featured-list">
          {featuredAssessments.map((assessment) => (
            <TestCard assessment={assessment} featured key={assessment.metadata.id} />
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="all-tests-title">
        <div className="section-heading">
          <h2 id="all-tests-title">{zhCN.homepage.allTests}</h2>
        </div>
        <nav className="category-tabs" aria-label="测试分类">
          {categoryOrder.map((categoryId) => (
            <button
              aria-pressed={category === categoryId}
              key={categoryId}
              onClick={() => setCategory(categoryId)}
              type="button"
            >
              {zhCN.categories[categoryId]}
            </button>
          ))}
        </nav>
        <div className="list">
          {visibleAssessments.map((assessment) => (
            <TestCard assessment={assessment} key={assessment.metadata.id} />
          ))}
        </div>
      </section>
    </main>
  );
}

function TestCard({ assessment, featured = false }: { assessment: (typeof registeredAssessments)[number]; featured?: boolean }) {
  const discovery = assessment.metadata.discovery;
  return (
    <article className={`assessment-card cover-${discovery.coverStyle} ${featured ? "assessment-card--featured" : ""}`.trim()}>
      <div className="assessment-card__meta">
        <span>{zhCN.categories[discovery.category]}</span>
        <span>{formatCopy(zhCN.homepage.questionCount, { count: assessment.questions.length })}</span>
        <span>{formatCopy(zhCN.homepage.minutes, { minutes: discovery.estimatedMinutes })}</span>
      </div>
      {discovery.badge ? <p className="assessment-card__badge">{discovery.badge}</p> : null}
      <h3>{discovery.shortTitle}</h3>
      <p>{assessment.metadata.description}</p>
      <Link className="button" to={`/test/${assessment.metadata.id}`}>
        {zhCN.homepage.openTest}
      </Link>
    </article>
  );
}

function TestLandingPage() {
  const { testId } = useParams();
  const [searchParams] = useSearchParams();
  const assessment = testId ? getAssessmentById(testId) : undefined;
  const [completedRecord, setCompletedRecord] = useState<CompletedResultRecord | undefined>();
  const pairParam = safePairParam(assessment, searchParams.get("pair"));

  useEffect(() => {
    setCompletedRecord(assessment && !pairParam ? loadCompletedResult(assessment) : undefined);
  }, [assessment, pairParam]);

  if (!assessment) {
    return <NotFoundPage />;
  }

  const discovery = assessment.metadata.discovery;
  const runUrl = `/test/${assessment.metadata.id}/run${pairParam ? `?pair=${encodeURIComponent(pairParam)}` : ""}`;
  const canUseCompletedRecord = !pairParam && completedRecord;

  if (canUseCompletedRecord) {
    return (
      <main className="page">
        <Link className="link-button" to="/">
          {zhCN.common.backToTests}
        </Link>
        <Suspense fallback={<section className="runner">{zhCN.common.loadingResult}</section>}>
          <ResultPage
            assessment={assessment}
            assessmentTitle={assessment.metadata.title}
            blocks={assessment.presentation.blocks}
            result={completedRecord.result}
            shareCard={assessment.presentation.shareCard}
            theme={assessment.presentation.theme}
          />
        </Suspense>
      </main>
    );
  }

  return (
    <main className="page">
      <Link className="link-button" to="/">
        {zhCN.common.backToTests}
      </Link>
      <section className={`test-landing cover-${discovery.coverStyle}`}>
        <div className="test-landing__meta">
          <span>{zhCN.categories[discovery.category]}</span>
          <span>{formatCopy(zhCN.homepage.questionCount, { count: assessment.questions.length })}</span>
          <span>{formatCopy(zhCN.homepage.minutes, { minutes: discovery.estimatedMinutes })}</span>
        </div>
        {discovery.badge ? <p className="assessment-card__badge">{discovery.badge}</p> : null}
        <h1>{assessment.metadata.title}</h1>
        <p>{assessment.metadata.description}</p>
        {pairParam ? <p className="test-landing__preview">{zhCN.compatibility.inviteHint}</p> : null}
        {discovery.resultPreview ? <p className="test-landing__preview">{discovery.resultPreview}</p> : null}
        <Link className="button button--large" to={runUrl}>
          {pairParam ? zhCN.compatibility.inviteCta : zhCN.common.startNow}
        </Link>
      </section>
    </main>
  );
}

function AssessmentRunner() {
  const { testId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const assessment = testId ? getAssessmentById(testId) : undefined;
  const { sessions, results, startAssessment, restartAssessment, answer, previous, next, submit } = useAssessmentStore();
  const key = assessment ? sessionKey(assessment) : undefined;
  const session = key ? sessions[key] : undefined;

  useEffect(() => {
    if (assessment && !session) {
      startAssessment(assessment);
    }
  }, [assessment, session, startAssessment]);

  if (!assessment) {
    return <NotFoundPage />;
  }

  if (!session || !key) {
    return (
      <main className="page">
        <p className="state-message">{zhCN.common.loadingAssessment}</p>
      </main>
    );
  }

  const result = results[key];
  const pairParam = safePairParam(assessment, searchParams.get("pair"));
  const question = assessment.questions[session.currentIndex];
  const selectedAnswer = question ? session.answers[question.id] : undefined;
  const isLastQuestion = session.currentIndex === assessment.questions.length - 1;
  const progress = progressPercent(assessment, session);

  function restart() {
    if (!assessment) {
      return;
    }
    clearCompletedResult(assessment);
    restartAssessment(assessment);
    navigate(`/test/${assessment.metadata.id}/run`);
  }

  return (
    <main className="page">
      <button className="link-button" type="button" onClick={() => navigate(`/test/${assessment.metadata.id}`)}>
        {zhCN.common.backToTests}
      </button>
      <header className="header runner-header">
        <p className="product-kicker">{zhCN.categories[assessment.metadata.discovery.category]}</p>
        <h1>{assessment.metadata.title}</h1>
        <p>{assessment.metadata.description}</p>
      </header>

      {result ? (
        <>
          <div className="result-actions">
            <button type="button" onClick={restart}>
              {zhCN.common.retake}
            </button>
          </div>
          <Suspense fallback={<section className="runner">{zhCN.common.loadingResult}</section>}>
            <ResultPage
              assessment={assessment}
              assessmentTitle={assessment.metadata.title}
              blocks={assessment.presentation.blocks}
              inviteSourceResultId={pairParam}
              result={result}
              shareCard={assessment.presentation.shareCard}
              theme={assessment.presentation.theme}
            />
          </Suspense>
        </>
      ) : question ? (
        <section className="runner">
          <div className="progress" aria-label={zhCN.runner.progressLabel}>
            <span>{formatCopy(zhCN.runner.progress, { current: session.currentIndex + 1, total: assessment.questions.length })}</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar" aria-hidden="true">
            <div style={{ width: `${progress}%` }} />
          </div>

          <h2>{question.text}</h2>
          <div className="options">
            {question.options.map((option) => (
              <label className="option" key={option.id}>
                <input
                  type="radio"
                  name={question.id}
                  checked={selectedAnswer === option.id}
                  onChange={() => answer(assessment, question.id, option.id)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          <div className="actions runner-actions">
            <button type="button" onClick={() => previous(assessment)} disabled={session.currentIndex === 0}>
              {zhCN.common.previous}
            </button>
            {isLastQuestion ? (
              <button
                type="button"
                onClick={() => {
                  const completedResult = submit(assessment);
                  if (!pairParam) {
                    saveCompletedResult(assessment, session.answers, completedResult);
                  }
                }}
                disabled={!isComplete(assessment, session)}
              >
                {zhCN.common.submit}
              </button>
            ) : (
              <button type="button" onClick={() => next(assessment)} disabled={!canProceed(assessment, session)}>
                {zhCN.common.next}
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="runner">{zhCN.common.resultUnavailable}</section>
      )}
    </main>
  );
}

function safePairParam(assessment: (typeof registeredAssessments)[number] | undefined, pairParam: string | null) {
  if (!assessment || pairParam === null || !hasCompatibility(assessment) || !isValidResultIdParam(pairParam)) {
    return undefined;
  }
  return assessment.results.catalog.some((result) => result.id === pairParam) ? pairParam : undefined;
}

function LegacyAssessmentRedirect() {
  const { testId } = useParams();
  return <Navigate replace to={testId ? `/test/${testId}/run` : "/"} />;
}

function NotFoundPage() {
  return (
    <main className="page">
      <section className="runner">
        <h1>{zhCN.common.testNotFound}</h1>
        <p>{zhCN.common.invalidRoute}</p>
        <Link className="button" to="/">
          {zhCN.common.backToTests}
        </Link>
      </section>
    </main>
  );
}
