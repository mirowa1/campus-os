"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type Props = {
  initial: Profile;
  email: string;
};

export function ProfileForm({ initial, email }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.full_name ?? "");
  const [major, setMajor] = useState(initial.major ?? "");
  const [gradTerm, setGradTerm] = useState(initial.expected_grad_term ?? "");
  const [studentId, setStudentId] = useState(initial.student_id ?? "");
  const [avatarPath, setAvatarPath] = useState(initial.avatar_path);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadAvatar() {
      if (!avatarPath) {
        setAvatarUrl(null);
        return;
      }
      const supabase = createClient();
      const { data, error: signedError } = await supabase.storage
        .from("avatars")
        .createSignedUrl(avatarPath, 3600);
      if (!cancelled) {
        if (signedError) setAvatarUrl(null);
        else setAvatarUrl(data.signedUrl);
      }
    }
    void loadAvatar();
    return () => {
      cancelled = true;
    };
  }, [avatarPath]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setStatus(null);
    const supabase = createClient();
    const { error: updError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        major: major.trim() || null,
        expected_grad_term: gradTerm.trim() || null,
        student_id: studentId.trim() || null,
      })
      .eq("id", initial.id);
    setSaving(false);
    if (updError) {
      setError(updError.message);
      return;
    }
    setStatus("Profile saved.");
    router.refresh();
  }

  async function onAvatar(file: File | null) {
    if (!file) return;
    setError(null);
    setStatus(null);
    if (!AVATAR_TYPES.includes(file.type)) {
      setError("Use a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("Photo must be 2 MB or smaller.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";
    const path = `${initial.id}/avatar.${ext}`;

    const { error: upError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upError) {
      setUploading(false);
      setError(upError.message);
      return;
    }

    const { error: updError } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", initial.id);
    setUploading(false);
    if (updError) {
      setError(updError.message);
      return;
    }
    setAvatarPath(path);
    setStatus("Photo updated.");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="surface rounded-2xl p-6">
        <h2 className="font-heading text-xl">Photo</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Private to your account — stored in a locked avatars bucket.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[var(--line)] bg-[var(--bg-soft)]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs text-[var(--muted)]">None</span>
            )}
          </div>
          <div>
            <label className="btn btn-ghost cursor-pointer text-xs">
              {uploading ? "Uploading…" : "Upload photo"}
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploading}
                onChange={(e) => void onAvatar(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="mt-2 text-xs text-[var(--muted)]">Max 2 MB</p>
          </div>
        </div>
      </section>

      <form onSubmit={onSave} className="surface space-y-4 rounded-2xl p-6">
        <h2 className="font-heading text-xl">About you</h2>

        <div>
          <label className="label" htmlFor="email">
            School email
          </label>
          <input
            id="email"
            className="input opacity-70"
            value={email}
            readOnly
            disabled
          />
        </div>

        <div>
          <label className="label" htmlFor="full_name">
            Name
          </label>
          <input
            id="full_name"
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="label" htmlFor="major">
            Major / program
          </label>
          <input
            id="major"
            className="input"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            placeholder="e.g. Computer Information Systems"
          />
        </div>

        <div>
          <label className="label" htmlFor="grad">
            Expected graduation term
          </label>
          <input
            id="grad"
            className="input"
            value={gradTerm}
            onChange={(e) => setGradTerm(e.target.value)}
            placeholder="e.g. Spring 2027"
          />
        </div>

        <div>
          <label className="label" htmlFor="student_id">
            Student ID
          </label>
          <input
            id="student_id"
            className="input"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            autoComplete="off"
            placeholder="Private — only you can see this"
          />
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            Stored privately with owner-only access. Never shown on shared pages
            or public buckets.
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
        {status && (
          <p className="text-sm text-[var(--accent)]">{status}</p>
        )}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}
