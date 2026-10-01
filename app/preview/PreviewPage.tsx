import { Suspense, useMemo, useRef, useState, type DragEvent } from "react";
import { answerQuestion, canProceed, createRunnerSession, isComplete, nextQuestion, previousQuestion, progressPercent, type RunnerSession } from "../../engine/runner/runner";
import { scoreAssessment } from "../../engine/scoring/scorers";
import type { AssessmentResult } from "../../engine/result/types";
import type { AssessmentPackage } from "../../schema/assessmentSchema";
import { zhCN } from "../i18n/zh-CN";
import ResultPage from "../results/ResultPage";
import {
  createQuickPreviewResult,
  inferModel,
  loadPreviewPackageFromZip,
  previewZipLimits,
  runAcceptanceCase,
  runAcceptanceCases,
  type AcceptanceCaseRun,
  type PreviewPackageLoadResult
} from "./zipPreviewLoader";

type PreviewMode = "summary" | "runner" | "quick" | "acceptance";

interface PublishState {
  error?: string;
  existing?: boolean;
  pending?: boolean;
  result?: {
    commitSha?: string;
    commitUrl?: string;
    testId: string;
  };
}

export default function PreviewPage() {
  const [loadResult, setLoadResult] = useState<PreviewPackageLoadResult | undefined>();
  const [mode, setMode] = useState<PreviewMode>("summary");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedResult, setSelectedResult] = useState<AssessmentResult | undefined>();
  const [acceptanceRuns, setAcceptanceRuns] = useState<AcceptanceCaseRun[]>([]);
  const [publishSecret, setPublishSecret] = useState("");
  const [publishState, setPublishState] = useState<PublishState>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assessment = loadResult?.assessment;

  async function importZip(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    setLoadResult(loadPreviewPackageFromZip(bytes, file.size));
    setMode("summary");
    setSelectedResult(undefined);
    setAcceptanceRuns([]);
    setPublishState({});
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      void importZip(file);
    }
  }

  return (
    <main className="page preview-page">
      <header className="header">
        <p className="product-kicker">ZIP Test Previewer</p>
        <h1>Test Creator ZIP Preview</h1>
        <p>浏览器端解压并校验测试包；不会上传服务器，也不会写入 content/tests。</p>
      </header>

      <section
        className={`preview-dropzone ${isDragging ? "preview-dropzone--active" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <p>Drop a Test Creator ZIP here</p>
        <span>ZIP 最大 {Math.round(previewZipLimits.maxZipBytes / 1024 / 1024)} MB，浏览器本地解析</span>
        <input
          accept=".zip,application/zip,application/x-zip-compressed"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              void importZip(file);
            }
          }}
          ref={fileInputRef}
          type="file"
        />
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          选择 ZIP
        </button>
      </section>

      {loadResult ? <PackageSummary loadResult={loadResult} /> : null}
      {assessment && loadResult.schemaStatus === "pass" && loadResult.errors.length === 0 ? (
        <PublishPanel
          acceptanceCases={loadResult.acceptanceCases}
          assessment={assessment}
          publishSecret={publishSecret}
          publishState={publishState}
          setAcceptanceRuns={setAcceptanceRuns}
          setPublishSecret={setPublishSecret}
          setPublishState={setPublishState}
        />
      ) : null}

      {assessment ? (
        <nav className="preview-actions" aria-label="Preview actions">
          <button type="button" onClick={() => setMode("runner")}>
            正常做题
          </button>
          <button type="button" onClick={() => setMode("quick")}>
            快速预览结果
          </button>
          <button type="button" onClick={() => setMode("acceptance")}>
            Acceptance Cases
          </button>
        </nav>
      ) : null}

      {assessment && mode === "runner" ? <PreviewRunner assessment={assessment} /> : null}
      {assessment && mode === "quick" ? (
        <QuickResultPreview
          acceptanceCases={loadResult.acceptanceCases}
          assessment={assessment}
          selectedResult={selectedResult}
          setSelectedResult={setSelectedResult}
        />
      ) : null}
      {assessment && mode === "acceptance" ? (
        <AcceptanceCasesPanel
          acceptanceCases={loadResult.acceptanceCases}
          assessment={assessment}
          runs={acceptanceRuns}
          setRuns={setAcceptanceRuns}
        />
      ) : null}
    </main>
  );
}

function PublishPanel({
  acceptanceCases,
  assessment,
  publishSecret,
  publishState,
  setAcceptanceRuns,
  setPublishSecret,
  setPublishState
}: {
  acceptanceCases: PreviewPackageLoadResult["acceptanceCases"];
  assessment: AssessmentPackage;
  publishSecret: string;
  publishState: PublishState;
  setAcceptanceRuns: (runs: AcceptanceCaseRun[]) => void;
  setPublishSecret: (secret: string) => void;
  setPublishState: (state: PublishState) => void;
}) {
  async function publish(overwrite: boolean) {
    setPublishState({ pending: true });
    if (acceptanceCases.length > 0) {
      const runs = runAcceptanceCases(assessment, acceptanceCases);
      setAcceptanceRuns(runs);
      if (runs.some((run) => !run.passed)) {
        setPublishState({ error: "Acceptance Cases 未通过，请先修复测试。" });
        return;
      }
    }

    try {
      const response = await fetch("/api/admin/publish-test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${publishSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ assessment, overwrite })
      });
      const data = (await response.json().catch(() => ({}))) as {
        commitSha?: string;
        commitUrl?: string;
        existing?: boolean;
        testId?: string;
        error?: string;
      };

      if (response.status === 409 && data.existing) {
        setPublishState({ existing: true, error: "此 testId 已存在" });
        return;
      }
      if (!response.ok) {
        setPublishState({ error: data.error ?? "发布失败，请稍后重试。" });
        return;
      }

      setPublishState({
        result: {
          commitSha: data.commitSha,
          commitUrl: data.commitUrl,
          testId: data.testId ?? assessment.metadata.id
        }
      });
    } catch {
      setPublishState({ error: "发布失败，请检查网络后重试。" });
    }
  }

  return (
    <section className="preview-publish">
      <div>
        <p className="product-kicker">Publish</p>
        <h2>发布到正式站</h2>
        <p>仅发送已通过校验的 test.json；ZIP 和 GitHub token 不会进入浏览器。</p>
      </div>
      <label>
        <span>管理员发布密码</span>
        <input
          autoComplete="off"
          onChange={(event) => setPublishSecret(event.currentTarget.value)}
          placeholder="Publish secret"
          type="password"
          value={publishSecret}
        />
      </label>
      <div className="preview-actions">
        <button disabled={!publishSecret || publishState.pending} onClick={() => void publish(false)} type="button">
          {publishState.pending ? "发布中..." : "发布到正式站"}
        </button>
      </div>
      {publishState.existing ? (
        <div className="preview-publish__conflict">
          <p>此 testId 已存在</p>
          <button type="button" onClick={() => setPublishState({})}>
            取消
          </button>
          <button disabled={publishState.pending} type="button" onClick={() => void publish(true)}>
            更新现有测试
          </button>
        </div>
      ) : null}
      {publishState.error && !publishState.existing ? <p className="preview-publish__error">{publishState.error}</p> : null}
      {publishState.result ? (
        <div className="preview-publish__success">
          <h3>发布成功</h3>
          <p>Test: {assessment.metadata.title}</p>
          <p>ID: {assessment.metadata.id}</p>
          <p>Commit: {publishState.result.commitSha ? publishState.result.commitSha.slice(0, 7) : "GitHub 已提交"}</p>
          <p>GitHub 已提交</p>
          <p>Cloudflare Pages 正在自动部署</p>
          {publishState.result.commitUrl ? (
            <a href={publishState.result.commitUrl} rel="noreferrer" target="_blank">
              查看 Commit
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PackageSummary({ loadResult }: { loadResult: PreviewPackageLoadResult }) {
  const model = loadResult.assessment ? inferModel(loadResult.assessment) : inferModel(loadResult.rawPackage);
  const assessment = loadResult.assessment;
  return (
    <section className="preview-summary">
      <h2>Package Summary</h2>
      <dl>
        <div>
          <dt>Test title</dt>
          <dd>{assessment?.metadata.title ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt>test id</dt>
          <dd>{assessment?.metadata.id ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt>model</dt>
          <dd>{model}</dd>
        </div>
        <div>
          <dt>question count</dt>
          <dd>{assessment?.questions.length ?? 0}</dd>
        </div>
        <div>
          <dt>dimension / construct count</dt>
          <dd>{assessment?.dimensions.length ?? 0}</dd>
        </div>
        <div>
          <dt>result count</dt>
          <dd>{assessment?.results.catalog.length ?? 0}</dd>
        </div>
        <div>
          <dt>acceptance case count</dt>
          <dd>{loadResult.acceptanceCases.length}</dd>
        </div>
        <div>
          <dt>schema status</dt>
          <dd>{loadResult.schemaStatus === "pass" ? "PASS" : "FAIL"}</dd>
        </div>
      </dl>
      <MessageList title="warnings" items={loadResult.warnings} />
      <MessageList title="errors" items={loadResult.errors} tone="error" />
      {loadResult.designReport ? (
        <details className="preview-report">
          <summary>design-report.md</summary>
          <pre>{loadResult.designReport}</pre>
        </details>
      ) : null}
    </section>
  );
}

function PreviewRunner({ assessment }: { assessment: AssessmentPackage }) {
  const [session, setSession] = useState<RunnerSession>(() => createRunnerSession(assessment));
  const [result, setResult] = useState<AssessmentResult | undefined>();
  const question = assessment.questions[session.currentIndex];
  const selectedAnswer = question ? session.answers[question.id] : undefined;
  const isLastQuestion = session.currentIndex === assessment.questions.length - 1;

  if (result) {
    return (
      <PreviewResultFrame>
        <ResultPage
          assessment={assessment}
          assessmentTitle={assessment.metadata.title}
          blocks={assessment.presentation.blocks}
          result={result}
          shareCard={assessment.presentation.shareCard}
          theme={assessment.presentation.theme}
        />
      </PreviewResultFrame>
    );
  }

  return (
    <section className="runner">
      <div className="preview-badge">Preview Runner</div>
      <div className="progress" aria-label={zhCN.runner.progressLabel}>
        <span>{session.currentIndex + 1} / {assessment.questions.length}</span>
        <span>{progressPercent(assessment, session)}%</span>
      </div>
      <div className="progress-bar" aria-hidden="true">
        <div style={{ width: `${progressPercent(assessment, session)}%` }} />
      </div>
      <h2>{question.text}</h2>
      <div className="options">
        {question.options.map((option) => (
          <label className="option" key={option.id}>
            <input
              checked={selectedAnswer === option.id}
              name={question.id}
              onChange={() => setSession((current) => answerQuestion(current, question.id, option.id))}
              type="radio"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <div className="actions runner-actions">
        <button disabled={session.currentIndex === 0} onClick={() => setSession(previousQuestion)} type="button">
          {zhCN.common.previous}
        </button>
        {isLastQuestion ? (
          <button disabled={!isComplete(assessment, session)} onClick={() => setResult(scoreAssessment(assessment, session.answers))} type="button">
            {zhCN.common.submit}
          </button>
        ) : (
          <button disabled={!canProceed(assessment, session)} onClick={() => setSession((current) => nextQuestion(assessment, current))} type="button">
            {zhCN.common.next}
          </button>
        )}
      </div>
    </section>
  );
}

function QuickResultPreview({
  acceptanceCases,
  assessment,
  selectedResult,
  setSelectedResult
}: {
  acceptanceCases: PreviewPackageLoadResult["acceptanceCases"];
  assessment: AssessmentPackage;
  selectedResult?: AssessmentResult;
  setSelectedResult: (result: AssessmentResult) => void;
}) {
  return (
    <section className="preview-workspace">
      <div className="preview-result-list">
        <h2>快速预览结果</h2>
        {assessment.results.catalog.map((result) => (
          <button key={result.id} onClick={() => setSelectedResult(createQuickPreviewResult(assessment, result.id, acceptanceCases))} type="button">
            {result.title}
          </button>
        ))}
      </div>
      {selectedResult ? (
        <PreviewResultFrame>
          <ResultPage
            assessment={assessment}
            assessmentTitle={assessment.metadata.title}
            blocks={assessment.presentation.blocks}
            result={selectedResult}
            shareCard={assessment.presentation.shareCard}
            theme={assessment.presentation.theme}
          />
        </PreviewResultFrame>
      ) : null}
    </section>
  );
}

function AcceptanceCasesPanel({
  acceptanceCases,
  assessment,
  runs,
  setRuns
}: {
  acceptanceCases: ReturnType<typeof loadPreviewPackageFromZip>["acceptanceCases"];
  assessment: AssessmentPackage;
  runs: AcceptanceCaseRun[];
  setRuns: (runs: AcceptanceCaseRun[]) => void;
}) {
  const latestRun = runs.at(-1);
  if (acceptanceCases.length === 0) {
    return <section className="runner">ZIP 中没有 acceptance-cases.json。</section>;
  }
  return (
    <section className="preview-workspace">
      <div className="preview-result-list">
        <h2>Acceptance Cases</h2>
        <button type="button" onClick={() => setRuns(runAcceptanceCases(assessment, acceptanceCases))}>
          运行全部
        </button>
        {acceptanceCases.map((caseData) => (
          <button key={caseData.id} onClick={() => setRuns([...runs, runAcceptanceCase(assessment, caseData)])} type="button">
            {caseData.title}
          </button>
        ))}
      </div>
      <div className="preview-case-results">
        {runs.map((run) => (
          <article className={`preview-case ${run.passed ? "preview-case--pass" : "preview-case--fail"}`} key={`${run.caseData.id}-${run.actualResultId ?? run.error ?? "error"}`}>
            <strong>{run.caseData.title}</strong>
            <span>{run.passed ? "PASS" : "FAIL"}</span>
            <p>expected result: {run.caseData.expectedResultId}</p>
            <p>actual result: {run.actualResultId ?? run.error ?? "无结果"}</p>
          </article>
        ))}
      </div>
      {latestRun?.result ? (
        <PreviewResultFrame>
          <ResultPage
            assessment={assessment}
            assessmentTitle={assessment.metadata.title}
            blocks={assessment.presentation.blocks}
            result={latestRun.result}
            shareCard={assessment.presentation.shareCard}
            theme={assessment.presentation.theme}
          />
        </PreviewResultFrame>
      ) : null}
    </section>
  );
}

function PreviewResultFrame({ children }: { children: React.ReactNode }) {
  return (
    <section className="preview-result-frame">
      <div className="preview-badge">Preview</div>
      <Suspense fallback={<section className="runner">{zhCN.common.loadingResult}</section>}>{children}</Suspense>
    </section>
  );
}

function MessageList({ items, title, tone }: { items: string[]; title: string; tone?: "error" }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className={`preview-messages ${tone === "error" ? "preview-messages--error" : ""}`}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
