import type { TailoredResumeContent } from "@/lib/types";

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export type ParseTailoredOptions = {
  /** When true, experience must be a non-empty array. */
  requireExperience?: boolean;
};

/** Safe defaults so preview/PDF never crash on partial jsonb. */
export function normalizeTailoredResume(
  raw: TailoredResumeContent | null | undefined
): TailoredResumeContent {
  const education = raw?.education;
  return {
    summary: raw?.summary ?? null,
    professionalSkills: raw?.professionalSkills ?? [],
    technicalSkills: raw?.technicalSkills ?? [],
    education: {
      school: education?.school ?? "",
      degreeLine: education?.degreeLine ?? "",
      location: education?.location ?? null,
      state: education?.state ?? null,
      date: education?.date ?? null,
      details: education?.details ?? [],
    },
    experience: Array.isArray(raw?.experience)
      ? raw!.experience.map((e) => ({
          title: e?.title ?? "",
          company: e?.company ?? "",
          location: e?.location ?? "",
          state: e?.state ?? "",
          endDate: e?.endDate ?? "",
          bullets: Array.isArray(e?.bullets) ? e.bullets : [],
        }))
      : [],
    projects: Array.isArray(raw?.projects) ? raw!.projects : [],
    extracurriculars: Array.isArray(raw?.extracurriculars)
      ? raw!.extracurriculars
      : [],
    certifications: Array.isArray(raw?.certifications)
      ? raw!.certifications
      : [],
    achievements: Array.isArray(raw?.achievements) ? raw!.achievements : [],
    additional: Array.isArray(raw?.additional) ? raw!.additional : [],
  };
}

/** Validates Claude output shape. Throws with a short reason if invalid. */
export function parseTailoredResume(
  raw: unknown,
  options: ParseTailoredOptions = {}
): TailoredResumeContent {
  if (!raw || typeof raw !== "object") {
    throw new Error("Response is not an object");
  }
  const o = raw as Record<string, unknown>;

  // Reject alternate wrapper keys — locked shape only
  if ("sections" in o && !("education" in o) && !("experience" in o)) {
    throw new Error("Unexpected shape: sections wrapper not supported");
  }

  if (!o.education || typeof o.education !== "object") {
    throw new Error("Missing education");
  }
  const edu = o.education as Record<string, unknown>;
  if (typeof edu.school !== "string" || typeof edu.degreeLine !== "string") {
    throw new Error("Invalid education fields");
  }

  if (!Array.isArray(o.experience)) {
    throw new Error("Missing experience array");
  }
  if (options.requireExperience && o.experience.length === 0) {
    throw new Error("Experience array is empty");
  }

  const experience = o.experience.map((item, i) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Invalid experience[${i}]`);
    }
    const e = item as Record<string, unknown>;
    if (
      typeof e.title !== "string" ||
      typeof e.company !== "string" ||
      typeof e.location !== "string" ||
      typeof e.endDate !== "string" ||
      !isStringArray(e.bullets)
    ) {
      throw new Error(`Invalid experience[${i}] fields`);
    }
    // state is optional string when present
    if (e.state != null && typeof e.state !== "string") {
      throw new Error(`Invalid experience[${i}] state`);
    }
    return {
      title: e.title,
      company: e.company,
      location: e.location,
      state: typeof e.state === "string" ? e.state : undefined,
      endDate: e.endDate,
      bullets: e.bullets,
    };
  });

  if (edu.state != null && typeof edu.state !== "string") {
    throw new Error("Invalid education.state");
  }

  const result: TailoredResumeContent = {
    education: {
      school: edu.school,
      degreeLine: edu.degreeLine,
      location: typeof edu.location === "string" ? edu.location : null,
      state: typeof edu.state === "string" ? edu.state : null,
      date: typeof edu.date === "string" ? edu.date : null,
      details: isStringArray(edu.details) ? edu.details : undefined,
    },
    experience,
  };

  if (o.summary === null || typeof o.summary === "string") {
    result.summary = o.summary ?? null;
  }
  if (isStringArray(o.professionalSkills)) {
    result.professionalSkills = o.professionalSkills;
  }
  if (isStringArray(o.technicalSkills)) {
    result.technicalSkills = o.technicalSkills;
  }
  if (Array.isArray(o.projects)) {
    result.projects = o.projects.map((p, i) => {
      if (!p || typeof p !== "object") throw new Error(`Invalid projects[${i}]`);
      const x = p as Record<string, unknown>;
      if (
        typeof x.title !== "string" ||
        typeof x.description !== "string" ||
        typeof x.dateContext !== "string"
      ) {
        throw new Error(`Invalid projects[${i}] fields`);
      }
      return {
        title: x.title,
        description: x.description,
        dateContext: x.dateContext,
      };
    });
  }
  if (isStringArray(o.extracurriculars)) {
    result.extracurriculars = o.extracurriculars;
  }
  if (isStringArray(o.certifications)) {
    result.certifications = o.certifications;
  }
  if (isStringArray(o.achievements)) {
    result.achievements = o.achievements;
  }
  if (isStringArray(o.additional)) {
    result.additional = o.additional;
  }

  return result;
}
