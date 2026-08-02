"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pdf } from "@react-pdf/renderer";
import {
  ResumePreviewPaper,
  type ContentUpdater,
  type ResumeContact,
} from "@/components/ResumePreviewPaper";
import { ResumePdfDocument } from "@/components/ResumePdfDocument";
import { createClient } from "@/lib/supabase/client";
import { buildResumeDocxBlob } from "@/lib/resume-docx";
import {
  normalizeTailoredResume,
  parseTailoredResume,
} from "@/lib/resume-validate";
import type { ResumeTemplateId, TailoredResumeContent } from "@/lib/types";

type Props = {
  resumeId: string;
  template: ResumeTemplateId;
  contact: ResumeContact;
  initialContent: TailoredResumeContent;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResumePreviewClient({
  resumeId,
  template,
  contact: initialContact,
  initialContent,
}: Props) {
  const router = useRouter();
  const [contact, setContact] = useState<ResumeContact>(initialContact);
  const [content, setContent] = useState(() =>
    normalizeTailoredResume(initialContent)
  );
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function onContactChange(patch: Partial<ResumeContact>) {
    setContact((prev) => ({ ...prev, ...patch }));
  }

  function onContentChange(updater: ContentUpdater) {
    setContent((prev) => normalizeTailoredResume(updater(prev)));
  }

  async function saveEdits() {
    setSaving(true);
    setError(null);
    setStatus(null);
    const supabase = createClient();
    const { error: contactError } = await supabase
      .from("resume_data")
      .update({
        full_name: contact.full_name,
        city: contact.city,
        state: contact.state,
        phone: contact.phone,
        work_email: contact.work_email,
        linkedin: contact.linkedin,
        professional_title: contact.professional_title,
      })
      .eq("resume_id", resumeId);
    if (contactError) {
      setSaving(false);
      setError(contactError.message);
      return;
    }
    const { error: updError } = await supabase
      .from("resumes")
      .update({
        generated_content: content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resumeId);
    setSaving(false);
    if (updError) {
      setError(updError.message);
      return;
    }
    setStatus("Edits saved.");
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
        content?: TailoredResumeContent;
      };
      if (!res.ok || !data.content) {
        setError(data.error || "Resume generation failed, please try again");
        setRegenerating(false);
        return;
      }
      try {
        const parsed = parseTailoredResume(data.content);
        setContent(normalizeTailoredResume(parsed));
        setStatus("Regenerated.");
      } catch {
        setError("Resume generation failed, please try again");
      }
      setRegenerating(false);
      router.refresh();
    } catch {
      setError("Resume generation failed, please try again");
      setRegenerating(false);
    }
  }

  function fileBase() {
    return (
      (contact.full_name || "Resume").trim().replace(/\s+/g, "_") || "Resume"
    );
  }

  async function downloadPdf() {
    setDownloading("pdf");
    setError(null);
    try {
      const blob = await pdf(
        <ResumePdfDocument
          template={template}
          contact={contact}
          content={content}
        />
      ).toBlob();
      downloadBlob(blob, `${fileBase()}_Resume.pdf`);
    } catch (err) {
      console.error(err);
      setError("PDF download failed. Please try again.");
    }
    setDownloading(null);
  }

  async function downloadDocx() {
    setDownloading("docx");
    setError(null);
    try {
      const blob = await buildResumeDocxBlob({
        template,
        contact,
        content,
      });
      downloadBlob(blob, `${fileBase()}_Resume.docx`);
    } catch (err) {
      console.error(err);
      setError("Word download failed. Please try again.");
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
            {saving ? "Saving…" : "Save edits"}
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

      <div className="overflow-x-auto overflow-y-visible rounded-2xl border border-[var(--line)] bg-[var(--bg-soft)] p-4 sm:p-8">
        <ResumePreviewPaper
          template={template}
          contact={contact}
          content={content}
          editable
          onContactChange={onContactChange}
          onContentChange={onContentChange}
        />
      </div>
    </div>
  );
}
