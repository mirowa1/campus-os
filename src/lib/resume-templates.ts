import type { ResumeTemplateId } from "@/lib/types";

export type ResumeTemplateSpec = {
  id: ResumeTemplateId;
  name: string;
  blurb: string;
  sectionOrder: string[];
  formattingNotes: string;
};

export const RESUME_TEMPLATES: ResumeTemplateSpec[] = [
  {
    id: "A",
    name: "Technical / Classic",
    blurb: "Centered header, serif feel — Education → Experience → Projects.",
    sectionOrder: [
      "header",
      "education",
      "experience",
      "projects",
      "extracurriculars",
      "certifications",
      "achievements",
    ],
    formattingNotes:
      "Centered name and contact. Bold school/title with right-aligned dates. Dense bullets. Serif-friendly classic layout.",
  },
  {
    id: "B",
    name: "Modern Summary-First",
    blurb: "Left-aligned header — Summary → Skills → Experience → Education.",
    sectionOrder: [
      "header",
      "summary",
      "technicalSkills",
      "experience",
      "education",
      "additional",
    ],
    formattingNotes:
      "Left-aligned name + professional title. Sans-serif. Skills as 2-column bullets. Additional Info holds certs, achievements, extracurriculars.",
  },
  {
    id: "C",
    name: "Skills-Heavy Marketing",
    blurb: "Centered caps header — Summary → Education → Experience → Skills grids.",
    sectionOrder: [
      "header",
      "summary",
      "education",
      "experience",
      "professionalSkills",
      "technicalSkills",
      "certifications",
    ],
    formattingNotes:
      "Centered uppercase name. Professional Skills 2-col; Technical Skills multi-col tool names from certifications/experience only.",
  },
];

export function getTemplateSpec(id: ResumeTemplateId): ResumeTemplateSpec {
  const t = RESUME_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown template ${id}`);
  return t;
}

export function isResumeTemplateId(v: unknown): v is ResumeTemplateId {
  return v === "A" || v === "B" || v === "C";
}
