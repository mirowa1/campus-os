"use client";

import { useState } from "react";
import { LETTER_OPTIONS, letterToPercent } from "@/lib/grades";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function TargetGradeForm({ classId }: { classId: string }) {
  const router = useRouter();
  const [letter, setLetter] = useState("B+");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: updError } = await supabase
      .from("classes")
      .update({
        target_letter: letter,
        target_percent: letterToPercent(letter),
      })
      .eq("id", classId);
    setSaving(false);
    if (updError) {
      setError(updError.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="target-letter">
          I want a
        </label>
        <select
          id="target-letter"
          className="input w-auto"
          value={letter}
          onChange={(e) => {
            setLetter(e.target.value);
            setSaved(false);
          }}
        >
          {LETTER_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={save}
        disabled={saving}
      >
        {saving ? "Saving…" : saved ? "Saved" : "Save target"}
      </button>
      {error && (
        <p className="w-full text-sm text-[var(--danger)]">{error}</p>
      )}
    </div>
  );
}
