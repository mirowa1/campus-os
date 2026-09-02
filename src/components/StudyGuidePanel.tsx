"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import React from "react";
import { SourcePicker, EXTRA_TEXT_MAX_CHARS } from "@/components/SourcePicker";
import type {
  CourseMaterialRow,
  NoteRow,
  StudyGuideRow,
} from "@/lib/types";

type Props = {
  classId: string;
  classLabel: string;
  materials: CourseMaterialRow[];
  notes: NoteRow[];
  initialGuide: StudyGuideRow | null;
};

function defaultStudyGuideTitle() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `Study Guide — ${yyyy}-${mm}-${dd}`;
}

export function StudyGuidePanel({
  classId,
  classLabel,
  materials,
  notes,
  initialGuide,
}: Props) {
  const router = useRouter();
  const [guide, setGuide] = useState(initialGuide);
  const [picking, setPicking] = useState(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [extraText, setExtraText] = useState("");
  const [extraFile, setExtraFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saveTitlePrompt, setSaveTitlePrompt] = useState(false);
  const [saveTitle, setSaveTitle] = useState(defaultStudyGuideTitle());
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const canConfirm = useMemo(() => {
    if (selectedMaterialIds.length > 0) return true;
    if (selectedNoteIds.length > 0) return true;
    if (extraText.trim().length > 0) return true;
    if (extraFile) return true;
    return false;
  }, [selectedMaterialIds, selectedNoteIds, extraText, extraFile]);

  function openPicker() {
    setError(null);
    setSaveMsg(null);
    setPicking(true);
    setSelectedMaterialIds([]);
    setSelectedNoteIds([]);
    setExtraText("");
    setExtraFile(null);
  }

  async function confirmGenerate() {
    setError(null);
    setSaveMsg(null);
    if (!canConfirm) {
      setError("Select at least one source: materials, notes, paste, or a file.");
      return;
    }
    if (extraText.length > EXTRA_TEXT_MAX_CHARS) {
      setError(
        `Pasted text is too long. Max ${EXTRA_TEXT_MAX_CHARS.toLocaleString()} characters.`
      );
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("materialIds", JSON.stringify(selectedMaterialIds));
      form.append("noteIds", JSON.stringify(selectedNoteIds));
      if (extraText.trim()) form.append("extraText", extraText);
      if (extraFile) form.append("extraFile", extraFile);

      const res = await fetch(`/api/classes/${classId}/study-guide`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate failed");
      setGuide(data.studyGuide as StudyGuideRow);
      setPicking(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setLoading(false);
    }
  }

  function openSaveTitlePrompt() {
    if (!guide) return;
    setError(null);
    setSaveMsg(null);
    setSaveTitle(defaultStudyGuideTitle());
    setSaveTitlePrompt(true);
  }

  function cancelSaveTitlePrompt() {
    setSaveTitlePrompt(false);
  }

  async function confirmSaveToNotes() {
    if (!guide) return;
    const title = saveTitle.trim();
    if (!title) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    try {
      const res = await fetch(
        `/api/classes/${classId}/study-guide/save-to-notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studyGuideId: guide.id, title }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaveTitlePrompt(false);
      setSaveMsg(`Saved as a new note: “${data.note.title}”.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    if (!guide) return;
    setDownloading(true);
    setError(null);
    try {
      const [{ pdf }, { StudyGuidePdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/StudyGuidePdfDocument"),
      ]);
      const blob = await pdf(
        React.createElement(StudyGuidePdfDocument, {
          classLabel,
          generatedAt: guide.created_at,
          content: guide.content,
        }) as React.ReactElement
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safe = classLabel.replace(/[^\w.-]+/g, "_").slice(0, 40) || "Class";
      a.href = url;
      a.download = `${safe}_Study_Guide.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="surface rounded-2xl p-6">
      <h2 className="font-heading text-2xl">Study guide</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Pick your sources, then generate. The AI only uses what you select — it
        won&apos;t invent content that isn&apos;t there.
      </p>

      {!picking ? (
        <button
          type="button"
          className="btn btn-primary mt-5"
          disabled={loading}
          onClick={openPicker}
        >
          Generate study guide
        </button>
      ) : (
        <div className="mt-5 space-y-5 rounded-xl border border-[var(--line)] bg-[var(--bg)]/40 p-4">
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || !canConfirm}
              onClick={() => void confirmGenerate()}
            >
              {loading ? "Generating…" : "Confirm & generate"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={loading}
              onClick={() => setPicking(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
      )}
      {saveMsg && (
        <p className="mt-3 text-sm text-[var(--accent)]">{saveMsg}</p>
      )}

      {guide && (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--muted)]">
              Generated {guide.created_at.slice(0, 19).replace("T", " ")}
            </p>
            {!saveTitlePrompt && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  disabled={downloading}
                  onClick={() => void downloadPdf()}
                >
                  {downloading ? "Preparing…" : "Download PDF"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  disabled={saving}
                  onClick={openSaveTitlePrompt}
                >
                  Save to Notes
                </button>
              </div>
            )}
          </div>

          {saveTitlePrompt && (
            <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3">
              <label className="label" htmlFor="sg-note-title">
                Title for new note
              </label>
              <input
                id="sg-note-title"
                className="input"
                autoFocus
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void confirmSaveToNotes();
                  }
                  if (e.key === "Escape") cancelSaveTitlePrompt();
                }}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary text-xs"
                  disabled={saving}
                  onClick={() => void confirmSaveToNotes()}
                >
                  {saving ? "Saving…" : "Save as new note"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  disabled={saving}
                  onClick={cancelSaveTitlePrompt}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--bg)] p-4 text-sm leading-relaxed">
            {guide.content}
          </pre>
        </div>
      )}
    </section>
  );
}
