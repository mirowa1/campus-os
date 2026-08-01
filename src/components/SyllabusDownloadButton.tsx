"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  syllabusPath: string;
  fileName: string | null;
};

export function SyllabusDownloadButton({ syllabusPath, fileName }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: signedError } = await supabase.storage
        .from("syllabi")
        .createSignedUrl(syllabusPath, 60);
      if (signedError || !data?.signedUrl) {
        throw new Error(signedError?.message || "Could not create download link");
      }
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = fileName || "syllabus";
      a.rel = "noopener";
      a.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        className="btn btn-ghost text-sm"
        onClick={() => void onDownload()}
        disabled={loading}
      >
        {loading ? "Preparing…" : "Download syllabus"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
