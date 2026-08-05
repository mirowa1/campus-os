"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SourcePicker, EXTRA_TEXT_MAX_CHARS } from "@/components/SourcePicker";
import type {
  CourseMaterialRow,
  FlashcardItem,
  NoteRow,
  QuizAnswerRecord,
  QuizAttemptRow,
  QuizMode,
  QuizQuestion,
  QuizSetRow,
} from "@/lib/types";

type SetWithAttempts = QuizSetRow & { attempts: QuizAttemptRow[] };

type Props = {
  classId: string;
  materials: CourseMaterialRow[];
  notes: NoteRow[];
  initialSets: SetWithAttempts[];
};

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "set"; setId: string }
  | {
      kind: "quizPlay";
      setId: string;
      attemptId: string;
      index: number;
      selected: number | null;
      revealed: boolean;
      answers: QuizAnswerRecord[];
    }
  | {
      kind: "quizSummary";
      setId: string;
      attemptId: string;
      answers: QuizAnswerRecord[];
      score: number;
      total: number;
    }
  | {
      kind: "flashPlay";
      setId: string;
      attemptId: string;
      index: number;
      flipped: boolean;
      known: number[];
    };

export function QuizFlashcardsPanel({
  classId,
  materials,
  notes,
  initialSets,
}: Props) {
  const router = useRouter();
  const [sets, setSets] = useState<SetWithAttempts[]>(initialSets);
  const [view, setView] = useState<View>({ kind: "list" });
  const [mode, setMode] = useState<QuizMode>("quiz");
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [extraText, setExtraText] = useState("");
  const [extraFile, setExtraFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = useMemo(() => {
    return (
      selectedMaterialIds.length > 0 ||
      selectedNoteIds.length > 0 ||
      extraText.trim().length > 0 ||
      Boolean(extraFile)
    );
  }, [selectedMaterialIds, selectedNoteIds, extraText, extraFile]);

  function findSet(id: string) {
    return sets.find((s) => s.id === id);
  }

  function openCreate() {
    setError(null);
    setMode("quiz");
    setSelectedMaterialIds([]);
    setSelectedNoteIds([]);
    setExtraText("");
    setExtraFile(null);
    setView({ kind: "create" });
  }

  async function generate() {
    setError(null);
    if (!canConfirm) {
      setError("Select at least one source.");
      return;
    }
    if (extraText.length > EXTRA_TEXT_MAX_CHARS) {
      setError(`Pasted text is too long.`);
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("mode", mode);
      form.append("materialIds", JSON.stringify(selectedMaterialIds));
      form.append("noteIds", JSON.stringify(selectedNoteIds));
      if (extraText.trim()) form.append("extraText", extraText);
      if (extraFile) form.append("extraFile", extraFile);
      const res = await fetch(`/api/classes/${classId}/quiz-sets`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate failed");
      const quizSet = data.quizSet as QuizSetRow;
      setSets((prev) => [{ ...quizSet, attempts: [] }, ...prev]);
      setView({ kind: "set", setId: quizSet.id });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setLoading(false);
    }
  }

  async function startAttempt(setId: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/classes/${classId}/quiz-sets/${setId}/attempts`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start attempt");
      const attempt = data.attempt as QuizAttemptRow;
      const set = findSet(setId);
      if (!set) throw new Error("Set not found");

      setSets((prev) =>
        prev.map((s) =>
          s.id === setId
            ? { ...s, attempts: [attempt, ...s.attempts] }
            : s
        )
      );

      if (set.mode === "quiz") {
        setView({
          kind: "quizPlay",
          setId,
          attemptId: attempt.id,
          index: 0,
          selected: null,
          revealed: false,
          answers: [],
        });
      } else {
        setView({
          kind: "flashPlay",
          setId,
          attemptId: attempt.id,
          index: 0,
          flipped: false,
          known: [],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function patchAttempt(
    setId: string,
    attemptId: string,
    body: Record<string, unknown>
  ) {
    const res = await fetch(
      `/api/classes/${classId}/quiz-sets/${setId}/attempts/${attemptId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Update failed");
    const attempt = data.attempt as QuizAttemptRow;
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? {
              ...s,
              attempts: s.attempts.map((a) =>
                a.id === attemptId ? attempt : a
              ),
            }
          : s
      )
    );
    return attempt;
  }

  function bestScore(s: SetWithAttempts): string | null {
    if (s.mode !== "quiz") return null;
    const scores = s.attempts
      .filter((a) => a.score != null && a.completed_at)
      .map((a) => Number(a.score));
    if (!scores.length) return null;
    const best = Math.max(...scores);
    const total = (s.content as QuizQuestion[]).length;
    return `${best}/${total}`;
  }

  function latestScore(s: SetWithAttempts): string | null {
    if (s.mode !== "quiz") return null;
    const done = s.attempts.find((a) => a.completed_at && a.score != null);
    if (!done) return null;
    const total = (s.content as QuizQuestion[]).length;
    return `${done.score}/${total}`;
  }

  // ——— Views ———

  if (view.kind === "create") {
    return (
      <section className="surface rounded-2xl p-6">
        <h2 className="font-heading text-2xl">New quiz / flashcards</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Grounded in your selected sources only — no invented content.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["quiz", "flashcard"] as QuizMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`btn text-xs ${mode === m ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMode(m)}
            >
              {m === "quiz" ? "Quiz" : "Flashcards"}
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--bg)]/40 p-4">
          <SourcePicker
            materials={materials}
            notes={notes}
            selectedMaterialIds={selectedMaterialIds}
            selectedNoteIds={selectedNoteIds}
            extraText={extraText}
            extraFile={extraFile}
            onMaterialIdsChange={setSelectedMaterialIds}
            onNoteIdsChange={setSelectedNoteIds}
            onExtraTextChange={setExtraText}
            onExtraFileChange={setExtraFile}
          />
        </div>
        {error && (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || !canConfirm}
            onClick={() => void generate()}
          >
            {loading ? "Generating…" : "Generate"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={loading}
            onClick={() => setView({ kind: "list" })}
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  if (view.kind === "set") {
    const set = findSet(view.setId);
    if (!set) {
      return (
        <section className="surface rounded-2xl p-6">
          <p className="text-sm text-[var(--danger)]">Set not found.</p>
          <button
            type="button"
            className="btn btn-ghost mt-3 text-xs"
            onClick={() => setView({ kind: "list" })}
          >
            Back
          </button>
        </section>
      );
    }
    const total = Array.isArray(set.content) ? set.content.length : 0;
    return (
      <section className="surface rounded-2xl p-6">
        <button
          type="button"
          className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          onClick={() => setView({ kind: "list" })}
        >
          ← All sets
        </button>
        <h2 className="font-heading mt-3 text-2xl">{set.title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {set.mode === "quiz" ? "Quiz" : "Flashcards"} · {total} items ·{" "}
          {set.created_at.slice(0, 10)}
        </p>

        {set.mode === "quiz" && (
          <div className="mt-5">
            <h3 className="text-sm font-medium">Attempt history</h3>
            {set.attempts.filter((a) => a.completed_at).length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">No attempts yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {set.attempts
                  .filter((a) => a.completed_at)
                  .map((a, i) => (
                    <li key={a.id} className="text-[var(--muted)]">
                      Attempt {set.attempts.filter((x) => x.completed_at).length - i}:{" "}
                      {a.score}/{total}
                      {" · "}
                      {a.completed_at?.slice(0, 16).replace("T", " ")}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
        )}

        <button
          type="button"
          className="btn btn-primary mt-5"
          disabled={loading}
          onClick={() => void startAttempt(set.id)}
        >
          {loading
            ? "Starting…"
            : set.mode === "quiz"
              ? set.attempts.some((a) => a.completed_at)
                ? "Retake"
                : "Start quiz"
              : "Start flashcards"}
        </button>
      </section>
    );
  }

  if (view.kind === "quizPlay") {
    const set = findSet(view.setId);
    const items = (set?.content ?? []) as QuizQuestion[];
    const q = items[view.index];
    if (!set || !q) {
      return (
        <section className="surface rounded-2xl p-6">
          <p className="text-sm text-[var(--danger)]">Question missing.</p>
        </section>
      );
    }

    const onCheck = async () => {
      setView((prev) => {
        if (prev.kind !== "quizPlay" || prev.selected == null) return prev;
        const current = (findSet(prev.setId)?.content ?? []) as QuizQuestion[];
        const question = current[prev.index];
        if (!question) return prev;
        const correct = prev.selected === question.correctIndex;
        return {
          ...prev,
          revealed: true,
          answers: [
            ...prev.answers,
            {
              questionIndex: prev.index,
              selectedIndex: prev.selected,
              correct,
            },
          ],
        };
      });
    };

    const onNext = async () => {
      if (view.kind !== "quizPlay") return;
      const nextIndex = view.index + 1;
      if (nextIndex >= items.length) {
        const score = view.answers.filter((a) => a.correct).length;
        await patchAttempt(view.setId, view.attemptId, {
          answers: view.answers,
          score,
          completed_at: new Date().toISOString(),
        });
        setView({
          kind: "quizSummary",
          setId: view.setId,
          attemptId: view.attemptId,
          answers: view.answers,
          score,
          total: items.length,
        });
        return;
      }
      setView((prev) =>
        prev.kind === "quizPlay"
          ? {
              ...prev,
              index: nextIndex,
              selected: null,
              revealed: false,
            }
          : prev
      );
    };

    return (
      <section className="surface rounded-2xl p-6">
        <p className="text-xs text-[var(--muted)]">
          Question {view.index + 1} of {items.length} · Score so far:{" "}
          {view.answers.filter((a) => a.correct).length}
        </p>
        <h2 className="font-heading mt-3 text-xl">{q.question}</h2>
        <ul className="mt-4 space-y-2">
          {q.options.map((opt, i) => {
            // Mutually exclusive border/bg classes — stacking border-[var(--line)]
            // with border-[var(--accent)] fails under Tailwind (CSS source order wins).
            const base =
              "w-full rounded-lg border px-3 py-2 text-left text-sm transition";
            let cls = `${base} border-[var(--line)]`;
            if (view.revealed) {
              if (i === q.correctIndex) {
                cls = `${base} border-[var(--accent)] bg-[var(--accent)]/15`;
              } else if (i === view.selected) {
                cls = `${base} border-[var(--danger)]/50 bg-[var(--danger)]/10`;
              } else {
                cls = `${base} border-[var(--line)] opacity-60`;
              }
            } else if (view.selected === i) {
              cls = `${base} border-[var(--accent)] bg-[var(--accent)]/20 ring-1 ring-[var(--accent)]`;
            } else {
              cls = `${base} border-[var(--line)] hover:border-[var(--muted)]`;
            }
            return (
              <li key={i}>
                <button
                  type="button"
                  className={cls}
                  disabled={view.revealed}
                  aria-pressed={view.selected === i}
                  onClick={() =>
                    setView((prev) =>
                      prev.kind === "quizPlay" && !prev.revealed
                        ? { ...prev, selected: i }
                        : prev
                    )
                  }
                >
                  {opt}
                </button>
              </li>
            );
          })}
        </ul>
        {view.revealed && q.explanation && (
          <p className="mt-3 text-sm text-[var(--muted)]">{q.explanation}</p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {!view.revealed ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={view.selected == null}
              onClick={() => void onCheck()}
            >
              Check answer
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onNext()}
            >
              {view.index + 1 >= items.length ? "See results" : "Next"}
            </button>
          )}
        </div>
      </section>
    );
  }

  if (view.kind === "quizSummary") {
    return (
      <section className="surface rounded-2xl p-6">
        <h2 className="font-heading text-2xl">Quiz results</h2>
        <p className="mt-2 text-lg">
          {view.score} / {view.total} correct
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {view.answers.map((a) => (
            <li
              key={a.questionIndex}
              className={
                a.correct ? "text-[var(--accent-cyan)]" : "text-[var(--danger)]"
              }
            >
              Q{a.questionIndex + 1}: {a.correct ? "Correct" : "Incorrect"}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void startAttempt(view.setId)}
          >
            Retake
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setView({ kind: "set", setId: view.setId })}
          >
            Back to set
          </button>
        </div>
      </section>
    );
  }

  if (view.kind === "flashPlay") {
    const set = findSet(view.setId);
    const cards = (set?.content ?? []) as FlashcardItem[];
    const card = cards[view.index];
    if (!set || !card) {
      return (
        <section className="surface rounded-2xl p-6">
          <p className="text-sm text-[var(--danger)]">Card missing.</p>
        </section>
      );
    }
    const isKnown = view.known.includes(view.index);

    const toggleKnown = async () => {
      if (view.kind !== "flashPlay") return;
      const next = isKnown
        ? view.known.filter((i) => i !== view.index)
        : [...view.known, view.index];
      setView({ ...view, known: next });
      await patchAttempt(view.setId, view.attemptId, {
        known_cards: next,
        completed_at:
          next.length === cards.length
            ? new Date().toISOString()
            : null,
      });
    };

    return (
      <section className="surface rounded-2xl p-6">
        <p className="text-xs text-[var(--muted)]">
          Card {view.index + 1} of {cards.length} · Known {view.known.length}
        </p>
        <button
          type="button"
          className="mt-4 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-6 py-16 text-center"
          onClick={() => setView({ ...view, flipped: !view.flipped })}
        >
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
            {view.flipped ? "Back" : "Front"} · click to flip
          </p>
          <p className="mt-3 text-lg">
            {view.flipped ? card.back : card.front}
          </p>
        </button>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost text-xs"
            disabled={view.index === 0}
            onClick={() =>
              setView({
                ...view,
                index: view.index - 1,
                flipped: false,
              })
            }
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            disabled={view.index >= cards.length - 1}
            onClick={() =>
              setView({
                ...view,
                index: view.index + 1,
                flipped: false,
              })
            }
          >
            Next
          </button>
          <button
            type="button"
            className="btn btn-primary text-xs"
            onClick={() => void toggleKnown()}
          >
            {isKnown ? "Still learning" : "Mark as known"}
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => setView({ kind: "set", setId: view.setId })}
          >
            Done
          </button>
        </div>
      </section>
    );
  }

  // list
  return (
    <section className="surface rounded-2xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl">Quizzes &amp; flashcards</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Generate from your materials and notes. Attempts are kept for
            history.
          </p>
        </div>
        <button type="button" className="btn btn-primary text-xs" onClick={openCreate}>
          + New quiz/flashcards
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
      )}

      {sets.length === 0 ? (
        <p className="mt-5 text-sm text-[var(--muted)]">
          No sets yet. Create a quiz or flashcard deck from your sources.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {sets.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full rounded-xl border border-[var(--line)] px-4 py-3 text-left transition hover:border-[var(--accent)]/40"
                onClick={() => setView({ kind: "set", setId: s.id })}
              >
                <span className="font-medium">{s.title}</span>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  {s.mode === "quiz" ? "Quiz" : "Flashcards"} ·{" "}
                  {s.created_at.slice(0, 10)}
                  {s.mode === "quiz" && latestScore(s)
                    ? ` · Latest ${latestScore(s)}${
                        bestScore(s) && bestScore(s) !== latestScore(s)
                          ? ` · Best ${bestScore(s)}`
                          : ""
                      }`
                    : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
