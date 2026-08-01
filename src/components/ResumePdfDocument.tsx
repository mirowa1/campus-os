import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ResumeContact } from "@/components/ResumePreviewPaper";
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
      date: null,
      details: [],
    },
  };
  const name = contact.full_name?.trim() || "Your Name";
  const line = contactLine(contact);
  const pageStyle = template === "A" ? styles.page : styles.pageSans;

  return (
    <Document>
      <Page size="LETTER" style={pageStyle}>
        {template === "A" && (
          <>
            <Text style={styles.nameCenter}>{name}</Text>
            <Text style={styles.contact}>{line}</Text>
          </>
        )}
        {template === "B" && (
          <>
            <Text style={styles.nameLeft}>{name}</Text>
            {contact.professional_title ? (
              <Text style={styles.muted}>{contact.professional_title}</Text>
            ) : null}
            <Text style={styles.contactLeft}>{line}</Text>
          </>
        )}
        {template === "C" && (
          <>
            <Text style={styles.nameCaps}>{name}</Text>
            <Text style={styles.contact}>{line}</Text>
          </>
        )}

        {(template === "B" || template === "C") && content.summary ? (
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

        {template === "A" || template === "C" ? (
          <>
            <Text style={styles.section}>Education</Text>
            <View style={styles.row}>
              <View>
                <Text style={styles.bold}>
                  {template === "C"
                    ? content.education.degreeLine
                    : content.education.school}
                </Text>
                <Text style={styles.muted}>
                  {template === "C"
                    ? `${content.education.school}${content.education.date ? ` · ${content.education.date}` : ""}`
                    : content.education.degreeLine}
                </Text>
              </View>
              {template === "A" ? (
                <View>
                  <Text style={styles.muted}>{content.education.location}</Text>
                  <Text style={styles.muted}>{content.education.date}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        <Text style={styles.section}>
          {template === "B" ? "Professional Experience" : "Experience"}
        </Text>
        {content.experience.map((e, i) => (
          <View key={i} style={{ marginTop: 6 }}>
            <View style={styles.row}>
              <Text style={styles.bold}>
                {template === "B"
                  ? `${e.title} — ${e.company}`
                  : template === "C"
                    ? `${e.title}, ${e.company}`
                    : e.title}
              </Text>
              <Text style={styles.muted}>
                {template === "A"
                  ? formatPlace(e.location, e.state)
                  : e.endDate}
              </Text>
            </View>
            {template === "A" ? (
              <View style={styles.row}>
                <Text style={styles.italic}>{e.company}</Text>
                <Text style={styles.muted}>{e.endDate}</Text>
              </View>
            ) : (
              <Text style={styles.muted}>
                {formatPlace(e.location, e.state)}
              </Text>
            )}
            <Bullets items={e.bullets} />
          </View>
        ))}

        {template === "B" ? (
          <>
            <Text style={styles.section}>Education</Text>
            <View style={styles.row}>
              <View>
                <Text style={styles.bold}>{content.education.school}</Text>
                <Text style={styles.muted}>{content.education.degreeLine}</Text>
              </View>
              <Text style={styles.muted}>{content.education.date}</Text>
            </View>
          </>
        ) : null}

        {template === "A" && (content.projects?.length ?? 0) > 0 ? (
          <>
            <Text style={styles.section}>Projects</Text>
            {content.projects!.map((p, i) => (
              <View key={i} style={{ marginTop: 4 }}>
                <View style={styles.row}>
                  <Text style={styles.bold}>{p.title}</Text>
                  <Text style={styles.muted}>{p.dateContext}</Text>
                </View>
                <Text style={styles.body}>{p.description}</Text>
              </View>
            ))}
          </>
        ) : null}

        {template === "A" && (content.extracurriculars?.length ?? 0) > 0 ? (
          <>
            <Text style={styles.section}>Extracurriculars</Text>
            {content.extracurriculars!.map((x, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletGlyph}>•</Text>
                <Text style={styles.bulletText}>{x}</Text>
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

        {template === "B" &&
        [
          ...(content.additional ?? []),
          ...(content.certifications ?? []),
          ...(content.achievements ?? []),
          ...(content.extracurriculars ?? []),
        ].length > 0 ? (
          <>
            <Text style={styles.section}>Additional Info</Text>
            {[
              ...(content.additional ?? []),
              ...(content.certifications ?? []).map((c) => `Cert: ${c}`),
              ...(content.achievements ?? []),
              ...(content.extracurriculars ?? []),
            ].map((x, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletGlyph}>•</Text>
                <Text style={styles.bulletText}>{x}</Text>
              </View>
            ))}
          </>
        ) : null}

        {(template === "A" || template === "C") &&
        (content.certifications?.length ?? 0) > 0 ? (
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

        {template === "A" && (content.achievements?.length ?? 0) > 0 ? (
          <>
            <Text style={styles.section}>Achievements</Text>
            {content.achievements!.map((x, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletGlyph}>•</Text>
                <Text style={styles.bulletText}>{x}</Text>
              </View>
            ))}
          </>
        ) : null}
      </Page>
    </Document>
  );
}
