"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  assertValidResumeHtml,
  wrapResumeDocument,
} from "@/lib/resume-html";
import type { ResumeTemplateId } from "@/lib/types";

type Props = {
  resumeId: string;
  template: ResumeTemplateId;
  initialHtml: string;
  fileBaseName: string;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResumeHtmlPreviewClient({
  resumeId,
  template,
  initialHtml,
  fileBaseName,
}: Props) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState(initialHtml);
  const [editable, setEditable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const enableEditing = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    doc.body.contentEditable = editable ? "true" : "false";
    doc.body.style.outline = "none";
    if (!doc.body.dataset.editBound) {
      doc.body.dataset.editBound = "1";
      doc.body.addEventListener("input", () => setDirty(true));
    }
  }, [editable]);

  useEffect(() => {
    setSrcDoc(initialHtml);
    setDirty(false);
  }, [initialHtml]);

  useEffect(() => {
    enableEditing();
  }, [srcDoc, enableEditing]);

  function readHtmlFromIframe(): string | null {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.documentElement) return null;
    const clone = doc.documentElement.cloneNode(true) as HTMLElement;
    const body = clone.querySelector("body");
    if (body) {
      body.removeAttribute("contenteditable");
      body.removeAttribute("data-edit-bound");
      body.style.removeProperty("outline");
    }
    const doctype = doc.doctype
      ? `<!DOCTYPE ${doc.doctype.name}>`
      : "<!DOCTYPE html>";
    return `${doctype}\n${clone.outerHTML}`;
  }

  async function saveEdits(): Promise<boolean> {
    const raw = readHtmlFromIframe();
    if (!raw) {
      setError("Could not read resume HTML from preview.");
      return false;
    }
    let html: string;
    try {
      html = wrapResumeDocument(assertValidResumeHtml(raw));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Resume HTML failed validation."
      );
      return false;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    const supabase = createClient();
    const { error: updError } = await supabase
      .from("resumes")
      .update({
        generated_html: html,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resumeId);
    setSaving(false);
    if (updError) {
      setError(updError.message);
      return false;
    }
    setSrcDoc(html);
    setDirty(false);
    setStatus("Edits saved.");
    return true;
  }

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/resume/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateChoice: template, resumeId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        html?: string;
      };
      if (!res.ok || !data.html) {
        setError(data.error || "Resume generation failed, please try again");
        setRegenerating(false);
        return;
      }
      setSrcDoc(data.html);
      setDirty(false);
      setStatus("Regenerated.");
      setRegenerating(false);
      router.refresh();
    } catch {
      setError("Resume generation failed, please try again");
      setRegenerating(false);
    }
  }

  function fileBase() {
    return (
      (fileBaseName || "Resume").trim().replace(/\s+/g, "_") || "Resume"
    );
  }

  async function downloadPdf() {
    setDownloading("pdf");
    setError(null);
    try {
      if (dirty) {
        const ok = await saveEdits();
        if (!ok) {
          setDownloading(null);
          return;
        }
      }
      const res = await fetch("/api/resume/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "PDF download failed");
      }
      const blob = await res.blob();
      downloadBlob(blob, `${fileBase()}_Resume.pdf`);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "PDF download failed. Please try again."
      );
    }
    setDownloading(null);
  }

  async function downloadDocx() {
    setDownloading("docx");
    setError(null);
    try {
      if (dirty) {
        const ok = await saveEdits();
        if (!ok) {
          setDownloading(null);
          return;
        }
      }
      const res = await fetch("/api/resume/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Word download failed");
      }
      const blob = await res.blob();
      downloadBlob(blob, `${fileBase()}_Resume.docx`);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Word download failed. Please try again."
      );
    }
    setDownloading(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl">Resume preview</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Template {template}. Click any text to edit. Save edits to keep
            changes. We only used your intake data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => router.push("/resume/generate")}
          >
            Change template
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => setEditable((v) => !v)}
          >
            {editable ? "Lock editing" : "Unlock editing"}
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => void regenerate()}
            disabled={regenerating}
          >
            {regenerating ? "Regenerating…" : "Regenerate"}
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => void saveEdits()}
            disabled={saving}
          >
            {saving ? "Saving…" : dirty ? "Save edits*" : "Save edits"}
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => void downloadDocx()}
            disabled={downloading != null}
          >
            {downloading === "docx" ? "Preparing…" : "Download Word (.docx)"}
          </button>
          <button
            type="button"
            className="btn btn-primary text-xs"
            onClick={() => void downloadPdf()}
            disabled={downloading != null}
          >
            {downloading === "pdf" ? "Preparing…" : "Download PDF"}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <button
            type="button"
            className="btn btn-ghost mt-3 text-xs"
            onClick={() => void regenerate()}
            disabled={regenerating}
          >
            Retry
          </button>
        </div>
      )}
      {status && !error && (
        <p className="text-sm text-[var(--accent-cyan)]">{status}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
        <iframe
          ref={iframeRef}
          title="Resume preview"
          srcDoc={srcDoc}
          sandbox="allow-same-origin"
          className="block w-full bg-white"
          style={{ minHeight: "11in", height: "1100px" }}
          onLoad={enableEditing}
        />
      </div>
    </div>
  );
}
