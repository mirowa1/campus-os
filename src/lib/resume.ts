import type {
  ResumeCertification,
  ResumeDataRow,
  ResumeExperienceEntry,
  ResumeProjectEntry,
} from "@/lib/types";

export const RESUME_STEPS = 5;

export const STEP_LABELS = [
  "Contact",
  "Education",
  "Achievements",
  "Projects",
  "Experience",
] as const;

export function emptyExperienceSlot(): ResumeExperienceEntry {
  return {
    title: "",
    company: "",
    location: "",
    state: "",
    endDate: "",
    bullets: [],
  };
}

/** Soft UI cap — Add is disabled at this count. */
export const EXPERIENCE_SOFT_MAX = 5;

export function emptyExperience(): ResumeExperienceEntry[] {
  return [emptyExperienceSlot()];
}

export function normalizeExperience(raw: unknown): ResumeExperienceEntry[] {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length === 0) return emptyExperience();
  return list.map((item) => {
    const e = item as Partial<ResumeExperienceEntry>;
    return {
      title: e?.title ?? "",
      company: e?.company ?? "",
      location: e?.location ?? "",
      state: e?.state ?? "",
      endDate: e?.endDate ?? "",
      bullets: Array.isArray(e?.bullets)
        ? e.bullets.filter((b): b is string => typeof b === "string")
        : [],
    };
  });
}

export function normalizeProjects(raw: unknown): ResumeProjectEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const o = p as Partial<ResumeProjectEntry>;
    return {
      title: o.title ?? "",
      description: o.description ?? "",
      dateContext: o.dateContext ?? "",
    };
  });
}

export function normalizeCertifications(raw: unknown): ResumeCertification[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => {
    const o = c as Partial<ResumeCertification>;
    return {
      label: o.label ?? "",
      isCustom: Boolean(o.isCustom),
    };
  });
}

export function normalizeAchievements(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is string => typeof a === "string");
}

export function normalizeExtracurriculars(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is string => typeof a === "string");
}

/** Lightweight draft completeness — 5 equal buckets, one per wizard step. */
export function draftCompletenessPercent(data: ResumeDataRow): number {
  let filled = 0;
  if (data.full_name?.trim() && data.work_email?.trim()) filled += 1;
  if (data.school?.trim() && data.major?.trim()) filled += 1;
  if (
    normalizeAchievements(data.achievements).some((a) => a.trim()) ||
    normalizeCertifications(data.certifications).some((c) => c.label.trim())
  ) {
    filled += 1;
  }
  // Projects + extracurriculars optional — empty lists count as done
  const projects = normalizeProjects(data.projects);
  if (projects.length === 0 || projects.some((p) => p.title.trim())) filled += 1;
  const exp = normalizeExperience(data.experience);
  if (exp.some((e) => e.title.trim() && e.company.trim())) {
    filled += 1;
  }
  return Math.round((filled / RESUME_STEPS) * 100);
}

export function emptyResumeData(resumeId: string): ResumeDataRow {
  return {
    resume_id: resumeId,
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
    experience: emptyExperience(),
  };
}
