"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteClassButton({
  classId,
  classLabel,
}: {
  classId: string;
  classLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/classes/${classId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Failed to delete class");
        setBusy(false);
        return;
      }
      router.push("/classes");
      router.refresh();
    } catch {
      setError("Failed to delete class");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost mt-4 text-sm text-[var(--danger)]"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Delete class
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-class-title"
        >
          <div className="surface w-full max-w-md rounded-2xl p-6 shadow-xl">
            <h2 id="delete-class-title" className="font-heading text-2xl">
              Delete this class?
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              This permanently removes{" "}
              <span className="text-[var(--ink)]">{classLabel}</span>, including
              assessments, notes, materials, study guides, quizzes, and any
              Google Calendar events synced for this class. This cannot be
              undone.
            </p>

            {error && (
              <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-primary text-sm"
                style={{
                  background: "var(--danger)",
                  borderColor: "var(--danger)",
                }}
                disabled={busy}
                onClick={() => void confirmDelete()}
              >
                {busy ? "Deleting…" : "Delete class"}
              </button>
              <button
                type="button"
                className="btn btn-ghost text-sm"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
