"use client";

import { useMemo, useState } from "react";
import { PaywallModal } from "@/components/PaywallModal";
import { UploadDropzone } from "@/components/UploadDropzone";

export type ClassToExcelPickerClass = {
  id: string;
  label: string;
  assessmentCount: number;
  meetingCount: number;
};

type Tab = "upload" | "classes";

type Props = {
  classes: ClassToExcelPickerClass[];
};

async function downloadFromResponse(
  res: Response,
  fallbackName: string
): Promise<"ok" | "paywall" | "error"> {
  if (res.status === 402) return "paywall";
  if (!res.ok) return "error";

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return "ok";
}

export function ClassToExcelPanel({ classes }: Props) {
  const [tab, setTab] = useState<Tab>("upload");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(classes.map((c) => c.id))
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const allSelected = useMemo(
    () => classes.length > 0 && selected.size === classes.length,
    [classes.length, selected.size]
  );

  function toggleClass(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (classes.length === 0) return prev;
      if (prev.size === classes.length) return new Set();
      return new Set(classes.map((c) => c.id));
    });
  }

  async function onUpload(file: File) {
    setError(null);
    setStatus(null);
    setLoading(true);

    const form = new FormData();
    form.append("file", file);

    try {
      setStatus("Reading and converting your syllabus…");
      const res = await fetch("/api/classtoexcel/convert", {
        method: "POST",
        body: form,
      });
      const result = await downloadFromResponse(res, "class-export.xlsx");
      if (result === "paywall") {
        setPaywallOpen(true);
        return;
      }
      if (result === "error") {
        setError("Could not convert that file. Try a different syllabus.");
        return;
      }
      setStatus("Download started.");
    } catch {
      setError("Could not convert that file. Try a different syllabus.");
    } finally {
      setLoading(false);
    }
  }

  async function onExportSelected() {
    if (selected.size === 0) return;

    setError(null);
    setStatus(null);
    setLoading(true);

    try {
      setStatus("Building your Excel workbook…");
      const res = await fetch("/api/classtoexcel/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classIds: Array.from(selected) }),
      });
      const result = await downloadFromResponse(
        res,
        "coursework-export.xlsx"
      );
      if (result === "paywall") {
        setPaywallOpen(true);
        return;
      }
      if (result === "error") {
        setError("Could not export your classes. Try again.");
        return;
      }
      setStatus("Download started.");
    } catch {
      setError("Could not export your classes. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mt-8 flex gap-2">
        <button
          type="button"
          className={`btn text-sm ${tab === "upload" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setTab("upload")}
        >
          Upload a syllabus
        </button>
        <button
          type="button"
          className={`btn text-sm ${tab === "classes" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setTab("classes")}
        >
          Use my classes
        </button>
      </div>

      {tab === "upload" ? (
        <div className="mt-8">
          <UploadDropzone
            onFile={onUpload}
            disabled={loading}
            title="Drop your syllabus here"
            hint="PDF, DOCX, or a photo. We'll extract assignments and schedule into Excel."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {classes.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No classes yet. Upload a syllabus from Coursework or use the
              upload tab above.
            </p>
          ) : (
            <>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={loading}
                />
                Select all
              </label>
              <ul className="surface divide-y divide-[var(--border)] rounded-2xl">
                {classes.map((cls) => (
                  <li key={cls.id} className="px-4 py-3">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected.has(cls.id)}
                        onChange={() => toggleClass(cls.id)}
                        disabled={loading}
                      />
                      <span>
                        <span className="font-medium">{cls.label}</span>
                        <span className="mt-1 block text-xs text-[var(--muted)]">
                          {cls.assessmentCount === 0
                            ? "No assignments yet"
                            : `${cls.assessmentCount} assignment${cls.assessmentCount === 1 ? "" : "s"}`}
                          {" · "}
                          {cls.meetingCount === 0
                            ? "No schedule yet"
                            : `${cls.meetingCount} meeting block${cls.meetingCount === 1 ? "" : "s"}`}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={loading || selected.size === 0}
                onClick={() => void onExportSelected()}
              >
                {loading ? "Exporting…" : "Download Excel"}
              </button>
            </>
          )}
        </div>
      )}

      {status && (
        <p className="mt-4 text-sm text-[var(--accent)]">{status}</p>
      )}
      {error && (
        <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>
      )}

      <PaywallModal
        open={paywallOpen}
        feature="classtoexcel"
        onClose={() => setPaywallOpen(false)}
      />
    </>
  );
}
