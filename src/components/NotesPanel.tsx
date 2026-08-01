"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { NoteRow } from "@/lib/types";

type Props = {
  classId: string;
  initialNotes: NoteRow[];
};

type Draft = {
  id: string | null;
  title: string;
  body: string;
};

export function NotesPanel({ classId, initialNotes }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [titlePrompt, setTitlePrompt] = useState(false);
  const [pendingTitle, setPendingTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  function startNew() {
    setError(null);
    setTitlePrompt(false);
    setPendingTitle("");
    setDraft({ id: null, title: "", body: "" });
  }

  function openNote(note: NoteRow) {
    setError(null);
    setTitlePrompt(false);
    setPendingTitle("");
    setDraft({ id: note.id, title: note.title, body: note.body });
  }

  function cancelComposer() {
    setDraft(null);
    setTitlePrompt(false);
    setPendingTitle("");
    setError(null);
  }

  /** Cancel title prompt only — keep draft body so Save can be retried. */
  function cancelTitlePrompt() {
    setTitlePrompt(false);
    setPendingTitle("");
    setError(null);
  }

  async function persistNew(title: string) {
    if (!draft || draft.id) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("notes")
      .insert({
        class_id: classId,
        title: trimmed,
        body: draft.body,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    setSaving(false);
    if (insertError || !data) {
      setError(insertError?.message || "Failed to save note");
      return;
    }
    setNotes((prev) => [data as NoteRow, ...prev.filter((n) => n.id !== data.id)]);
    setDraft({ id: data.id, title: data.title, body: data.body });
    setTitlePrompt(false);
    setPendingTitle("");
    router.refresh();
  }

  async function saveExisting() {
    if (!draft?.id) return;
    const trimmed = draft.title.trim();
    if (!trimmed) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: updError } = await supabase
      .from("notes")
      .update({
        title: trimmed,
        body: draft.body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id)
      .eq("class_id", classId)
      .select()
      .single();
    setSaving(false);
    if (updError || !data) {
      setError(updError?.message || "Failed to update note");
      return;
    }
    setNotes((prev) =>
      prev
        .map((n) => (n.id === data.id ? (data as NoteRow) : n))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    );
    setDraft({ id: data.id, title: data.title, body: data.body });
    router.refresh();
  }

  function onSaveClick() {
    setError(null);
    if (!draft) return;
    if (!draft.id) {
      // New note: prompt for title; do not clear body if they cancel later
      setPendingTitle(pendingTitle || "");
      setTitlePrompt(true);
      return;
    }
    void saveExisting();
  }

  async function onDelete() {
    if (!draft?.id) return;
    if (!confirm(`Delete “${draft.title}”?`)) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: delError } = await supabase
      .from("notes")
      .delete()
      .eq("id", draft.id)
      .eq("class_id", classId);
    setSaving(false);
    if (delError) {
      setError(delError.message);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== draft.id));
    setDraft(null);
    router.refresh();
  }

  return (
    <section className="surface rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-2xl">Notes</h2>
        <button type="button" className="btn btn-ghost text-xs" onClick={startNew}>
          + New note
        </button>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Multiple titled notes per class. Save asks for a title on new notes.
      </p>

      <ul className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
        {notes.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-[var(--bg-soft)] ${
                draft?.id === n.id ? "bg-[var(--bg-soft)]" : ""
              }`}
              onClick={() => openNote(n)}
            >
              <span>
                <span className="font-medium">{n.title}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)] line-clamp-1">
                  {n.body.trim() || "(empty)"}
                </span>
              </span>
              <span className="shrink-0 text-[10px] text-[var(--muted)]">
                {n.updated_at.slice(0, 10)}
              </span>
            </button>
          </li>
        ))}
        {notes.length === 0 && !draft && (
          <li className="px-3 py-6 text-center text-sm text-[var(--muted)]">
            No notes yet. Create one to get started.
          </li>
        )}
      </ul>

      {draft && (
        <div className="mt-5 space-y-3 rounded-xl border border-[var(--line)] bg-[var(--bg)]/40 p-4">
          {draft.id ? (
            <div>
              <label className="label" htmlFor="note-title">
                Title
              </label>
              <input
                id="note-title"
                className="input"
                value={draft.title}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, title: e.target.value } : d))
                }
              />
            </div>
          ) : (
            <p className="text-sm font-medium text-[var(--accent)]">New note</p>
          )}

          <textarea
            className="input min-h-[160px] resize-y font-mono text-sm leading-relaxed"
            value={draft.body}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, body: e.target.value } : d))
            }
            placeholder="Lecture notes, questions, reminders…"
          />

          {titlePrompt && (
            <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3">
              <label className="label" htmlFor="new-note-title">
                Title for this note
              </label>
              <input
                id="new-note-title"
                className="input"
                autoFocus
                value={pendingTitle}
                onChange={(e) => setPendingTitle(e.target.value)}
                placeholder="e.g. Lecture 3 — joins"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void persistNew(pendingTitle);
                  }
                  if (e.key === "Escape") cancelTitlePrompt();
                }}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary text-xs"
                  disabled={saving}
                  onClick={() => void persistNew(pendingTitle)}
                >
                  {saving ? "Saving…" : "Save with title"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  disabled={saving}
                  onClick={cancelTitlePrompt}
                >
                  Cancel
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Cancel keeps your draft text — you can Save again anytime.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!titlePrompt && (
              <button
                type="button"
                className="btn btn-primary text-xs"
                disabled={saving}
                onClick={onSaveClick}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            )}
            {draft.id && (
              <button
                type="button"
                className="btn btn-ghost text-xs text-[var(--danger)]"
                disabled={saving}
                onClick={() => void onDelete()}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost text-xs"
              disabled={saving}
              onClick={cancelComposer}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
      )}
    </section>
  );
}
