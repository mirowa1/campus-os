"use client";

import { useEffect, useRef, useState } from "react";
import {
  displayLinkedIn,
  formatPlace,
  hasText,
  joinNonEmpty,
} from "@/lib/resume-format";
import type { TailoredResumeContent, ResumeTemplateId } from "@/lib/types";

export type ResumeContact = {
  full_name: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  work_email: string | null;
  linkedin: string | null;
  professional_title: string | null;
};

export type ContentUpdater = (
  prev: TailoredResumeContent
) => TailoredResumeContent;

type Props = {
  template: ResumeTemplateId;
  contact: ResumeContact;
  content: TailoredResumeContent;
  onContactChange?: (patch: Partial<ResumeContact>) => void;
  onContentChange?: (updater: ContentUpdater) => void;
  editable?: boolean;
};

const fieldChrome =
  "border-b border-transparent bg-transparent outline-none hover:border-neutral-300 focus:border-violet-400";

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-4 border-b border-neutral-800 pb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-900">
      {children}
    </h2>
  );
}

/** Wrapping idle text; textarea on focus — never clips mid-word. */
function GrowField({
  value,
  onChange,
  editable,
  className = "",
  ariaLabel,
  displayValue,
}: {
  value: string;
  onChange?: (v: string) => void;
  editable?: boolean;
  className?: string;
  ariaLabel?: string;
  displayValue?: string;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const shown = displayValue !== undefined ? displayValue : value;

  useEffect(() => {
    if (!editing || !ref.current) return;
    const el = ref.current;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [editing]);

  useEffect(() => {
    if (!editing || !ref.current) return;
    const el = ref.current;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, value]);

  if (!editable || !onChange) {
    if (!hasText(shown)) return null;
    return (
      <p
        className={`whitespace-pre-wrap break-words overflow-visible ${className}`}
      >
        {shown}
      </p>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        className={`block w-full cursor-text text-left whitespace-pre-wrap break-words overflow-visible ${fieldChrome} ${className}`}
        onClick={() => setEditing(true)}
      >
        {hasText(shown) ? (
          shown
        ) : (
          <span className="inline-block min-h-[1em] min-w-[2rem]">&nbsp;</span>
        )}
      </button>
    );
  }

  return (
    <textarea
      ref={ref}
      aria-label={ariaLabel}
      className={`${fieldChrome} w-full resize-none overflow-hidden whitespace-pre-wrap break-words ${className}`}
      value={value}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEditing(false)}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
    />
  );
}

/** Short single-line click-to-edit (titles, dates, city, state). */
function LineField({
  value,
  onChange,
  editable,
  className = "",
  ariaLabel,
  align = "left",
  displayValue,
}: {
  value: string;
  onChange?: (v: string) => void;
  editable?: boolean;
  className?: string;
  ariaLabel?: string;
  align?: "left" | "right" | "center";
  displayValue?: string;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const shown = displayValue !== undefined ? displayValue : value;
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "";
  const widthClass = /\bw-/.test(className) ? "" : "w-full";

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
  }, [editing]);

  if (!editable || !onChange) {
    if (!hasText(shown)) return null;
    return <span className={`${className} ${alignClass}`}>{shown}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        className={`block cursor-text ${widthClass} ${alignClass} ${fieldChrome} ${className}`}
        onClick={() => setEditing(true)}
      >
        {hasText(shown) ? (
          shown
        ) : (
          <span className="inline-block min-h-[1em] min-w-[1.5rem]">&nbsp;</span>
        )}
      </button>
    );
  }

  return (
    <input
      ref={ref}
      aria-label={ariaLabel}
      className={`${fieldChrome} ${widthClass} ${alignClass} ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEditing(false)}
    />
  );
}

function EditableList({
  items,
  editable,
  onItemChange,
  className = "mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-neutral-800",
}: {
  items: string[];
  editable?: boolean;
  onItemChange?: (index: number, value: string) => void;
  className?: string;
}) {
  return (
    <ul className={className}>
      {items.map((b, i) => (
        <li key={i} className="overflow-visible">
          <GrowField
            value={b}
            editable={editable}
            ariaLabel={`Bullet ${i + 1}`}
            className="text-[11px] leading-snug text-neutral-800"
            onChange={onItemChange ? (v) => onItemChange(i, v) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

function TwoCol({
  items,
  editable,
  onItemChange,
}: {
  items: string[];
  editable?: boolean;
  onItemChange?: (index: number, value: string) => void;
}) {
  const mid = Math.ceil(items.length / 2);
  const left = items.slice(0, mid);
  const right = items.slice(mid);
  return (
    <div className="mt-1 grid grid-cols-2 gap-x-4 text-[11px] text-neutral-800">
      <ul className="list-disc space-y-0.5 pl-4">
        {left.map((s, i) => (
          <li key={i}>
            <LineField
              value={s}
              editable={editable}
              ariaLabel={`Skill ${i + 1}`}
              onChange={onItemChange ? (v) => onItemChange(i, v) : undefined}
            />
          </li>
        ))}
      </ul>
      <ul className="list-disc space-y-0.5 pl-4">
        {right.map((s, i) => (
          <li key={i}>
            <LineField
              value={s}
              editable={editable}
              ariaLabel={`Skill ${mid + i + 1}`}
              onChange={
                onItemChange ? (v) => onItemChange(mid + i, v) : undefined
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MultiCol({
  items,
  editable,
  onItemChange,
}: {
  items: string[];
  editable?: boolean;
  onItemChange?: (index: number, value: string) => void;
}) {
  return (
    <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-1 text-[11px] text-neutral-800 sm:grid-cols-4">
      {items.map((s, i) => (
        <LineField
          key={i}
          value={s}
          editable={editable}
          ariaLabel={`Skill ${i + 1}`}
          onChange={onItemChange ? (v) => onItemChange(i, v) : undefined}
        />
      ))}
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

function ContactHeaderFields({
  contact,
  editable,
  onContactChange,
  centered,
  showTitle,
  caps,
}: {
  contact: ResumeContact;
  editable?: boolean;
  onContactChange?: (patch: Partial<ResumeContact>) => void;
  centered?: boolean;
  showTitle?: boolean;
  caps?: boolean;
}) {
  const align = centered ? "center" : "left";
  const nameClass = caps
    ? "text-2xl font-bold uppercase tracking-widest"
    : showTitle
      ? "text-2xl font-bold tracking-tight"
      : "font-serif text-2xl font-bold tracking-wide";

  if (!editable || !onContactChange) {
    return (
      <>
        <h1 className={nameClass}>
          {contact.full_name?.trim() || "Your Name"}
        </h1>
        {showTitle && hasText(contact.professional_title) && (
          <p className="text-sm text-neutral-600">{contact.professional_title}</p>
        )}
        {hasText(contactLine(contact)) && (
          <p
            className={`mt-1 text-[11px] text-neutral-700 ${centered ? "text-center" : ""}`}
          >
            {contactLine(contact)}
          </p>
        )}
      </>
    );
  }

  return (
    <div className={centered ? "text-center" : ""}>
      <LineField
        editable
        value={contact.full_name ?? ""}
        ariaLabel="Full name"
        align={align}
        className={nameClass}
        onChange={(v) => onContactChange({ full_name: v })}
      />
      {showTitle && (
        <LineField
          editable
          value={contact.professional_title ?? ""}
          ariaLabel="Professional title"
          className="mt-0.5 text-sm text-neutral-600"
          onChange={(v) => onContactChange({ professional_title: v })}
        />
      )}
      <div
        className={`mt-1 grid gap-0.5 text-[11px] text-neutral-700 ${centered ? "mx-auto max-w-lg" : ""}`}
      >
        <LineField
          editable
          value={contact.phone ?? ""}
          ariaLabel="Phone"
          align={align}
          onChange={(v) => onContactChange({ phone: v })}
        />
        <LineField
          editable
          value={contact.work_email ?? ""}
          ariaLabel="Email"
          align={align}
          onChange={(v) => onContactChange({ work_email: v })}
        />
        <div
          className={`flex flex-wrap gap-1 ${centered ? "justify-center" : ""}`}
        >
          <LineField
            editable
            value={contact.city ?? ""}
            ariaLabel="City"
            align={align}
            className="min-w-[6rem] flex-1"
            onChange={(v) => onContactChange({ city: v })}
          />
          <LineField
            editable
            value={contact.state ?? ""}
            ariaLabel="State"
            align={align}
            className="w-12"
            onChange={(v) => onContactChange({ state: v })}
          />
        </div>
        <LineField
          editable
          value={contact.linkedin ?? ""}
          ariaLabel="LinkedIn"
          align={align}
          displayValue={displayLinkedIn(contact.linkedin)}
          onChange={(v) => onContactChange({ linkedin: v })}
        />
      </div>
    </div>
  );
}

function patchArray(
  arr: string[] | undefined,
  index: number,
  value: string
): string[] {
  const next = [...(arr ?? [])];
  next[index] = value;
  return next;
}

/** Read-only joined title/company. Edit mode stacks fields (no inline separators). */
function TitleCompanyLine({
  template,
  title,
  company,
  editable,
  onTitle,
  onCompany,
}: {
  template: "B" | "C";
  title: string;
  company: string;
  editable?: boolean;
  onTitle: (v: string) => void;
  onCompany: (v: string) => void;
}) {
  const sep = template === "B" ? " — " : ", ";
  if (editable) {
    return (
      <div className="min-w-0 flex-1 space-y-0.5">
        <LineField
          editable
          value={title}
          ariaLabel="Job title"
          className="font-bold"
          onChange={onTitle}
        />
        <LineField
          editable
          value={company}
          ariaLabel="Company"
          className="font-bold text-neutral-700"
          onChange={onCompany}
        />
      </div>
    );
  }
  const line = joinNonEmpty([title, company], sep);
  if (!line) return null;
  return <p className="font-bold">{line}</p>;
}

function ExperienceBlock({
  template,
  experience,
  editable,
  onContentChange,
}: {
  template: ResumeTemplateId;
  experience: TailoredResumeContent["experience"];
  editable?: boolean;
  onContentChange?: (updater: ContentUpdater) => void;
}) {
  if (experience.length === 0) return <ExperienceEmpty />;

  const patchExp = (
    i: number,
    patch: Partial<TailoredResumeContent["experience"][number]>
  ) => {
    onContentChange?.((prev) => ({
      ...prev,
      experience: (prev.experience ?? []).map((e, idx) =>
        idx === i ? { ...e, ...patch } : e
      ),
    }));
  };

  return (
    <>
      {experience.map((e, i) => {
        const place = formatPlace(e.location, e.state);
        return (
          <div key={i} className="mt-2">
            {template === "A" && (
              <>
                {(hasText(e.title) || editable) && (
                  <div className="flex justify-between gap-4 text-[12px]">
                    <LineField
                      editable={editable}
                      value={e.title}
                      ariaLabel="Job title"
                      className="font-bold"
                      onChange={(v) => patchExp(i, { title: v })}
                    />
                    {editable ? (
                      <div className="flex shrink-0 gap-1 text-[11px] text-neutral-700">
                        <LineField
                          editable
                          value={e.location}
                          ariaLabel="City"
                          align="right"
                          className="w-24"
                          onChange={(v) => patchExp(i, { location: v })}
                        />
                        <LineField
                          editable
                          value={e.state ?? ""}
                          ariaLabel="State"
                          align="right"
                          className="w-10"
                          onChange={(v) => patchExp(i, { state: v })}
                        />
                      </div>
                    ) : (
                      hasText(place) && (
                        <p className="shrink-0 text-[11px] text-neutral-700">
                          {place}
                        </p>
                      )
                    )}
                  </div>
                )}
                {(hasText(e.company) ||
                  hasText(e.endDate) ||
                  editable) && (
                  <div className="flex justify-between gap-4 text-[12px]">
                    <LineField
                      editable={editable}
                      value={e.company}
                      ariaLabel="Company"
                      className="italic text-neutral-700"
                      onChange={(v) => patchExp(i, { company: v })}
                    />
                    <LineField
                      editable={editable}
                      value={e.endDate}
                      ariaLabel="End date"
                      align="right"
                      className="shrink-0 text-[11px] text-neutral-700"
                      onChange={(v) => patchExp(i, { endDate: v })}
                    />
                  </div>
                )}
              </>
            )}
            {(template === "B" || template === "C") && (
              <>
                {(editable ||
                  hasText(e.title) ||
                  hasText(e.company) ||
                  hasText(e.endDate)) && (
                  <div className="flex justify-between gap-4 text-[12px]">
                    <TitleCompanyLine
                      template={template}
                      title={e.title}
                      company={e.company}
                      editable={editable}
                      onTitle={(v) => patchExp(i, { title: v })}
                      onCompany={(v) => patchExp(i, { company: v })}
                    />
                    {(editable || hasText(e.endDate)) && (
                      <LineField
                        editable={editable}
                        value={e.endDate}
                        ariaLabel="End date"
                        align="right"
                        className="shrink-0 text-[11px] text-neutral-700"
                        onChange={(v) => patchExp(i, { endDate: v })}
                      />
                    )}
                  </div>
                )}
                {(editable || hasText(place)) &&
                  (editable ? (
                    <div className="flex gap-1 text-[11px] text-neutral-600">
                      <LineField
                        editable
                        value={e.location}
                        ariaLabel="City"
                        className="w-28"
                        onChange={(v) => patchExp(i, { location: v })}
                      />
                      <LineField
                        editable
                        value={e.state ?? ""}
                        ariaLabel="State"
                        className="w-10"
                        onChange={(v) => patchExp(i, { state: v })}
                      />
                    </div>
                  ) : (
                    <p className="text-[11px] text-neutral-600">{place}</p>
                  ))}
              </>
            )}
            <EditableList
              items={e.bullets ?? []}
              editable={editable}
              onItemChange={
                onContentChange
                  ? (bi, v) =>
                      patchExp(i, {
                        bullets: patchArray(e.bullets, bi, v),
                      })
                  : undefined
              }
            />
          </div>
        );
      })}
    </>
  );
}

function EducationBlock({
  template,
  education,
  editable,
  onPatch,
}: {
  template: ResumeTemplateId;
  education: TailoredResumeContent["education"];
  editable?: boolean;
  onPatch: (patch: Partial<TailoredResumeContent["education"]>) => void;
}) {
  const place = formatPlace(education.location, education.state);

  if (template === "C") {
    const schoolDate = joinNonEmpty(
      [education.school, education.date],
      " · "
    );
    return (
      <div className="mt-1 text-[12px]">
        <LineField
          editable={editable}
          value={education.degreeLine}
          ariaLabel="Degree"
          className="font-bold"
          onChange={(v) => onPatch({ degreeLine: v })}
        />
        {editable ? (
          <div className="flex flex-wrap items-baseline gap-1 text-neutral-700">
            <LineField
              editable
              value={education.school}
              ariaLabel="School"
              onChange={(v) => onPatch({ school: v })}
            />
            {hasText(education.school) && hasText(education.date) && (
              <span>·</span>
            )}
            <LineField
              editable
              value={education.date ?? ""}
              ariaLabel="Graduation date"
              className="w-28"
              onChange={(v) => onPatch({ date: v })}
            />
          </div>
        ) : (
          hasText(schoolDate) && (
            <p className="text-neutral-700">{schoolDate}</p>
          )
        )}
        {(editable || hasText(place)) &&
          (editable ? (
            <div className="mt-0.5 flex gap-1 text-[11px] text-neutral-700">
              <LineField
                editable
                value={education.location ?? ""}
                ariaLabel="School city"
                className="w-28"
                onChange={(v) => onPatch({ location: v })}
              />
              <LineField
                editable
                value={education.state ?? ""}
                ariaLabel="School state"
                className="w-10"
                onChange={(v) => onPatch({ state: v })}
              />
            </div>
          ) : (
            <p className="text-[11px] text-neutral-700">{place}</p>
          ))}
      </div>
    );
  }

  return (
    <div className="mt-1 flex justify-between gap-4 text-[12px]">
      <div className="min-w-0 flex-1">
        <LineField
          editable={editable}
          value={education.school}
          ariaLabel="School"
          className="font-bold"
          onChange={(v) => onPatch({ school: v })}
        />
        <LineField
          editable={editable}
          value={education.degreeLine}
          ariaLabel="Degree"
          className={
            template === "A" ? "italic text-neutral-700" : "text-neutral-700"
          }
          onChange={(v) => onPatch({ degreeLine: v })}
        />
        {(education.details?.length ?? 0) > 0 && (
          <EditableList
            items={education.details!}
            editable={editable}
            className="mt-0.5 list-none space-y-0.5 pl-0 text-[11px] text-neutral-700"
            onItemChange={(i, v) =>
              onPatch({
                details: patchArray(education.details, i, v),
              })
            }
          />
        )}
      </div>
      <div className="w-36 shrink-0 text-right text-[11px] text-neutral-700">
        {editable ? (
          <>
            <LineField
              editable
              value={education.location ?? ""}
              ariaLabel="School city"
              align="right"
              onChange={(v) => onPatch({ location: v })}
            />
            <LineField
              editable
              value={education.state ?? ""}
              ariaLabel="School state"
              align="right"
              className="ml-auto w-10"
              onChange={(v) => onPatch({ state: v })}
            />
            <LineField
              editable
              value={education.date ?? ""}
              ariaLabel="Graduation date"
              align="right"
              onChange={(v) => onPatch({ date: v })}
            />
          </>
        ) : (
          <>
            {hasText(place) && <p>{place}</p>}
            {hasText(education.date) && <p>{education.date}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function ProjectsSection({
  projects,
  editable,
  onContentChange,
}: {
  projects: NonNullable<TailoredResumeContent["projects"]>;
  editable?: boolean;
  onContentChange?: (updater: ContentUpdater) => void;
}) {
  return (
    <>
      <SectionTitle>Projects</SectionTitle>
      {projects.map((p, i) => (
        <div key={i} className="mt-2 text-[12px]">
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0 flex-1">
              {(editable || hasText(p.title)) && (
                <LineField
                  editable={editable}
                  value={p.title}
                  ariaLabel="Project title"
                  className="font-bold"
                  onChange={(v) =>
                    onContentChange?.((prev) => ({
                      ...prev,
                      projects: (prev.projects ?? []).map((x, idx) =>
                        idx === i ? { ...x, title: v } : x
                      ),
                    }))
                  }
                />
              )}
            </div>
            {(editable || hasText(p.dateContext)) && (
              <LineField
                editable={editable}
                value={p.dateContext}
                ariaLabel="Project date"
                align="right"
                className="w-28 shrink-0 text-[11px] text-neutral-700"
                onChange={(v) =>
                  onContentChange?.((prev) => ({
                    ...prev,
                    projects: (prev.projects ?? []).map((x, idx) =>
                      idx === i ? { ...x, dateContext: v } : x
                    ),
                  }))
                }
              />
            )}
          </div>
          <GrowField
            editable={editable}
            value={p.description}
            ariaLabel="Project description"
            className="mt-0.5 text-[11px] text-neutral-800"
            onChange={(v) =>
              onContentChange?.((prev) => ({
                ...prev,
                projects: (prev.projects ?? []).map((x, idx) =>
                  idx === i ? { ...x, description: v } : x
                ),
              }))
            }
          />
        </div>
      ))}
    </>
  );
}

function StringListSection({
  title,
  items,
  editable,
  onItemChange,
}: {
  title: string;
  items: string[];
  editable?: boolean;
  onItemChange?: (index: number, value: string) => void;
}) {
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <EditableList
        items={items}
        editable={editable}
        onItemChange={onItemChange}
      />
    </>
  );
}

export function ResumePreviewPaper({
  template,
  contact,
  content: rawContent,
  onContactChange,
  onContentChange,
  editable,
}: Props) {
  const experience = rawContent.experience ?? [];
  const education = rawContent.education ?? {
    school: "",
    degreeLine: "",
    location: null,
    state: null,
    date: null,
    details: [],
  };
  const content = { ...rawContent, experience, education };

  const patchEdu = (patch: Partial<TailoredResumeContent["education"]>) => {
    onContentChange?.((prev) => ({
      ...prev,
      education: { ...(prev.education ?? education), ...patch },
    }));
  };

  const patchList = (
    key:
      | "technicalSkills"
      | "professionalSkills"
      | "certifications"
      | "achievements"
      | "extracurriculars"
      | "additional",
    index: number,
    value: string
  ) => {
    onContentChange?.((prev) => ({
      ...prev,
      [key]: patchArray(prev[key], index, value),
    }));
  };

  const sharedTail = (
    <>
      {(content.projects?.length ?? 0) > 0 && (
        <ProjectsSection
          projects={content.projects!}
          editable={editable}
          onContentChange={onContentChange}
        />
      )}
      {(content.extracurriculars?.length ?? 0) > 0 && (
        <StringListSection
          title="Extracurriculars"
          items={content.extracurriculars!}
          editable={editable}
          onItemChange={(i, v) => patchList("extracurriculars", i, v)}
        />
      )}
      {(content.certifications?.length ?? 0) > 0 && (
        <StringListSection
          title="Certifications"
          items={content.certifications!}
          editable={editable}
          onItemChange={(i, v) => patchList("certifications", i, v)}
        />
      )}
      {(content.achievements?.length ?? 0) > 0 && (
        <StringListSection
          title="Achievements"
          items={content.achievements!}
          editable={editable}
          onItemChange={(i, v) => patchList("achievements", i, v)}
        />
      )}
      {(content.additional?.length ?? 0) > 0 && (
        <StringListSection
          title="Additional"
          items={content.additional!}
          editable={editable}
          onItemChange={(i, v) => patchList("additional", i, v)}
        />
      )}
    </>
  );

  if (template === "A") {
    return (
      <article className="resume-paper mx-auto max-w-[8.5in] bg-white px-10 py-8 text-neutral-900 shadow-lg">
        <header className="text-center">
          <ContactHeaderFields
            contact={contact}
            editable={editable}
            onContactChange={onContactChange}
            centered
          />
        </header>
        <SectionTitle>Education</SectionTitle>
        <EducationBlock
          template="A"
          education={content.education}
          editable={editable}
          onPatch={patchEdu}
        />
        <SectionTitle>Experience</SectionTitle>
        <ExperienceBlock
          template="A"
          experience={content.experience}
          editable={editable}
          onContentChange={onContentChange}
        />
        {sharedTail}
      </article>
    );
  }

  if (template === "B") {
    return (
      <article className="resume-paper mx-auto max-w-[8.5in] bg-white px-10 py-8 font-sans text-neutral-900 shadow-lg">
        <header>
          <ContactHeaderFields
            contact={contact}
            editable={editable}
            onContactChange={onContactChange}
            showTitle
          />
        </header>
        {(hasText(content.summary) || editable) && (
          <>
            <SectionTitle>Summary</SectionTitle>
            <GrowField
              editable={editable}
              value={content.summary ?? ""}
              ariaLabel="Summary"
              className="mt-1 text-[11px] leading-relaxed text-neutral-800"
              onChange={(v) =>
                onContentChange?.((prev) => ({ ...prev, summary: v }))
              }
            />
          </>
        )}
        {(content.technicalSkills?.length ?? 0) > 0 && (
          <>
            <SectionTitle>Technical Skills</SectionTitle>
            <TwoCol
              items={content.technicalSkills!}
              editable={editable}
              onItemChange={(i, v) => patchList("technicalSkills", i, v)}
            />
          </>
        )}
        <SectionTitle>Professional Experience</SectionTitle>
        <ExperienceBlock
          template="B"
          experience={content.experience}
          editable={editable}
          onContentChange={onContentChange}
        />
        <SectionTitle>Education</SectionTitle>
        <EducationBlock
          template="B"
          education={content.education}
          editable={editable}
          onPatch={patchEdu}
        />
        {sharedTail}
      </article>
    );
  }

  // Template C
  return (
    <article className="resume-paper mx-auto max-w-[8.5in] bg-white px-10 py-8 font-sans text-neutral-900 shadow-lg">
      <header className="text-center">
        <ContactHeaderFields
          contact={contact}
          editable={editable}
          onContactChange={onContactChange}
          centered
          caps
        />
      </header>
      {(hasText(content.summary) || editable) && (
        <>
          <SectionTitle>Summary</SectionTitle>
          <GrowField
            editable={editable}
            value={content.summary ?? ""}
            ariaLabel="Summary"
            className="mt-1 text-[11px] leading-relaxed"
            onChange={(v) =>
              onContentChange?.((prev) => ({ ...prev, summary: v }))
            }
          />
        </>
      )}
      <SectionTitle>Education</SectionTitle>
      <EducationBlock
        template="C"
        education={content.education}
        editable={editable}
        onPatch={patchEdu}
      />
      <SectionTitle>Experience</SectionTitle>
      <ExperienceBlock
        template="C"
        experience={content.experience}
        editable={editable}
        onContentChange={onContentChange}
      />
      {(content.professionalSkills?.length ?? 0) > 0 && (
        <>
          <SectionTitle>Professional Skills</SectionTitle>
          <TwoCol
            items={content.professionalSkills!}
            editable={editable}
            onItemChange={(i, v) => patchList("professionalSkills", i, v)}
          />
        </>
      )}
      {(content.technicalSkills?.length ?? 0) > 0 && (
        <>
          <SectionTitle>Technical Skills</SectionTitle>
          <MultiCol
            items={content.technicalSkills!}
            editable={editable}
            onItemChange={(i, v) => patchList("technicalSkills", i, v)}
          />
        </>
      )}
      {sharedTail}
    </article>
  );
}
