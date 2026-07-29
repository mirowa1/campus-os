"use client";

import { useCallback, useState } from "react";

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/gif";

type Props = {
  onFile: (file: File) => void;
  disabled?: boolean;
};

export function UploadDropzone({ onFile, disabled }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.[0] || disabled) return;
      onFile(files[0]);
    },
    [onFile, disabled]
  );

  return (
    <label
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`surface flex cursor-pointer flex-col items-center justify-center rounded-2xl border-dashed px-6 py-16 text-center transition ${
        dragging ? "border-[var(--accent)] bg-[var(--accent)]/5" : ""
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        type="file"
        className="hidden"
        accept={ACCEPT}
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="font-display text-2xl">Drop your syllabus here</p>
      <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
        PDF, DOCX, or a photo of a printed syllabus. We&apos;ll extract
        assignments, exams, and grade weights.
      </p>
      <span className="btn btn-primary mt-6">Choose file</span>
    </label>
  );
}
