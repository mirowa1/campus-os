"use client";

import type { CourseMaterialRow, NoteRow } from "@/lib/types";

export const EXTRA_TEXT_MAX_CHARS = 50_000;

type Props = {
  materials: CourseMaterialRow[];
  notes: NoteRow[];
  selectedMaterialIds: string[];
  selectedNoteIds: string[];
  extraText: string;
  extraFile: File | null;
  onMaterialIdsChange: (ids: string[]) => void;
  onNoteIdsChange: (ids: string[]) => void;
  onExtraTextChange: (text: string) => void;
  onExtraFileChange: (file: File | null) => void;
};

function toggleId(
  id: string,
  list: string[],
  setList: (next: string[]) => void
) {
  setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
}

export function SourcePicker({
  materials,
  notes,
  selectedMaterialIds,
  selectedNoteIds,
  extraText,
  extraFile,
  onMaterialIdsChange,
  onNoteIdsChange,
  onExtraTextChange,
  onExtraFileChange,
}: Props) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Uploaded materials
        </p>
        {materials.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            No uploaded materials yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {materials.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedMaterialIds.includes(m.id)}
                    onChange={() =>
                      toggleId(
                        m.id,
                        selectedMaterialIds,
                        onMaterialIdsChange
                      )
                    }
                  />
                  <span>
                    <span className="font-medium">{m.file_name}</span>
                    <span className="block text-xs text-[var(--muted)]">
                      {m.mime_type}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Class notes
        </p>
        {notes.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            No notes yet. Create titled notes above to select them here.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {notes.map((n) => (
              <li key={n.id}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedNoteIds.includes(n.id)}
                    onChange={() =>
                      toggleId(n.id, selectedNoteIds, onNoteIdsChange)
                    }
                  />
                  <span>
                    <span className="font-medium">{n.title}</span>
                    <span className="block text-xs text-[var(--muted)] line-clamp-1">
                      {n.body.trim() || "(empty)"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="label" htmlFor="source-extra-text">
          Paste additional content
        </label>
        <textarea
          id="source-extra-text"
          className="input min-h-[100px] resize-y font-mono text-sm"
          value={extraText}
          maxLength={EXTRA_TEXT_MAX_CHARS}
          onChange={(e) => onExtraTextChange(e.target.value)}
          placeholder="Paste excerpts, lecture notes, or key passages…"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          {extraText.length.toLocaleString()} /{" "}
          {EXTRA_TEXT_MAX_CHARS.toLocaleString()} characters
        </p>
      </div>

      <div>
        <label className="label" htmlFor="source-extra-file">
          Or attach a file (not saved to materials)
        </label>
        <input
          id="source-extra-file"
          type="file"
          className="block w-full text-sm text-[var(--muted)]"
          accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,image/jpeg,image/png,image/webp,image/gif,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => onExtraFileChange(e.target.files?.[0] ?? null)}
        />
        {extraFile && (
          <p className="mt-1 text-xs text-[var(--accent)]">
            Attached: {extraFile.name}
          </p>
        )}
      </div>
    </div>
  );
}
