"use client";

import type { TailoredResumeContent, ResumeTemplateId } from "@/lib/types";

export type ResumeContact = {
  full_name: string | null;
  state: string | null;
  phone: string | null;
  work_email: string | null;
  linkedin: string | null;
  professional_title: string | null;
};

type Props = {
  template: ResumeTemplateId;
  contact: ResumeContact;
  content: TailoredResumeContent;
  onBulletChange?: (
    expIndex: number,
    bulletIndex: number,
    value: string
  ) => void;
  editable?: boolean;
};

function contactLine(c: ResumeContact): string {
  return [c.phone, c.work_email, c.state, c.linkedin]
    .filter((x) => x?.trim())
    .join("  |  ");
}

function formatPlace(location: string, state?: string | null): string {
  const loc = location?.trim() || "";
  const st = state?.trim() || "";
  if (loc && st) return `${loc}, ${st}`;
  return loc || st;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-4 border-b border-neutral-800 pb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-900">
      {children}
    </h2>
  );
}

function Bullets({
  items,
  expIndex,
  editable,
  onBulletChange,
}: {
  items: string[] | undefined | null;
  expIndex?: number;
  editable?: boolean;
  onBulletChange?: Props["onBulletChange"];
}) {
  const list = items ?? [];
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-neutral-800">
      {list.map((b, i) => (
        <li key={i}>
          {editable && onBulletChange && expIndex != null ? (
            <input
              className="w-full border-b border-transparent bg-transparent outline-none hover:border-neutral-300 focus:border-violet-400"
              value={b}
              onChange={(e) => onBulletChange(expIndex, i, e.target.value)}
            />
          ) : (
            b
          )}
        </li>
      ))}
    </ul>
  );
}

function TwoCol({ items }: { items: string[] }) {
  const mid = Math.ceil(items.length / 2);
  const left = items.slice(0, mid);
  const right = items.slice(mid);
  return (
    <div className="mt-1 grid grid-cols-2 gap-x-4 text-[11px] text-neutral-800">
      <ul className="list-disc space-y-0.5 pl-4">
        {left.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
      <ul className="list-disc space-y-0.5 pl-4">
        {right.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

function ExperienceEmpty() {
  return (
    <p className="mt-1 text-[11px] text-neutral-500">
      No experience entries in this draft.
    </p>
  );
}

function MultiCol({ items }: { items: string[] }) {
  return (
    <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-1 text-[11px] text-neutral-800 sm:grid-cols-4">
      {items.map((s, i) => (
        <span key={i}>{s}</span>
      ))}
    </div>
  );
}

export function ResumePreviewPaper({
  template,
  contact,
  content: rawContent,
  onBulletChange,
  editable,
}: Props) {
  const name = contact.full_name?.trim() || "Your Name";
  const line = contactLine(contact);
  const experience = rawContent.experience ?? [];
  const education = rawContent.education ?? {
    school: "",
    degreeLine: "",
    location: null,
    date: null,
    details: [],
  };
  const content = { ...rawContent, experience, education };

  if (template === "A") {
    return (
      <article className="resume-paper mx-auto max-w-[8.5in] bg-white px-10 py-8 text-neutral-900 shadow-lg">
        <header className="text-center">
          <h1 className="font-serif text-2xl font-bold tracking-wide">{name}</h1>
          <p className="mt-1 text-[11px] text-neutral-700">{line}</p>
        </header>

        <SectionTitle>Education</SectionTitle>
        <div className="mt-1 flex justify-between gap-4 text-[12px]">
          <div>
            <p className="font-bold">{content.education.school}</p>
            <p className="italic text-neutral-700">{content.education.degreeLine}</p>
            {content.education.details?.map((d, i) => (
              <p key={i} className="text-[11px] text-neutral-700">
                {d}
              </p>
            ))}
          </div>
          <div className="shrink-0 text-right text-[11px] text-neutral-700">
            {content.education.location && <p>{content.education.location}</p>}
            {content.education.date && <p>{content.education.date}</p>}
          </div>
        </div>

        <SectionTitle>Experience</SectionTitle>
        {content.experience.length === 0 ? (
          <ExperienceEmpty />
        ) : (
          content.experience.map((e, i) => (
          <div key={i} className="mt-2">
            <div className="flex justify-between gap-4 text-[12px]">
              <p className="font-bold">{e.title}</p>
              <p className="shrink-0 text-[11px] text-neutral-700">
                {formatPlace(e.location, e.state)}
              </p>
            </div>
            <div className="flex justify-between gap-4 text-[12px]">
              <p className="italic text-neutral-700">{e.company}</p>
              <p className="shrink-0 text-[11px] text-neutral-700">{e.endDate}</p>
            </div>
            <Bullets
              items={e.bullets}
              expIndex={i}
              editable={editable}
              onBulletChange={onBulletChange}
            />
          </div>
          ))
        )}

        {(content.projects?.length ?? 0) > 0 && (
          <>
            <SectionTitle>Projects</SectionTitle>
            {content.projects!.map((p, i) => (
              <div key={i} className="mt-2 text-[12px]">
                <div className="flex justify-between">
                  <p className="font-bold">{p.title}</p>
                  <p className="text-[11px] text-neutral-700">{p.dateContext}</p>
                </div>
                <p className="text-[11px] text-neutral-800">{p.description}</p>
              </div>
            ))}
          </>
        )}

        {(content.extracurriculars?.length ?? 0) > 0 && (
          <>
            <SectionTitle>Extracurriculars</SectionTitle>
            <ul className="mt-1 list-disc pl-4 text-[11px]">
              {content.extracurriculars!.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </>
        )}

        {(content.certifications?.length ?? 0) > 0 && (
          <>
            <SectionTitle>Certifications</SectionTitle>
            <ul className="mt-1 list-disc pl-4 text-[11px]">
              {content.certifications!.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </>
        )}

        {(content.achievements?.length ?? 0) > 0 && (
          <>
            <SectionTitle>Achievements</SectionTitle>
            <ul className="mt-1 list-disc pl-4 text-[11px]">
              {content.achievements!.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </>
        )}
      </article>
    );
  }

  if (template === "B") {
    return (
      <article className="resume-paper mx-auto max-w-[8.5in] bg-white px-10 py-8 font-sans text-neutral-900 shadow-lg">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          {contact.professional_title && (
            <p className="text-sm text-neutral-600">{contact.professional_title}</p>
          )}
          <p className="mt-1 text-[11px] text-neutral-700">{line}</p>
        </header>

        {content.summary && (
          <>
            <SectionTitle>Summary</SectionTitle>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-800">
              {content.summary}
            </p>
          </>
        )}

        {(content.technicalSkills?.length ?? 0) > 0 && (
          <>
            <SectionTitle>Technical Skills</SectionTitle>
            <TwoCol items={content.technicalSkills!} />
          </>
        )}

        <SectionTitle>Professional Experience</SectionTitle>
        {content.experience.length === 0 ? (
          <ExperienceEmpty />
        ) : (
          content.experience.map((e, i) => (
          <div key={i} className="mt-2">
            <div className="flex justify-between text-[12px]">
              <p className="font-bold">
                {e.title} — {e.company}
              </p>
              <p className="text-[11px] text-neutral-700">{e.endDate}</p>
            </div>
            <p className="text-[11px] text-neutral-600">
              {formatPlace(e.location, e.state)}
            </p>
            <Bullets
              items={e.bullets}
              expIndex={i}
              editable={editable}
              onBulletChange={onBulletChange}
            />
          </div>
          ))
        )}

        <SectionTitle>Education</SectionTitle>
        <div className="mt-1 flex justify-between text-[12px]">
          <div>
            <p className="font-bold">{content.education.school}</p>
            <p className="text-neutral-700">{content.education.degreeLine}</p>
          </div>
          <p className="text-[11px] text-neutral-700">{content.education.date}</p>
        </div>

        {(
          [
            ...(content.additional ?? []),
            ...(content.certifications ?? []),
            ...(content.achievements ?? []),
            ...(content.extracurriculars ?? []),
          ].length > 0
        ) && (
          <>
            <SectionTitle>Additional Info</SectionTitle>
            <ul className="mt-1 list-disc pl-4 text-[11px]">
              {[
                ...(content.additional ?? []),
                ...(content.certifications ?? []).map((c) => `Cert: ${c}`),
                ...(content.achievements ?? []),
                ...(content.extracurriculars ?? []),
              ].map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </>
        )}
      </article>
    );
  }

  // Template C
  return (
    <article className="resume-paper mx-auto max-w-[8.5in] bg-white px-10 py-8 font-sans text-neutral-900 shadow-lg">
      <header className="text-center">
        <h1 className="text-2xl font-bold uppercase tracking-widest">{name}</h1>
        <p className="mt-1 text-[11px] text-neutral-700">{line}</p>
      </header>

      {content.summary && (
        <>
          <SectionTitle>Summary</SectionTitle>
          <p className="mt-1 text-[11px] leading-relaxed">{content.summary}</p>
        </>
      )}

      <SectionTitle>Education</SectionTitle>
      <div className="mt-1 text-[12px]">
        <p className="font-bold">{content.education.degreeLine}</p>
        <p className="text-neutral-700">
          {content.education.school}
          {content.education.date ? ` · ${content.education.date}` : ""}
        </p>
      </div>

      <SectionTitle>Experience</SectionTitle>
      {content.experience.length === 0 ? (
        <ExperienceEmpty />
      ) : (
        content.experience.map((e, i) => (
        <div key={i} className="mt-2">
          <div className="flex justify-between text-[12px]">
            <p className="font-bold">
              {e.title}, {e.company}
            </p>
            <p className="text-[11px]">{e.endDate}</p>
          </div>
          <Bullets
            items={e.bullets}
            expIndex={i}
            editable={editable}
            onBulletChange={onBulletChange}
          />
        </div>
        ))
      )}

      {(content.professionalSkills?.length ?? 0) > 0 && (
        <>
          <SectionTitle>Professional Skills</SectionTitle>
          <TwoCol items={content.professionalSkills!} />
        </>
      )}

      {(content.technicalSkills?.length ?? 0) > 0 && (
        <>
          <SectionTitle>Technical Skills</SectionTitle>
          <MultiCol items={content.technicalSkills!} />
        </>
      )}

      {(content.certifications?.length ?? 0) > 0 && (
        <>
          <SectionTitle>Certifications</SectionTitle>
          <TwoCol items={content.certifications!} />
        </>
      )}
    </article>
  );
}
