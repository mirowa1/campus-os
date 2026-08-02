import type { ResumeTemplateId } from "@/lib/types";

export type ResumeTemplateSpec = {
  id: ResumeTemplateId;
  name: string;
  blurb: string;
  sectionOrder: string[];
  formattingNotes: string;
  /** Visual identity brief for Claude HTML generation. */
  htmlStyleBrief: string;
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
      "additional",
    ],
    formattingNotes:
      "Centered name and contact. Bold school/title with right-aligned dates and location/state. Dense bullets. Serif-friendly classic layout.",
    htmlStyleBrief: `Visual identity — Technical / Classic (Template A):
- Page: US Letter, white background, black/near-black text, generous margins (~0.6–0.75in).
- Typography: Serif for the name (Georgia / Times); body in a clean serif or classic readable face; section headings small uppercase with a full-width hairline border beneath.
- Header: Centered full name (large, bold); contact line centered beneath (phone | email | City, ST | LinkedIn) with subtle separators.
- Section order: Education → Experience → Projects → Extracurriculars → Certifications → Achievements → Additional (omit any section with no grounded content).
- Experience entries: title bold on left, location/state right-aligned; company italic on next line with end date right; bullet list beneath.
- Education: school bold, degree line italic; location/state and date right-aligned; optional detail lines.
- Dense, professional, classic academic/tech resume look. No colors beyond black/gray. No sidebar.`,
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
      "projects",
      "extracurriculars",
      "certifications",
      "achievements",
      "additional",
    ],
    formattingNotes:
      "Left-aligned name + professional title. Sans-serif. Skills as 2-column bullets.",
    htmlStyleBrief: `Visual identity — Modern Summary-First (Template B):
- Page: US Letter, white background, dark charcoal text, sans-serif throughout (Helvetica / Arial / system-ui).
- Header: Left-aligned name (large, bold); professional title muted beneath if provided; contact line left-aligned.
- Section headings: uppercase, bold, with underline border; slightly more air between sections than Template A.
- Section order: Summary → Technical Skills → Professional Experience → Education → Projects → Extracurriculars → Certifications → Achievements → Additional (omit empty).
- Summary: short paragraph only if grounded in intake (title/achievements/experience wording) — never invent.
- Skills: two-column bullet list when multiple skills exist.
- Experience: "Title — Company" bold; end date right; City, ST muted; bullets below.
- Clean modern product/ops resume aesthetic. Minimal color (black/gray only).`,
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
      "projects",
      "extracurriculars",
      "certifications",
      "achievements",
      "additional",
    ],
    formattingNotes:
      "Centered uppercase name. Professional Skills 2-col; Technical Skills multi-col.",
    htmlStyleBrief: `Visual identity — Skills-Heavy Marketing (Template C):
- Page: US Letter, white background, sans-serif, marketing/communications feel.
- Header: Centered name in ALL CAPS with wider letter-spacing; contact centered beneath.
- Section order: Summary → Education → Experience → Professional Skills → Technical Skills → Projects → Extracurriculars → Certifications → Achievements → Additional (omit empty).
- Skills emphasis: Professional Skills as two columns; Technical Skills as a multi-column wrap/grid of short labels.
- Experience: "Title, Company" bold; end date right; City, ST muted; bullets.
- Education: degree line bold; school · date; location/state if present.
- Distinct from A (no serif/centered classic) and B (not summary-skills-first left stack) — this is centered caps + skills grids.`,
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
