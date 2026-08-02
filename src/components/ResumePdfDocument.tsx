import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ResumeContact } from "@/components/ResumePreviewPaper";
import {
  displayLinkedIn,
  formatPlace,
  hasText,
  joinNonEmpty,
} from "@/lib/resume-format";
import type { ResumeTemplateId, TailoredResumeContent } from "@/lib/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    fontSize: 10,
    color: "#171717",
    fontFamily: "Times-Roman",
  },
  pageSans: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    fontSize: 10,
    color: "#171717",
    fontFamily: "Helvetica",
  },
  nameCenter: {
    fontSize: 18,
    textAlign: "center",
    fontFamily: "Times-Bold",
    marginBottom: 4,
  },
  nameLeft: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  nameCaps: {
    fontSize: 16,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 4,
  },
  contact: {
    fontSize: 9,
    textAlign: "center",
    color: "#404040",
    marginBottom: 10,
  },
  contactLeft: {
    fontSize: 9,
    color: "#404040",
    marginBottom: 10,
  },
  section: {
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#171717",
    paddingBottom: 2,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  bold: { fontFamily: "Helvetica-Bold" },
  italic: { fontFamily: "Times-Italic" },
  muted: { color: "#525252", fontSize: 9 },
  bulletRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: 2,
    paddingRight: 4,
  },
  bulletGlyph: {
    width: 12,
    fontSize: 9.5,
    lineHeight: 1.35,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 1.35,
  },
  twoCol: { flexDirection: "row", marginTop: 4 },
  col: { width: "50%", paddingRight: 8 },
  multi: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  chip: { width: "25%", fontSize: 9, marginBottom: 3 },
  body: { marginTop: 4, fontSize: 9.5, lineHeight: 1.4 },
});

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

function Bullets({ items }: { items: string[] | undefined | null }) {
  const list = items ?? [];
  return (
    <View style={{ width: "100%" }}>
      {list.map((b, i) => (
        <View key={i} style={styles.bulletRow} wrap>
          <Text style={styles.bulletGlyph}>•</Text>
          <Text style={styles.bulletText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

function TwoCol({ items }: { items: string[] }) {
  const mid = Math.ceil(items.length / 2);
  return (
    <View style={styles.twoCol}>
      <View style={styles.col}>
        {items.slice(0, mid).map((s, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletGlyph}>•</Text>
            <Text style={styles.bulletText}>{s}</Text>
          </View>
        ))}
      </View>
      <View style={styles.col}>
        {items.slice(mid).map((s, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletGlyph}>•</Text>
            <Text style={styles.bulletText}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StringListSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <>
      <Text style={styles.section}>{title}</Text>
      {items.map((x, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletGlyph}>•</Text>
          <Text style={styles.bulletText}>{x}</Text>
        </View>
      ))}
    </>
  );
}

export function ResumePdfDocument({
  template,
  contact,
  content: rawContent,
}: {
  template: ResumeTemplateId;
  contact: ResumeContact;
  content: TailoredResumeContent;
}) {
  const content = {
    ...rawContent,
    experience: rawContent.experience ?? [],
    education: rawContent.education ?? {
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
  const pageStyle = template === "A" ? styles.page : styles.pageSans;
  const eduPlace = formatPlace(
    content.education.location,
    content.education.state
  );

  return (
    <Document>
      <Page size="LETTER" style={pageStyle}>
        {template === "A" && (
          <>
            <Text style={styles.nameCenter}>{name}</Text>
            {hasText(line) ? <Text style={styles.contact}>{line}</Text> : null}
          </>
        )}
        {template === "B" && (
          <>
            <Text style={styles.nameLeft}>{name}</Text>
            {hasText(contact.professional_title) ? (
              <Text style={styles.muted}>{contact.professional_title}</Text>
            ) : null}
            {hasText(line) ? (
              <Text style={styles.contactLeft}>{line}</Text>
            ) : null}
          </>
        )}
        {template === "C" && (
          <>
            <Text style={styles.nameCaps}>{name}</Text>
            {hasText(line) ? <Text style={styles.contact}>{line}</Text> : null}
          </>
        )}

        {(template === "B" || template === "C") &&
        hasText(content.summary) ? (
          <>
            <Text style={styles.section}>Summary</Text>
            <Text style={styles.body}>{content.summary}</Text>
          </>
        ) : null}

        {template === "B" && (content.technicalSkills?.length ?? 0) > 0 ? (
          <>
            <Text style={styles.section}>Technical Skills</Text>
            <TwoCol items={content.technicalSkills!} />
          </>
        ) : null}

        {(template === "A" || template === "C") && (
          <>
            <Text style={styles.section}>Education</Text>
            <View style={styles.row}>
              <View>
                <Text style={styles.bold}>
                  {template === "C"
                    ? content.education.degreeLine
                    : content.education.school}
                </Text>
                {template === "C" ? (
                  <Text style={styles.muted}>
                    {joinNonEmpty(
                      [content.education.school, content.education.date],
                      " · "
                    )}
                  </Text>
                ) : (
                  <Text style={styles.muted}>
                    {content.education.degreeLine}
                  </Text>
                )}
                {template === "A"
                  ? (content.education.details ?? []).map((d, i) => (
                      <Text key={i} style={styles.muted}>
                        {d}
                      </Text>
                    ))
                  : null}
                {template === "C" && hasText(eduPlace) ? (
                  <Text style={styles.muted}>{eduPlace}</Text>
                ) : null}
              </View>
              {template === "A" ? (
                <View>
                  {hasText(eduPlace) ? (
                    <Text style={styles.muted}>{eduPlace}</Text>
                  ) : null}
                  {hasText(content.education.date) ? (
                    <Text style={styles.muted}>{content.education.date}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </>
        )}

        <Text style={styles.section}>
          {template === "B" ? "Professional Experience" : "Experience"}
        </Text>
        {content.experience.map((e, i) => {
          const place = formatPlace(e.location, e.state);
          const titleCompany =
            template === "B"
              ? joinNonEmpty([e.title, e.company], " — ")
              : template === "C"
                ? joinNonEmpty([e.title, e.company], ", ")
                : e.title;
          return (
            <View key={i} style={{ marginTop: 6 }}>
              <View style={styles.row}>
                {hasText(titleCompany) ? (
                  <Text style={styles.bold}>{titleCompany}</Text>
                ) : (
                  <Text />
                )}
                <Text style={styles.muted}>
                  {template === "A"
                    ? place
                    : hasText(e.endDate)
                      ? e.endDate
                      : ""}
                </Text>
              </View>
              {template === "A" ? (
                <>
                  {(hasText(e.company) || hasText(e.endDate)) && (
                    <View style={styles.row}>
                      {hasText(e.company) ? (
                        <Text style={styles.italic}>{e.company}</Text>
                      ) : (
                        <Text />
                      )}
                      {hasText(e.endDate) ? (
                        <Text style={styles.muted}>{e.endDate}</Text>
                      ) : null}
                    </View>
                  )}
                </>
              ) : hasText(place) ? (
                <Text style={styles.muted}>{place}</Text>
              ) : null}
              <Bullets items={e.bullets} />
            </View>
          );
        })}

        {template === "B" ? (
          <>
            <Text style={styles.section}>Education</Text>
            <View style={styles.row}>
              <View>
                <Text style={styles.bold}>{content.education.school}</Text>
                <Text style={styles.muted}>{content.education.degreeLine}</Text>
              </View>
              <View>
                {hasText(eduPlace) ? (
                  <Text style={styles.muted}>{eduPlace}</Text>
                ) : null}
                {hasText(content.education.date) ? (
                  <Text style={styles.muted}>{content.education.date}</Text>
                ) : null}
              </View>
            </View>
          </>
        ) : null}

        {(content.projects?.length ?? 0) > 0 ? (
          <>
            <Text style={styles.section}>Projects</Text>
            {content.projects!.map((p, i) => (
              <View key={i} style={{ marginTop: 4 }}>
                <View style={styles.row}>
                  {hasText(p.title) ? (
                    <Text style={styles.bold}>{p.title}</Text>
                  ) : (
                    <Text />
                  )}
                  {hasText(p.dateContext) ? (
                    <Text style={styles.muted}>{p.dateContext}</Text>
                  ) : null}
                </View>
                {hasText(p.description) ? (
                  <Text style={styles.body}>{p.description}</Text>
                ) : null}
              </View>
            ))}
          </>
        ) : null}

        {template === "C" && (content.professionalSkills?.length ?? 0) > 0 ? (
          <>
            <Text style={styles.section}>Professional Skills</Text>
            <TwoCol items={content.professionalSkills!} />
          </>
        ) : null}

        {template === "C" && (content.technicalSkills?.length ?? 0) > 0 ? (
          <>
            <Text style={styles.section}>Technical Skills</Text>
            <View style={styles.multi}>
              {content.technicalSkills!.map((s, i) => (
                <Text key={i} style={styles.chip}>
                  {s}
                </Text>
              ))}
            </View>
          </>
        ) : null}

        {(content.extracurriculars?.length ?? 0) > 0 ? (
          <StringListSection
            title="Extracurriculars"
            items={content.extracurriculars!}
          />
        ) : null}

        {(content.certifications?.length ?? 0) > 0 ? (
          <>
            <Text style={styles.section}>Certifications</Text>
            {template === "C" ? (
              <TwoCol items={content.certifications!} />
            ) : (
              content.certifications!.map((x, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletGlyph}>•</Text>
                  <Text style={styles.bulletText}>{x}</Text>
                </View>
              ))
            )}
          </>
        ) : null}

        {(content.achievements?.length ?? 0) > 0 ? (
          <StringListSection
            title="Achievements"
            items={content.achievements!}
          />
        ) : null}

        {(content.additional?.length ?? 0) > 0 ? (
          <StringListSection title="Additional" items={content.additional!} />
        ) : null}
      </Page>
    </Document>
  );
}
