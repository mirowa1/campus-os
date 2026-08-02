import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { ResumeContact } from "@/components/ResumePreviewPaper";
import {
  displayLinkedIn,
  formatPlace,
  hasText,
  joinNonEmpty,
} from "@/lib/resume-format";
import type { ResumeTemplateId, TailoredResumeContent } from "@/lib/types";

function contactLine(c: ResumeContact): string {
  return joinNonEmpty(
    [
      c.phone,
      c.work_email,
      formatPlace(c.city, c.state),
      displayLinkedIn(c.linkedin),
    ],
    "  |  "
  );
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    border: {
      bottom: { color: "171717", space: 1, style: "single", size: 6 },
    },
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 40 },
  });
}

function body(
  text: string,
  opts?: { bold?: boolean; italics?: boolean }
): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        italics: opts?.italics,
        size: 20,
      }),
    ],
    spacing: { after: 40 },
  });
}

function muted(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 18, color: "525252" })],
    spacing: { after: 40 },
  });
}

function buildChildren(
  template: ResumeTemplateId,
  contact: ResumeContact,
  raw: TailoredResumeContent
): Paragraph[] {
  const content = {
    ...raw,
    experience: raw.experience ?? [],
    education: raw.education ?? {
      school: "",
      degreeLine: "",
      location: null,
      state: null,
      date: null,
      details: [],
    },
  };
  const name = contact.full_name?.trim() || "Your Name";
  const line = contactLine(contact);
  const eduPlace = formatPlace(
    content.education.location,
    content.education.state
  );
  const out: Paragraph[] = [];

  if (template === "A") {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: name, bold: true, size: 32 })],
        spacing: { after: 60 },
      })
    );
    if (hasText(line)) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: line, size: 18, color: "404040" })],
          spacing: { after: 160 },
        })
      );
    }
  } else if (template === "B") {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: name, bold: true, size: 32 })],
        spacing: { after: 40 },
      })
    );
    if (hasText(contact.professional_title)) {
      out.push(muted(contact.professional_title!.trim()));
    }
    if (hasText(line)) {
      out.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 18, color: "404040" })],
          spacing: { after: 160 },
        })
      );
    }
  } else {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: name.toUpperCase(),
            bold: true,
            size: 28,
          }),
        ],
        spacing: { after: 60 },
      })
    );
    if (hasText(line)) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: line, size: 18, color: "404040" })],
          spacing: { after: 160 },
        })
      );
    }
  }

  if ((template === "B" || template === "C") && hasText(content.summary)) {
    out.push(sectionTitle("Summary"), body(content.summary!.trim()));
  }

  if (template === "B" && (content.technicalSkills?.length ?? 0) > 0) {
    out.push(sectionTitle("Technical Skills"));
    for (const s of content.technicalSkills!) out.push(bullet(s));
  }

  if (template === "A" || template === "C") {
    out.push(sectionTitle("Education"));
    if (template === "C") {
      if (hasText(content.education.degreeLine)) {
        out.push(body(content.education.degreeLine, { bold: true }));
      }
      const schoolDate = joinNonEmpty(
        [content.education.school, content.education.date],
        " · "
      );
      if (hasText(schoolDate)) out.push(muted(schoolDate));
      if (hasText(eduPlace)) out.push(muted(eduPlace));
    } else {
      if (hasText(content.education.school)) {
        out.push(body(content.education.school, { bold: true }));
      }
      if (hasText(content.education.degreeLine)) {
        out.push(body(content.education.degreeLine, { italics: true }));
      }
      for (const d of content.education.details ?? []) {
        if (hasText(d)) out.push(muted(d));
      }
      if (hasText(eduPlace)) out.push(muted(eduPlace));
      if (hasText(content.education.date)) {
        out.push(muted(content.education.date!));
      }
    }
  }

  out.push(
    sectionTitle(template === "B" ? "Professional Experience" : "Experience")
  );
  for (const e of content.experience) {
    const place = formatPlace(e.location, e.state);
    if (template === "B") {
      const tc = joinNonEmpty([e.title, e.company], " — ");
      if (hasText(tc)) out.push(body(tc, { bold: true }));
      if (hasText(e.endDate)) out.push(muted(e.endDate));
      if (hasText(place)) out.push(muted(place));
    } else if (template === "C") {
      const tc = joinNonEmpty([e.title, e.company], ", ");
      if (hasText(tc)) out.push(body(tc, { bold: true }));
      if (hasText(e.endDate)) out.push(muted(e.endDate));
      if (hasText(place)) out.push(muted(place));
    } else {
      if (hasText(e.title)) out.push(body(e.title, { bold: true }));
      if (hasText(place)) out.push(muted(place));
      if (hasText(e.company)) out.push(body(e.company, { italics: true }));
      if (hasText(e.endDate)) out.push(muted(e.endDate));
    }
    for (const b of e.bullets ?? []) {
      if (hasText(b)) out.push(bullet(b));
    }
  }

  if (template === "B") {
    out.push(sectionTitle("Education"));
    if (hasText(content.education.school)) {
      out.push(body(content.education.school, { bold: true }));
    }
    if (hasText(content.education.degreeLine)) {
      out.push(muted(content.education.degreeLine));
    }
    if (hasText(eduPlace)) out.push(muted(eduPlace));
    if (hasText(content.education.date)) {
      out.push(muted(content.education.date!));
    }
  }

  if ((content.projects?.length ?? 0) > 0) {
    out.push(sectionTitle("Projects"));
    for (const p of content.projects!) {
      if (hasText(p.title)) out.push(body(p.title, { bold: true }));
      if (hasText(p.dateContext)) out.push(muted(p.dateContext));
      if (hasText(p.description)) out.push(body(p.description));
    }
  }

  if (template === "C" && (content.professionalSkills?.length ?? 0) > 0) {
    out.push(sectionTitle("Professional Skills"));
    for (const s of content.professionalSkills!) out.push(bullet(s));
  }

  if (template === "C" && (content.technicalSkills?.length ?? 0) > 0) {
    out.push(sectionTitle("Technical Skills"));
    for (const s of content.technicalSkills!) out.push(bullet(s));
  }

  if ((content.extracurriculars?.length ?? 0) > 0) {
    out.push(sectionTitle("Extracurriculars"));
    for (const x of content.extracurriculars!) out.push(bullet(x));
  }

  if ((content.certifications?.length ?? 0) > 0) {
    out.push(sectionTitle("Certifications"));
    for (const x of content.certifications!) out.push(bullet(x));
  }

  if ((content.achievements?.length ?? 0) > 0) {
    out.push(sectionTitle("Achievements"));
    for (const x of content.achievements!) out.push(bullet(x));
  }

  if ((content.additional?.length ?? 0) > 0) {
    out.push(sectionTitle("Additional"));
    for (const x of content.additional!) out.push(bullet(x));
  }

  return out;
}

export async function buildResumeDocxBlob(opts: {
  template: ResumeTemplateId;
  contact: ResumeContact;
  content: TailoredResumeContent;
}): Promise<Blob> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: buildChildren(opts.template, opts.contact, opts.content),
      },
    ],
  });
  return Packer.toBlob(doc);
}

export async function buildResumeDocxBuffer(opts: {
  template: ResumeTemplateId;
  contact: ResumeContact;
  content: TailoredResumeContent;
}): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: buildChildren(opts.template, opts.contact, opts.content),
      },
    ],
  });
  return Packer.toBuffer(doc);
}
