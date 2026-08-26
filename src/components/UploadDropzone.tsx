"use client";

import { useCallback, useState } from "react";

type Props = {
  onFile: (file: File) => void;
  disabled?: boolean;
  title?: string;
  hint?: string;
  accept?: string;
};

const DEFAULT_ACCEPT =
  ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/jpeg,image/png,image/webp,image/gif";

export function UploadDropzone({
  onFile,
  disabled,
  title = "Drop your syllabus here",
  hint = "PDF, DOCX, or a photo of a printed syllabus. We'll extract assignments, exams, and grade weights.",
  accept = DEFAULT_ACCEPT,
}: Props) {
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
      className={`surface flex cursor-pointer flex-col items-center justify-center rounded-2xl border-dashed px-6 py-10 text-center transition ${
        dragging ? "dropzone-dragging" : ""
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        type="file"
        className="hidden"
        accept={accept}
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="font-heading text-xl">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">{hint}</p>
      <span className="btn btn-primary mt-4">Choose file</span>
    </label>
  );
}
