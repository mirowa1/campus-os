"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CERT_OTHER,
  MAJOR_OTHER,
  RESUME_MAJORS,
  certsForMajor,
  isListedMajor,
} from "@/lib/resume-certifications";
import {
  draftCompletenessPercent,
  emptyExperienceSlot,
  EXPERIENCE_SOFT_MAX,
  normalizeAchievements,
  normalizeCertifications,
  normalizeExperience,
  normalizeExtracurriculars,
  normalizeProjects,
  STEP_LABELS,
} from "@/lib/resume";
import { US_STATES, isValidStateCode } from "@/lib/us-states";
import type {
  ResumeCertification,
  ResumeDataRow,
  ResumeExperienceEntry,
  ResumeProjectEntry,
  ResumeRow,
} from "@/lib/types";

type Props = {
  resume: ResumeRow;
  initialData: ResumeDataRow;
};

function finalizeBullets(bullets: string[]): string[] {
  return bullets.map((l) => l.trim()).filter(Boolean);
}

function textToAchievements(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function initialMajorSelect(saved: string): string {
  if (!saved) return "";
  if (isListedMajor(saved)) return saved;
  return MAJOR_OTHER;
}

export function ResumeBuilder({ resume, initialData }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(
    Math.min(5, Math.max(1, resume.current_step || 1))
  );
  const [fullName, setFullName] = useState(initialData.full_name ?? "");
  const [state, setState] = useState(() => {
    const s = initialData.state ?? "";
    return isValidStateCode(s) ? s : "";
  });
  const [phone, setPhone] = useState(initialData.phone ?? "");
  const [workEmail, setWorkEmail] = useState(initialData.work_email ?? "");
  const [linkedin, setLinkedin] = useState(initialData.linkedin ?? "");
  const [professionalTitle, setProfessionalTitle] = useState(
    initialData.professional_title ?? ""
  );
  const [school, setSchool] = useState(initialData.school ?? "");
  const savedMajor = initialData.major ?? "";
  const [majorSelect, setMajorSelect] = useState(() =>
    initialMajorSelect(savedMajor)
  );
  const [customMajor, setCustomMajor] = useState(() =>
    isListedMajor(savedMajor) || !savedMajor ? "" : savedMajor
  );
  const [concentration, setConcentration] = useState(
    initialData.concentration ?? ""
  );
  const [minor, setMinor] = useState(initialData.minor ?? "");
  const [achievementsText, setAchievementsText] = useState(
    normalizeAchievements(initialData.achievements).join("\n")
  );
  const [certifications, setCertifications] = useState<ResumeCertification[]>(
    normalizeCertifications(initialData.certifications)
  );
  const [customCert, setCustomCert] = useState("");
  const [projects, setProjects] = useState<ResumeProjectEntry[]>(
    normalizeProjects(initialData.projects)
  );
  const [extrasText, setExtrasText] = useState(
    normalizeExtracurriculars(initialData.extracurriculars).join("\n")
  );
  const [experience, setExperience] = useState<ResumeExperienceEntry[]>(
    normalizeExperience(initialData.experience)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const resolvedMajor =
    majorSelect === MAJOR_OTHER ? customMajor.trim() : majorSelect.trim();
  const curatedCerts = useMemo(
    () => certsForMajor(resolvedMajor),
    [resolvedMajor]
  );

  const snapshot = (): ResumeDataRow => ({
    resume_id: resume.id,
    full_name: fullName.trim() || null,
    state: state.trim() || null,
    phone: phone.trim() || null,
    work_email: workEmail.trim() || null,
    linkedin: linkedin.trim() || null,
    professional_title: professionalTitle.trim() || null,
    school: school.trim() || null,
    major: resolvedMajor || null,
    concentration: concentration.trim() || null,
    minor: minor.trim() || null,
    achievements: textToAchievements(achievementsText),
    certifications: certifications.filter((c) => c.label.trim()),
    projects: projects.filter((p) => p.title.trim() || p.description.trim()),
    extracurriculars: textToAchievements(extrasText),
    experience: experience.map((e) => ({
      ...e,
      bullets: finalizeBullets(e.bullets),
    })),
  });

  const percent = draftCompletenessPercent(snapshot());

  async function persist(nextStep: number) {
    setSaving(true);
    setError(null);
    setStatus(null);
    const data = snapshot();
    const supabase = createClient();
    const { error: dataError } = await supabase.from("resume_data").upsert({
      resume_id: resume.id,
      full_name: data.full_name,
      state: data.state,
      phone: data.phone,
      work_email: data.work_email,
      linkedin: data.linkedin,
      professional_title: data.professional_title,
      school: data.school,
      major: data.major,
      concentration: data.concentration,
      minor: data.minor,
      achievements: data.achievements,
      certifications: data.certifications,
      projects: data.projects,
      extracurriculars: data.extracurriculars,
      experience: data.experience,
    });
    if (dataError) {
      setSaving(false);
      setError(dataError.message);
      return false;
    }
    const { error: resumeError } = await supabase
      .from("resumes")
      .update({
        current_step: nextStep,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resume.id);
    setSaving(false);
    if (resumeError) {
      setError(resumeError.message);
      return false;
    }
    setStatus("Draft saved.");
    return true;
  }

  async function onSaveDraft() {
    const ok = await persist(step);
    if (ok) setStatus("Draft saved.");
  }

  async function onFinishDraft() {
    const ok = await persist(5);
    if (!ok) {
      setError((prev) => prev || "Could not save draft. Please try again.");
      return;
    }
    setStatus("Draft saved — opening template picker…");
    router.push("/resume/generate");
  }

  async function onNext() {
    const next = Math.min(5, step + 1);
    const ok = await persist(next);
    if (ok) setStep(next);
  }

  async function onBack() {
    const prev = Math.max(1, step - 1);
    const ok = await persist(prev);
    if (ok) setStep(prev);
  }

  function toggleCuratedCert(label: string) {
    setCertifications((prev) => {
      const exists = prev.some((c) => c.label === label && !c.isCustom);
      if (exists) return prev.filter((c) => !(c.label === label && !c.isCustom));
      return [...prev, { label, isCustom: false }];
    });
  }

  function addCustomCert() {
    const label = customCert.trim();
    if (!label) return;
    setCertifications((prev) => {
      if (prev.some((c) => c.label === label)) return prev;
      return [...prev, { label, isCustom: true }];
    });
    setCustomCert("");
  }

  function removeCert(label: string) {
    setCertifications((prev) => prev.filter((c) => c.label !== label));
  }

  function updateExperience(
    index: number,
    patch: Partial<ResumeExperienceEntry>
  ) {
    setExperience((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e))
    );
  }

  function addExperience() {
    setExperience((prev) => {
      if (prev.length >= EXPERIENCE_SOFT_MAX) return prev;
      return [...prev, emptyExperienceSlot()];
    });
  }

  function removeExperience(index: number) {
    setExperience((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  function updateBullet(expIndex: number, bulletIndex: number, value: string) {
    setExperience((prev) =>
      prev.map((e, i) => {
        if (i !== expIndex) return e;
        const bullets = [...e.bullets];
        bullets[bulletIndex] = value;
        return { ...e, bullets };
      })
    );
  }

  function addBullet(expIndex: number) {
    setExperience((prev) =>
      prev.map((e, i) =>
        i === expIndex ? { ...e, bullets: [...e.bullets, ""] } : e
      )
    );
  }

  function removeBullet(expIndex: number, bulletIndex: number) {
    setExperience((prev) =>
      prev.map((e, i) => {
        if (i !== expIndex) return e;
        return {
          ...e,
          bullets: e.bullets.filter((_, bi) => bi !== bulletIndex),
        };
      })
    );
  }

  function resetLocalForm() {
    setStep(1);
    setFullName("");
    setState("");
    setPhone("");
    setWorkEmail("");
    setLinkedin("");
    setProfessionalTitle("");
    setSchool("");
    setMajorSelect("");
    setCustomMajor("");
    setConcentration("");
    setMinor("");
    setAchievementsText("");
    setCertifications([]);
    setCustomCert("");
    setProjects([]);
    setExtrasText("");
    setExperience([emptyExperienceSlot()]);
  }

  async function onDiscardDraft() {
    const ok = window.confirm(
      "This will permanently delete your current draft — continue?"
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    const supabase = createClient();
    const blank = emptyExperienceSlot();
    const { error: dataError } = await supabase
      .from("resume_data")
      .update({
        full_name: null,
        state: null,
        phone: null,
        work_email: null,
        linkedin: null,
        professional_title: null,
        school: null,
        major: null,
        concentration: null,
        minor: null,
        achievements: [],
        certifications: [],
        projects: [],
        extracurriculars: [],
        experience: [blank],
      })
      .eq("resume_id", resume.id);
    if (dataError) {
      setSaving(false);
      setError(dataError.message);
      return;
    }
    const { error: resumeError } = await supabase
      .from("resumes")
      .update({
        current_step: 1,
        template_choice: null,
        generated_content: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resume.id);
    setSaving(false);
    if (resumeError) {
      setError(resumeError.message);
      return;
    }
    resetLocalForm();
    setStatus("Draft discarded.");
    router.refresh();
  }

  function addProject() {
    setProjects((prev) => [
      ...prev,
      { title: "", description: "", dateContext: "" },
    ]);
  }

  function updateProject(index: number, patch: Partial<ResumeProjectEntry>) {
    setProjects((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  }

  function removeProject(index: number) {
    setProjects((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl">Resume Builder</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Resume draft — {percent}% complete
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--muted)]">
            Step {step} of 5 · {STEP_LABELS[step - 1]}
          </p>
          <button
            type="button"
            className="btn btn-ghost text-xs text-[var(--danger)]"
            onClick={() => void onDiscardDraft()}
            disabled={saving}
          >
            Discard draft
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          return (
            <button
              key={label}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
              onClick={() => void persist(n).then((ok) => ok && setStep(n))}
              disabled={saving}
            >
              {n}. {label}
            </button>
          );
        })}
      </div>

      <div className="surface space-y-4 rounded-2xl p-6">
        {step === 1 && (
          <>
            <h2 className="font-heading text-xl">Contact</h2>
            <Field label="Full name" id="full_name" value={fullName} onChange={setFullName} required />
            <div>
              <label className="label" htmlFor="state">
                State
              </label>
              <select
                id="state"
                className="input"
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Phone" id="phone" value={phone} onChange={setPhone} />
            <Field
              label="Work email"
              id="work_email"
              value={workEmail}
              onChange={setWorkEmail}
              type="email"
              required
            />
            <Field
              label="LinkedIn (optional)"
              id="linkedin"
              value={linkedin}
              onChange={setLinkedin}
              placeholder="https://linkedin.com/in/…"
            />
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-heading text-xl">Title & education</h2>
            <Field
              label="Professional title (optional)"
              id="professional_title"
              value={professionalTitle}
              onChange={setProfessionalTitle}
              placeholder='e.g. Marketing Major | Digital Strategy'
            />
            <Field label="School" id="school" value={school} onChange={setSchool} required />
            <div>
              <label className="label" htmlFor="major">
                Major *
              </label>
              <select
                id="major"
                className="input"
                value={majorSelect}
                onChange={(e) => setMajorSelect(e.target.value)}
              >
                <option value="">Select major</option>
                {RESUME_MAJORS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value={MAJOR_OTHER}>{MAJOR_OTHER}</option>
              </select>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Filters certification suggestions on the next steps
              </p>
            </div>
            {majorSelect === MAJOR_OTHER && (
              <Field
                label="Your major"
                id="major_custom"
                value={customMajor}
                onChange={setCustomMajor}
                placeholder="Type your major"
                required
              />
            )}
            <Field
              label="Concentration"
              id="concentration"
              value={concentration}
              onChange={setConcentration}
            />
            <Field label="Minor (optional)" id="minor" value={minor} onChange={setMinor} />
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-heading text-xl">Achievements & certifications</h2>
            <div>
              <label className="label" htmlFor="achievements">
                Achievements (one per line)
              </label>
              <textarea
                id="achievements"
                className="input min-h-[120px]"
                value={achievementsText}
                onChange={(e) => setAchievementsText(e.target.value)}
                placeholder="Dean’s List&#10;Scholarship…"
              />
            </div>

            <div>
              <p className="label">Certifications</p>
              {curatedCerts.length === 0 ? (
                <p className="mb-2 text-xs text-[var(--muted)]">
                  Select a major on the Education step to see curated suggestions,
                  or add your own below.
                </p>
              ) : (
                <ul className="mb-3 space-y-2">
                  {curatedCerts.map((label) => {
                    const checked = certifications.some(
                      (c) => c.label === label && !c.isCustom
                    );
                    return (
                      <li key={label}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={() => toggleCuratedCert(label)}
                          />
                          <span>{label}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="mb-2 text-xs text-[var(--muted)]">{CERT_OTHER}</p>
              <div className="flex flex-wrap gap-2">
                <input
                  className="input flex-1 min-w-[12rem]"
                  value={customCert}
                  onChange={(e) => setCustomCert(e.target.value)}
                  placeholder="Type a certification name"
                />
                <button type="button" className="btn btn-ghost" onClick={addCustomCert}>
                  Add
                </button>
              </div>

              {certifications.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {certifications.map((c) => (
                    <li
                      key={c.label}
                      className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
                    >
                      <span>{c.label}</span>
                      <button
                        type="button"
                        className="text-[var(--muted)] hover:text-[var(--danger)]"
                        onClick={() => removeCert(c.label)}
                        aria-label={`Remove ${c.label}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="font-heading text-xl">Projects & extracurriculars</h2>
            <p className="text-sm text-[var(--muted)]">
              Both optional — skip if you have none.
            </p>
            <h3 className="font-heading text-lg">Projects</h3>
            {projects.map((p, i) => (
              <div
                key={i}
                className="space-y-3 rounded-xl border border-[var(--line)] p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Project {i + 1}</p>
                  <button
                    type="button"
                    className="text-xs text-[var(--muted)] hover:text-[var(--danger)]"
                    onClick={() => removeProject(i)}
                  >
                    Remove
                  </button>
                </div>
                <Field
                  label="Title"
                  id={`proj_title_${i}`}
                  value={p.title}
                  onChange={(v) => updateProject(i, { title: v })}
                />
                <div>
                  <label className="label" htmlFor={`proj_desc_${i}`}>
                    Description
                  </label>
                  <textarea
                    id={`proj_desc_${i}`}
                    className="input min-h-[80px]"
                    value={p.description}
                    onChange={(e) =>
                      updateProject(i, { description: e.target.value })
                    }
                  />
                </div>
                <Field
                  label="Date / context"
                  id={`proj_date_${i}`}
                  value={p.dateContext}
                  onChange={(v) => updateProject(i, { dateContext: v })}
                  placeholder="e.g. Spring 2026 · Capstone"
                />
              </div>
            ))}
            <button type="button" className="btn btn-ghost" onClick={addProject}>
              Add project
            </button>

            <div className="border-t border-[var(--line)] pt-4">
              <h3 className="font-heading text-lg">Extracurriculars (optional)</h3>
              <p className="mb-2 text-sm text-[var(--muted)]">
                Clubs, orgs, leadership — one per line (e.g. President, Business
                Society).
              </p>
              <textarea
                id="extracurriculars"
                className="input min-h-[100px]"
                value={extrasText}
                onChange={(e) => setExtrasText(e.target.value)}
                placeholder="Pi Kappa Alpha — Fraternity&#10;President, Business Society"
              />
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h2 className="font-heading text-xl">Experience</h2>
            <p className="text-sm text-[var(--muted)]">
              Add at least one — include more if you have them. End date only —
              no start date.
            </p>
            {experience.map((e, i) => (
              <div
                key={i}
                className="space-y-3 rounded-xl border border-[var(--line)] p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Experience {i + 1}</p>
                  <button
                    type="button"
                    className="text-xs text-[var(--muted)] hover:text-[var(--danger)] disabled:opacity-40 disabled:hover:text-[var(--muted)]"
                    onClick={() => removeExperience(i)}
                    disabled={experience.length <= 1}
                  >
                    Remove
                  </button>
                </div>
                <Field
                  label="Title"
                  id={`exp_title_${i}`}
                  value={e.title}
                  onChange={(v) => updateExperience(i, { title: v })}
                />
                <Field
                  label="Company"
                  id={`exp_company_${i}`}
                  value={e.company}
                  onChange={(v) => updateExperience(i, { company: v })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Location"
                    id={`exp_loc_${i}`}
                    value={e.location}
                    onChange={(v) => updateExperience(i, { location: v })}
                    placeholder="City"
                  />
                  <div>
                    <label className="label" htmlFor={`exp_state_${i}`}>
                      State
                    </label>
                    <select
                      id={`exp_state_${i}`}
                      className="input"
                      value={e.state}
                      onChange={(ev) =>
                        updateExperience(i, { state: ev.target.value })
                      }
                    >
                      <option value="">Select state</option>
                      {US_STATES.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Field
                  label="End date"
                  id={`exp_end_${i}`}
                  value={e.endDate}
                  onChange={(v) => updateExperience(i, { endDate: v })}
                  placeholder="e.g. May 2026 or Present"
                />
                <div className="space-y-2">
                  <p className="label">Bullet points</p>
                  {e.bullets.map((b, bi) => (
                    <div key={bi} className="flex items-start gap-2">
                      <div className="flex-1">
                        <label className="sr-only" htmlFor={`exp_${i}_b_${bi}`}>
                          Bullet point
                        </label>
                        <input
                          id={`exp_${i}_b_${bi}`}
                          className="input"
                          value={b}
                          onChange={(ev) =>
                            updateBullet(i, bi, ev.target.value)
                          }
                          placeholder="Type or paste a bullet point"
                        />
                      </div>
                      <button
                        type="button"
                        className="mt-2 text-sm text-[var(--muted)] hover:text-[var(--danger)]"
                        onClick={() => removeBullet(i, bi)}
                        aria-label="Remove bullet"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost text-xs"
                    onClick={() => addBullet(i)}
                  >
                    + Add bullet
                  </button>
                </div>
              </div>
            ))}
            {experience.length < EXPERIENCE_SOFT_MAX ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={addExperience}
              >
                + Add another experience
              </button>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                Up to {EXPERIENCE_SOFT_MAX} experiences
              </p>
            )}
          </>
        )}

        {error && (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        {status && !error && (
          <p className="text-sm text-[var(--accent-cyan)]">{status}</p>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          {step > 1 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void onBack()}
              disabled={saving}
            >
              Back
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void onSaveDraft()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          {step < 5 ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onNext()}
              disabled={saving}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onFinishDraft()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Finish draft"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
