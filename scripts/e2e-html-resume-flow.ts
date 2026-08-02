/**
 * Full local HTML resume flow (architecture cutover):
 * auth → ensure intake data → Claude HTML generate → save generated_html
 * → edit → save → PDF (Chromium) → DOCX
 *
 * Run: npx tsx scripts/e2e-html-resume-flow.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createClient } from "@supabase/supabase-js";
import HTMLtoDOCX from "html-to-docx";
import { generateResumeHtmlWithClaude } from "../src/lib/claude";
import {
  assertValidResumeHtml,
  wrapResumeDocument,
} from "../src/lib/resume-html";
import { htmlToPdfBuffer } from "../src/lib/resume-pdf-chromium";
import { getTemplateSpec } from "../src/lib/resume-templates";

function loadEnv() {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

/** Confirm auth email via Supabase Management API (local e2e only). */
async function confirmAuthEmail(email: string) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "Set SUPABASE_ACCESS_TOKEN (sbp_…) to confirm e2e signup emails"
    );
  }
  const project =
    process.env.SUPABASE_PROJECT_REF || "zbfnysljwyebktmxazii";
  const query = `
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where email = '${email.replace(/'/g, "''")}';
  `;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${project}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) {
    throw new Error(`confirmAuthEmail failed: ${res.status} ${await res.text()}`);
  }
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  assert(!!url && !!anon, "Missing Supabase env");
  assert(!!process.env.ANTHROPIC_API_KEY, "Missing ANTHROPIC_API_KEY");

  const email = `campusos.html.e2e.${Date.now()}@gsu.edu`;
  const password = `E2eHtml!${Date.now()}Aa`;
  const supabase = createClient(url, anon);

  console.log("1) Auth signup…", email);
  const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
  });
  if (signUpErr) throw signUpErr;
  let userId = signUp.user?.id;
  if (!signUp.session) {
    console.log("   Confirming email via management API…");
    await confirmAuthEmail(email);
    const { data: signIn, error: signInErr } =
      await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
    userId = signIn.user?.id;
    assert(!!signIn.session, "No session after sign-in");
  }
  assert(!!userId, "No user id");

  console.log("2) Ensure resume + intake data…");
  const { data: resume, error: resumeErr } = await supabase
    .from("resumes")
    .insert({ user_id: userId, current_step: 5 })
    .select("id, generated_content, generated_html")
    .single();
  if (resumeErr) throw resumeErr;

  const priorJson = resume.generated_content; // should stay untouched after HTML save

  const { error: dataErr } = await supabase.from("resume_data").upsert({
    resume_id: resume.id,
    full_name: "HTML E2E Tester",
    city: "Atlanta",
    state: "GA",
    phone: "404-555-0199",
    work_email: email,
    linkedin: "https://linkedin.com/in/htmle2e",
    professional_title: "CIS Student",
    school: "Georgia State University",
    major: "Computer Information Systems",
    concentration: "AI",
    minor: null,
    education_location: "Atlanta",
    education_state: "GA",
    achievements: ["Dean List"],
    certifications: [{ label: "AWS Cloud Practitioner", isCustom: false }],
    projects: [
      {
        title: "CampusOS",
        description: "Student OS HTML resume cutover",
        dateContext: "2026",
      },
    ],
    extracurriculars: ["Business Society"],
    experience: [
      {
        title: "Software Intern",
        company: "Acme Corp",
        location: "Atlanta",
        state: "GA",
        endDate: "May 2026",
        bullets: [
          "Built enterprise features for campus tools",
          "Collaborated with product team on releases",
        ],
      },
    ],
  });
  if (dataErr) throw dataErr;

  console.log("3) Claude HTML generate (template B)…");
  const template = getTemplateSpec("B");
  const rawHtml = await generateResumeHtmlWithClaude({
    userData: {
      full_name: "HTML E2E Tester",
      city: "Atlanta",
      state: "GA",
      phone: "404-555-0199",
      work_email: email,
      linkedin: "linkedin.com/in/htmle2e",
      professional_title: "CIS Student",
      school: "Georgia State University",
      major: "Computer Information Systems",
      concentration: "AI",
      education_location: "Atlanta",
      education_state: "GA",
      achievements: ["Dean List"],
      certifications: [{ label: "AWS Cloud Practitioner", isCustom: false }],
      projects: [
        {
          title: "CampusOS",
          description: "Student OS HTML resume cutover",
          dateContext: "2026",
        },
      ],
      extracurriculars: ["Business Society"],
      experience: [
        {
          title: "Software Intern",
          company: "Acme Corp",
          location: "Atlanta",
          state: "GA",
          endDate: "May 2026",
          bullets: [
            "Built enterprise features for campus tools",
            "Collaborated with product team on releases",
          ],
        },
      ],
    },
    templateId: "B",
    templateSpec: {
      name: template.name,
      sectionOrder: template.sectionOrder,
      formattingNotes: template.formattingNotes,
      htmlStyleBrief: template.htmlStyleBrief,
    },
  });

  let html = wrapResumeDocument(assertValidResumeHtml(rawHtml));
  assert(html.includes("HTML E2E Tester") || html.length > 200, "HTML too thin");
  assert(/Acme Corp/i.test(html), "company missing from HTML");
  console.log("   HTML bytes:", html.length);

  console.log("4) Save generated_html (leave generated_content untouched)…");
  const { error: save1 } = await supabase
    .from("resumes")
    .update({
      template_choice: "B",
      generated_html: html,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resume.id)
    .eq("user_id", userId);
  if (save1) throw save1;

  const { data: afterSave1, error: read1 } = await supabase
    .from("resumes")
    .select("generated_html, generated_content, template_choice")
    .eq("id", resume.id)
    .single();
  if (read1) throw read1;
  assert(!!afterSave1.generated_html, "generated_html not saved");
  assert(
    JSON.stringify(afterSave1.generated_content) === JSON.stringify(priorJson),
    "generated_content was mutated — rollback path broken"
  );
  assert(afterSave1.template_choice === "B", "template_choice not saved");

  console.log("5) Preview/edit simulation…");
  const edited = html.replace(
    /HTML E2E Tester/g,
    "HTML E2E Tester EDITED_MARKER_XYZ"
  );
  assert(edited.includes("EDITED_MARKER_XYZ"), "edit failed");
  html = wrapResumeDocument(assertValidResumeHtml(edited));

  console.log("6) Save edits…");
  const { error: save2 } = await supabase
    .from("resumes")
    .update({
      generated_html: html,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resume.id);
  if (save2) throw save2;

  const { data: afterEdit, error: read2 } = await supabase
    .from("resumes")
    .select("generated_html, generated_content")
    .eq("id", resume.id)
    .single();
  if (read2) throw read2;
  assert(
    afterEdit.generated_html?.includes("EDITED_MARKER_XYZ") === true,
    "edited HTML not persisted"
  );
  assert(
    JSON.stringify(afterEdit.generated_content) === JSON.stringify(priorJson),
    "generated_content mutated on edit save"
  );

  console.log("7) Download PDF (Chromium)…");
  const pdf = await htmlToPdfBuffer(afterEdit.generated_html!);
  assert(pdf.subarray(0, 4).toString() === "%PDF", "invalid PDF magic");
  assert(pdf.byteLength > 2000, "PDF too small");
  const pdfPath = join(tmpdir(), "campusos-e2e-html-resume.pdf");
  writeFileSync(pdfPath, pdf);
  console.log("   PDF:", pdfPath, pdf.byteLength, "bytes");

  console.log("8) Download DOCX…");
  const docx = await HTMLtoDOCX(afterEdit.generated_html!, null, {
    title: "Resume",
    creator: "CampusOS E2E",
  });
  const docxBuf = Buffer.isBuffer(docx) ? docx : Buffer.from(docx as ArrayBuffer);
  assert(docxBuf.byteLength > 1000, "DOCX too small");
  const docxPath = join(tmpdir(), "campusos-e2e-html-resume.docx");
  writeFileSync(docxPath, docxBuf);
  console.log("   DOCX:", docxPath, docxBuf.byteLength, "bytes");

  console.log("\ne2e-html-resume-flow: PASS");
  console.log("resumeId:", resume.id);
}

main().catch((err) => {
  console.error("e2e-html-resume-flow: FAIL", err);
  process.exit(1);
});
