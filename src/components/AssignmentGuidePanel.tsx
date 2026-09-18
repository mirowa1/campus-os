"use client";

import { useMemo, useState } from "react";
import { UploadDropzone } from "@/components/UploadDropzone";
import {
  ASSIGNMENT_GUIDE_REMINDER,
  type AssignmentGuide,
  type AssignmentGuideTone,
  type DiagnosticAnswer,
  type DiagnosticQuestion,
  type FollowUpResponse,
  type SelfCheckQuestion,
} from "@/lib/assignment-guide-shared";

type Step = "input" | "diagnostic" | "guide";

const TONE_OPTIONS: { value: AssignmentGuideTone; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "encouraging", label: "Encouraging" },
  { value: "direct", label: "Direct" },
];

function Section({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="font-heading text-xl">{title}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--foreground)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function AssignmentGuidePanel() {
  const [step, setStep] = useState<Step>("input");
  const [pastedText, setPastedText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [courseName, setCourseName] = useState("");
  const [professorName, setProfessorName] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [tone, setTone] = useState<AssignmentGuideTone>("neutral");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [guide, setGuide] = useState<AssignmentGuide | null>(null);
  const [selfCheck, setSelfCheck] = useState<SelfCheckQuestion[]>([]);
  const [selfCheckAnswers, setSelfCheckAnswers] = useState<
    Record<string, string>
  >({});
  const [selfCheckRevealed, setSelfCheckRevealed] = useState<
    Record<string, boolean>
  >({});
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [lastDiagnosticAnswers, setLastDiagnosticAnswers] = useState<
    DiagnosticAnswer[]
  >([]);
  const [assignmentContext, setAssignmentContext] = useState("");
  const [explanationFollowUpsUsed, setExplanationFollowUpsUsed] = useState(0);
  const [conceptsAcknowledged, setConceptsAcknowledged] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const metaPayload = useMemo(
    () => ({
      courseName: courseName.trim() || undefined,
      professorName: professorName.trim() || undefined,
      extraContext: extraContext.trim() || undefined,
      tone,
    }),
    [courseName, professorName, extraContext, tone]
  );

  async function runDiagnose(opts: { file?: File; text?: string }) {
    setError(null);
    setQuestions([]);
    setAnswers({});
    setGuide(null);
    setSelfCheck([]);
    setSelfCheckAnswers({});
    setSelfCheckRevealed({});
    setCurrentExampleIndex(0);
    setLastDiagnosticAnswers([]);
    setAssignmentContext("");
    setExplanationFollowUpsUsed(0);
    setConceptsAcknowledged(false);
    setFollowUpError(null);
    setLoading(true);

    try {
      let res: Response;
      if (opts.file) {
        const form = new FormData();
        form.append("file", opts.file);
        if (opts.text?.trim()) form.append("text", opts.text.trim());
        if (metaPayload.courseName) {
          form.append("courseName", metaPayload.courseName);
        }
        if (metaPayload.professorName) {
          form.append("professorName", metaPayload.professorName);
        }
        if (metaPayload.extraContext) {
          form.append("extraContext", metaPayload.extraContext);
        }
        form.append("tone", metaPayload.tone);
        res = await fetch("/api/assignment-guide/diagnose", {
          method: "POST",
          body: form,
        });
      } else {
        res = await fetch("/api/assignment-guide/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: opts.text,
            ...metaPayload,
          }),
        });
      }

      const data = (await res.json()) as {
        questions?: DiagnosticQuestion[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not create diagnostic questions.");
        return;
      }
      if (!data.questions || data.questions.length < 2) {
        setError("Could not create diagnostic questions.");
        return;
      }
      setQuestions(data.questions);
      setStep("diagnostic");
    } catch {
      setError("Could not create diagnostic questions.");
    } finally {
      setLoading(false);
    }
  }

  async function runGenerate(diagnosticAnswers: DiagnosticAnswer[]) {
    setError(null);
    setLoading(true);
    try {
      let res: Response;
      if (pendingFile) {
        const form = new FormData();
        form.append("file", pendingFile);
        if (pastedText.trim()) form.append("text", pastedText.trim());
        if (metaPayload.courseName) {
          form.append("courseName", metaPayload.courseName);
        }
        if (metaPayload.professorName) {
          form.append("professorName", metaPayload.professorName);
        }
        if (metaPayload.extraContext) {
          form.append("extraContext", metaPayload.extraContext);
        }
        form.append("tone", metaPayload.tone);
        form.append("diagnosticAnswers", JSON.stringify(diagnosticAnswers));
        res = await fetch("/api/assignment-guide/generate", {
          method: "POST",
          body: form,
        });
      } else {
        res = await fetch("/api/assignment-guide/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: pastedText.trim(),
            ...metaPayload,
            diagnosticAnswers,
          }),
        });
      }

      const data = (await res.json()) as {
        guide?: AssignmentGuide;
        selfCheck?: SelfCheckQuestion[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not generate a guide. Try again.");
        return;
      }
      if (!data.guide) {
        setError("Could not generate a guide. Try again.");
        return;
      }
      setGuide(data.guide);
      setSelfCheck(data.selfCheck ?? []);
      setSelfCheckAnswers({});
      setSelfCheckRevealed({});
      setCurrentExampleIndex(0);
      setLastDiagnosticAnswers(diagnosticAnswers);
      setAssignmentContext(
        pastedText.trim() ||
          (pendingFile ? `Uploaded assignment file: ${pendingFile.name}` : "")
      );
      setExplanationFollowUpsUsed(0);
      setConceptsAcknowledged(false);
      setFollowUpError(null);
      setStep("guide");
    } catch {
      setError("Could not generate a guide. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onUpload(file: File) {
    setPendingFile(file);
    await runDiagnose({ file, text: pastedText });
  }

  async function onContinueFromInput() {
    if (!pastedText.trim() && !pendingFile) {
      setError("Paste an assignment prompt or upload a file.");
      return;
    }
    await runDiagnose({
      file: pendingFile ?? undefined,
      text: pastedText.trim() || undefined,
    });
  }

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function collectAnswers(skipAll: boolean): DiagnosticAnswer[] {
    return questions.map((q) => ({
      questionId: q.id,
      value: skipAll ? "" : (answers[q.id] ?? "").trim(),
    }));
  }

  async function requestFollowUp() {
    if (!guide) return;
    setFollowUpError(null);
    setFollowUpLoading(true);
    try {
      const res = await fetch("/api/assignment-guide/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "alternate_explanation",
          originalGuide: guide,
          diagnosticAnswers: lastDiagnosticAnswers,
          assignmentContext,
        }),
      });
      const data = (await res.json()) as FollowUpResponse & { error?: string };
      if (!res.ok) {
        setFollowUpError(data.error || "Follow-up failed. Try again.");
        return;
      }
      if (!("keyConcepts" in data) || !Array.isArray(data.keyConcepts)) {
        setFollowUpError("Unexpected follow-up response.");
        return;
      }
      setGuide((prev) =>
        prev
          ? {
              ...prev,
              reminder: data.reminder || prev.reminder,
              keyConcepts: data.keyConcepts,
            }
          : prev
      );
      setExplanationFollowUpsUsed((n) => n + 1);
    } catch {
      setFollowUpError("Follow-up failed. Try again.");
    } finally {
      setFollowUpLoading(false);
    }
  }

  function resetSessionToInput() {
    setStep("input");
    setGuide(null);
    setSelfCheck([]);
    setSelfCheckAnswers({});
    setSelfCheckRevealed({});
    setCurrentExampleIndex(0);
    setLastDiagnosticAnswers([]);
    setAssignmentContext("");
    setExplanationFollowUpsUsed(0);
    setConceptsAcknowledged(false);
    setFollowUpError(null);
    setQuestions([]);
    setAnswers({});
    setError(null);
  }

  if (step === "guide" && guide) {
    const we = guide.workedExample;
    const examples = we.examples ?? [];
    const showExamples = we.applicable && examples.length > 0;
    const currentExample = showExamples
      ? examples[Math.min(currentExampleIndex, examples.length - 1)]
      : null;
    const onLastExample =
      showExamples && currentExampleIndex >= examples.length - 1;
    const explanationCapReached = explanationFollowUpsUsed >= 2;

    return (
      <div className="mt-8 space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-3 text-sm font-medium leading-relaxed">
            {guide.reminder || ASSIGNMENT_GUIDE_REMINDER}
          </p>

          <Section title="What's being asked" items={guide.whatsBeingAsked} />
          <Section title="Key concepts involved" items={guide.keyConcepts} />
          <Section
            title="Suggested approach / outline"
            items={guide.suggestedOutline}
          />

          {showExamples && currentExample ? (
            <section className="mt-8">
              <h2 className="font-heading text-xl">
                Worked examples of the method
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Analogous practice problems — different from your assignment.
                Use the pattern; don&apos;t copy into a submission.
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Example {currentExampleIndex + 1} of {examples.length}
              </p>
              <p className="mt-3 text-sm font-medium">{currentExample.title}</p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                {currentExample.steps.map((stepItem, i) => (
                  <li key={`${currentExampleIndex}-${i}-${stepItem.slice(0, 24)}`}>
                    {stepItem}
                  </li>
                ))}
              </ol>
              <div className="mt-4">
                <button
                  type="button"
                  className="btn btn-ghost text-sm"
                  disabled={onLastExample}
                  onClick={() =>
                    setCurrentExampleIndex((i) =>
                      Math.min(i + 1, examples.length - 1)
                    )
                  }
                >
                  {onLastExample
                    ? "That's all the examples for this one"
                    : "Show me another example"}
                </button>
              </div>
            </section>
          ) : null}

          <Section title="Things to watch out for" items={guide.watchOutFor} />

          {!conceptsAcknowledged ? (
            <div className="mt-8 space-y-2 border-t border-[var(--border)] pt-6">
              <p className="text-sm font-medium">Does this guide make sense?</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  onClick={() => setConceptsAcknowledged(true)}
                  disabled={followUpLoading}
                >
                  This makes sense
                </button>
                {explanationCapReached ? (
                  <p className="text-sm text-[var(--muted)]">
                    You&apos;ve used all your re-explanations for this session.
                  </p>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost text-sm"
                    onClick={() => requestFollowUp()}
                    disabled={followUpLoading}
                  >
                    {followUpLoading
                      ? "Working…"
                      : "Explain this differently."}
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {conceptsAcknowledged && selfCheck.length > 0 ? (
            <section className="mt-8 space-y-4 border-t border-[var(--border)] pt-6">
              <div>
                <h2 className="font-heading text-xl">Self-check</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Answer in your own words — this is for you, not a graded quiz.
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {
                    Object.keys(selfCheckRevealed).filter(
                      (id) => selfCheckRevealed[id]
                    ).length
                  }{" "}
                  of {selfCheck.length} self-check questions answered
                </p>
              </div>

              {selfCheck.map((q) => {
                const revealed = Boolean(selfCheckRevealed[q.id]);
                const answer = selfCheckAnswers[q.id] ?? "";

                if (q.type === "multiple_choice" && q.options) {
                  return (
                    <div
                      key={q.id}
                      className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4"
                    >
                      <p className="text-sm font-medium">{q.prompt}</p>
                      <div className="mt-3 space-y-2">
                        {q.options.map((opt) => {
                          const selected = answer === opt;
                          return (
                            <label
                              key={opt}
                              className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm ${
                                selected
                                  ? "bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/40"
                                  : ""
                              }`}
                            >
                              <input
                                type="radio"
                                name={`selfcheck-${q.id}`}
                                value={opt}
                                checked={selected}
                                onChange={() => {
                                  setSelfCheckAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: opt,
                                  }));
                                  setSelfCheckRevealed((prev) => ({
                                    ...prev,
                                    [q.id]: true,
                                  }));
                                }}
                                className="mt-1"
                              />
                              <span>
                                {opt}
                                {selected ? (
                                  <span className="ml-2 text-xs text-[var(--muted)]">
                                    (your pick)
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {revealed ? (
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          Noted.
                        </p>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <div
                    key={q.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4"
                  >
                    <p className="text-sm font-medium">{q.prompt}</p>
                    <textarea
                      className="mt-3 w-full min-h-[72px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                      value={answer}
                      onChange={(e) =>
                        setSelfCheckAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      placeholder="Write your thinking here…"
                      disabled={revealed}
                    />
                    {revealed ? (
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        ✓ Noted
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost mt-2 text-sm"
                        disabled={!answer.trim()}
                        onClick={() =>
                          setSelfCheckRevealed((prev) => ({
                            ...prev,
                            [q.id]: true,
                          }))
                        }
                      >
                        I&apos;ve written my answer
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          ) : null}

          {followUpError ? (
            <p className="mt-4 text-sm text-red-500" role="alert">
              {followUpError}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={resetSessionToInput}
        >
          Start over
        </button>
      </div>
    );
  }

  if (step === "diagnostic") {
    return (
      <div className="mt-8 space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
            Step 1 — Diagnostic
          </p>
          <h2 className="font-heading mt-2 text-2xl">
            Quick check before your guide
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Answer what you can — this shapes which parts of the guide get more
            depth. You can skip.
          </p>
        </div>

        {questions.map((q) => (
          <div
            key={q.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <label className="text-sm font-medium">
              {q.prompt}
              {q.optional ? (
                <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                  (optional)
                </span>
              ) : null}
            </label>
            {q.type === "multiple_choice" && q.options ? (
              <div className="mt-3 space-y-2">
                {q.options.map((opt) => (
                  <label
                    key={opt}
                    className="flex cursor-pointer items-start gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswer(q.id, opt)}
                      disabled={loading}
                      className="mt-1"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="mt-3 w-full min-h-[72px] rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                disabled={loading}
                placeholder="Short answer…"
              />
            )}
          </div>
        ))}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => runGenerate(collectAnswers(false))}
            disabled={loading}
          >
            {loading ? "Generating guide…" : "Continue"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => runGenerate(collectAnswers(true))}
            disabled={loading}
          >
            Skip diagnostics
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setStep("input");
              setQuestions([]);
              setAnswers({});
              setError(null);
            }}
            disabled={loading}
          >
            Back
          </button>
        </div>

        {error ? (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <UploadDropzone
        onFile={onUpload}
        disabled={loading}
        title="Drop the assignment here"
        hint="PDF, DOCX, or a photo of the prompt. Or paste text below."
      />
      {pendingFile ? (
        <p className="text-sm text-[var(--muted)]">
          File ready: <span className="font-medium">{pendingFile.name}</span>
        </p>
      ) : null}

      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          Or paste the assignment prompt
        </label>
        <textarea
          className="mt-2 w-full min-h-[140px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          disabled={loading}
          placeholder="Paste the assignment instructions here…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            Course name (optional)
          </label>
          <input
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            disabled={loading}
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            Professor (optional)
          </label>
          <input
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            value={professorName}
            onChange={(e) => setProfessorName(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          Extra context (optional)
        </label>
        <textarea
          className="mt-2 w-full min-h-[80px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          value={extraContext}
          onChange={(e) => setExtraContext(e.target.value)}
          disabled={loading}
          placeholder="e.g. length, rubric focus, what you're stuck on"
        />
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          Tone
        </label>
        <select
          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm sm:max-w-xs"
          value={tone}
          onChange={(e) => setTone(e.target.value as AssignmentGuideTone)}
          disabled={loading}
        >
          {TONE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={onContinueFromInput}
        disabled={loading || (!pastedText.trim() && !pendingFile)}
      >
        {loading ? "Preparing diagnostics…" : "Continue to diagnostics"}
      </button>

      {error ? (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
