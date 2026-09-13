"use client";

type Props = {
  title: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteAssessmentDialog({
  title,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-assessment-title"
    >
      <div className="surface w-full max-w-md rounded-2xl p-6 shadow-xl">
        <h2 id="delete-assessment-title" className="font-heading text-2xl">
          Delete this assessment?
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This permanently removes{" "}
          <span className="text-[var(--ink)]">{title}</span>. This cannot be
          undone.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-primary text-sm"
            style={{
              background: "var(--danger)",
              borderColor: "var(--danger)",
            }}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Deleting…" : "Delete assessment"}
          </button>
          <button
            type="button"
            className="btn btn-ghost text-sm"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
