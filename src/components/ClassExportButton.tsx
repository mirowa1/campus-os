"use client";

import { useState } from "react";
import { PaywallModal } from "@/components/PaywallModal";

export function ClassExportButton({ classId }: { classId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  async function exportClass() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/classtoexcel/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classIds: [classId] }),
      });

      if (res.status === 402) {
        setPaywallOpen(true);
        return;
      }

      if (!res.ok) {
        setError("Export failed. Try again.");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "coursework-export.xlsx";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost mt-3 text-sm"
        disabled={loading}
        onClick={() => void exportClass()}
      >
        {loading ? "Exporting…" : "Export to Excel"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
      )}
      <PaywallModal
        open={paywallOpen}
        feature="classtoexcel"
        onClose={() => setPaywallOpen(false)}
      />
    </>
  );
}
