/**
 * Smoke: PDF + DOCX export — long text, company backfill, location, LinkedIn.
 * Run: npm run smoke:resume-export
 */
import { writeFileSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { ResumePdfDocument } from "../src/components/ResumePdfDocument";
import type { ResumeContact } from "../src/components/ResumePreviewPaper";
import { buildResumeDocxBuffer } from "../src/lib/resume-docx";
import {
  backfillExperienceCompanies,
  displayLinkedIn,
} from "../src/lib/resume-format";
import type { TailoredResumeContent } from "../src/lib/types";

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const LONG_SUMMARY =
  "EDITED_SUMMARY_SMOKE_XYZ demonstrating advanced analytical thinking and cross-functional collaboration across multiple university projects while maintaining academic excellence in Computer Science French literature crossover studies.";

const LONG_BULLET =
  "EDITED_BULLET_SMOKE_XYZ demonstrating measurable impact by redesigning reporting pipelines and documenting Science (French language) coursework outcomes for stakeholders.";

const MARKERS = {
  name: "EDITED_NAME_SMOKE_XYZ",
  school: "EDITED_SCHOOL_SMOKE_XYZ University",
  eduState: "WI",
  projectDesc: "EDITED_PROJECT_DESC_SMOKE_XYZ description that is also fairly long for wrapping checks",
  projectTitle: "CampusOS Project Smoke",
  company: "Houston Energy Partners",
  city: "Des Moines",
};

const contact: ResumeContact = {
  full_name: MARKERS.name,
  city: MARKERS.city,
  state: "IA",
  phone: "404-555-0100",
  work_email: "smoke@example.com",
  linkedin: "https://linkedin.com/in/smoke",
  professional_title: "Student",
};

const content: TailoredResumeContent = {
  summary: LONG_SUMMARY,
  education: {
    school: MARKERS.school,
    degreeLine: "B.S. Computer Science",
    location: "Madison",
    state: MARKERS.eduState,
    date: "",
    details: ["GPA 3.8"],
  },
  experience: [
    {
      title: "Analyst",
      company: MARKERS.company,
      location: "Houston",
      state: "TX",
      endDate: "May 2024",
      bullets: [LONG_BULLET],
    },
    {
      title: "Intern",
      company: "",
      location: "Atlanta",
      state: "GA",
      endDate: "Present",
      bullets: ["Short bullet"],
    },
  ],
  projects: [
    {
      title: MARKERS.projectTitle,
      description: MARKERS.projectDesc,
      dateContext: "2026",
    },
  ],
  technicalSkills: ["TypeScript", "SQL"],
  certifications: ["AWS CCP"],
  achievements: ["Dean’s List"],
  extracurriculars: ["Hackathon"],
  additional: ["Languages: Spanish"],
};

function unzipXml(buf: Buffer, label: string): string {
  assert(buf.length > 2000, `${label} DOCX too small: ${buf.length}`);
  assert(buf[0] === 0x50 && buf[1] === 0x4b, `${label} DOCX missing ZIP magic`);
  const docxPath = join(tmpdir(), `resume_smoke_${label}.docx`);
  const unzipDir = join(tmpdir(), `resume_smoke_unzip_${label}_${Date.now()}`);
  writeFileSync(docxPath, buf);
  execSync(`mkdir -p "${unzipDir}" && unzip -qo "${docxPath}" -d "${unzipDir}"`);
  return execSync(`cat "${unzipDir}/word/document.xml"`, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function main() {
  // Company backfill unit check
  const filled = backfillExperienceCompanies(
    {
      experience: [
        {
          title: "Analyst",
          company: "",
          location: "Houston",
          state: "TX",
          endDate: "May 2024",
          bullets: ["x"],
        },
      ],
    },
    [{ company: MARKERS.company }]
  );
  assert(
    filled.experience[0].company === MARKERS.company,
    "backfill should copy intake company"
  );
  assert(
    displayLinkedIn("https://linkedin.com/in/smoke") === "linkedin.com/in/smoke",
    "displayLinkedIn should strip https"
  );

  const docxA = await buildResumeDocxBuffer({
    template: "A",
    contact,
    content,
  });
  const xmlA = unzipXml(docxA, "A");
  assert(xmlA.includes(LONG_BULLET), "A missing full long bullet");
  assert(xmlA.includes("demonstrating"), "A bullet mid-word present");
  assert(xmlA.includes(MARKERS.company), "A missing company name");
  assert(xmlA.includes(MARKERS.city), "A missing contact city");
  assert(xmlA.includes("IA"), "A missing contact state");
  assert(xmlA.includes("linkedin.com/in/smoke"), "A missing linkedin host");
  assert(!xmlA.includes("https://linkedin"), "A should not show https:// in linkedin display");
  assert(xmlA.includes(MARKERS.projectTitle), "A missing project title");

  const docxB = await buildResumeDocxBuffer({
    template: "B",
    contact,
    content,
  });
  const xmlB = unzipXml(docxB, "B");
  assert(xmlB.includes(LONG_SUMMARY), "B missing full long summary");
  assert(xmlB.includes(LONG_BULLET), "B missing full long bullet");
  assert(xmlB.includes(MARKERS.company), "B missing company");
  assert(xmlB.includes(MARKERS.projectTitle), "B missing project title");
  assert(xmlB.includes(MARKERS.city), "B missing city");

  const xmlC = unzipXml(
    await buildResumeDocxBuffer({ template: "C", contact, content }),
    "C"
  );
  assert(xmlC.includes(LONG_SUMMARY), "C missing long summary");
  assert(xmlC.includes(LONG_BULLET), "C missing long bullet");
  assert(xmlC.includes(MARKERS.company), "C missing company");
  assert(xmlC.includes(MARKERS.projectTitle), "C missing project title");
  assert(xmlC.includes(MARKERS.city), "C missing city");

  const pdfBlob = await pdf(
    React.createElement(ResumePdfDocument, {
      template: "A",
      contact,
      content,
    }) as React.ReactElement
  ).toBlob();
  const pdfBuf = Buffer.from(await pdfBlob.arrayBuffer());
  assert(pdfBuf.subarray(0, 4).toString() === "%PDF", "PDF magic invalid");
  writeFileSync(join(tmpdir(), "resume_smoke.pdf"), pdfBuf);

  console.log("smoke:resume-export OK");
  console.log(`  docx A bytes: ${docxA.length}; pdf: ${pdfBuf.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
