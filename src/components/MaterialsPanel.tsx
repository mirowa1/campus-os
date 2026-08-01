"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadDropzone } from "@/components/UploadDropzone";
import type { CourseMaterialRow } from "@/lib/types";

type Props = {
  classId: string;
  initialMaterials: CourseMaterialRow[];
};

export function MaterialsPanel({ classId, initialMaterials }: Props) {
  const router = useRouter();
  const [materials, setMaterials] = useState(initialMaterials);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setStatus(null);
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`/api/classes/${classId}/materials`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setMaterials((prev) => [data.material as CourseMaterialRow, ...prev]);
      setStatus(`Uploaded ${file.name}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/classes/${classId}/materials?id=${id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Delete failed");
      return;
    }
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    router.refresh();
  }

  return (
    <section className="surface rounded-2xl p-6">
      <h2 className="font-heading text-2xl">Course materials</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Slides, readings, and notes for this class. Required before generating a
        study guide. Max 10 MB. PDF, DOCX, TXT, MD, or images.
      </p>

      <div className="mt-4">
        <UploadDropzone
          onFile={onFile}
          disabled={uploading}
          title="Drop course material"
          hint="PDF, DOCX, TXT, MD, or images — max 10 MB."
        />
      </div>

      {uploading && (
        <p className="mt-3 text-sm text-[var(--accent)]">Uploading…</p>
      )}
      {status && (
        <p className="mt-3 text-sm text-[var(--accent)]">{status}</p>
      )}
      {error && (
        <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
      )}

      <ul className="mt-5 divide-y divide-[var(--line)]">
        {materials.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-3 py-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{m.file_name}</p>
              <p className="text-xs text-[var(--muted)]">
                {m.mime_type} · {m.created_at.slice(0, 10)}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={() => void onDelete(m.id)}
            >
              Delete
            </button>
          </li>
        ))}
        {materials.length === 0 && (
          <li className="py-6 text-center text-sm text-[var(--muted)]">
            No materials uploaded yet.
          </li>
        )}
      </ul>
    </section>
  );
}
