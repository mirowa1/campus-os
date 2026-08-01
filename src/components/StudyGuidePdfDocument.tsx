import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 44,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#171717",
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  meta: {
    fontSize: 9,
    color: "#525252",
    marginBottom: 16,
  },
  h2: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 4,
  },
  para: {
    fontSize: 10,
    lineHeight: 1.45,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 3,
  },
  bulletGlyph: { width: 12, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.4 },
});

function parseMarkdownBlocks(content: string): { type: "h2" | "p" | "li"; text: string }[] {
  const blocks: { type: "h2" | "p" | "li"; text: string }[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
    } else if (/^[-*]\s+/.test(line.trim())) {
      blocks.push({ type: "li", text: line.trim().replace(/^[-*]\s+/, "") });
    } else if (line.startsWith("# ")) {
      blocks.push({ type: "h2", text: line.slice(2).trim() });
    } else {
      blocks.push({ type: "p", text: line.trim() });
    }
  }
  return blocks;
}

export function StudyGuidePdfDocument({
  classLabel,
  generatedAt,
  content,
}: {
  classLabel: string;
  generatedAt: string;
  content: string;
}) {
  const blocks = parseMarkdownBlocks(content);
  const dateLabel = generatedAt.slice(0, 19).replace("T", " ");

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Study Guide</Text>
        <Text style={styles.meta}>
          {classLabel}
          {"\n"}
          Generated {dateLabel}
        </Text>
        {blocks.map((b, i) => {
          if (b.type === "h2") {
            return (
              <Text key={i} style={styles.h2}>
                {b.text}
              </Text>
            );
          }
          if (b.type === "li") {
            return (
              <View key={i} style={styles.bulletRow} wrap>
                <Text style={styles.bulletGlyph}>•</Text>
                <Text style={styles.bulletText}>{b.text}</Text>
              </View>
            );
          }
          return (
            <Text key={i} style={styles.para}>
              {b.text}
            </Text>
          );
        })}
      </Page>
    </Document>
  );
}
