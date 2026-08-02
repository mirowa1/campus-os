import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "html",
  "head",
  "body",
  "meta",
  "title",
  "style",
  "div",
  "span",
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "section",
  "header",
  "main",
  "article",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a",
];

const ALLOWED_ATTR = [
  "class",
  "id",
  "style",
  "href",
  "target",
  "rel",
  "colspan",
  "rowspan",
  "lang",
];

/** Sanitize Claude (or user-edited) resume HTML for safe iframe/PDF/DOCX use. */
export function sanitizeResumeHtml(raw: string): string {
  const cleaned = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "form", "input"],
    FORBID_ATTR: [
      "onerror",
      "onclick",
      "onload",
      "onmouseover",
      "onfocus",
      "onblur",
    ],
  });
  return cleaned.trim();
}

/** Basic structural checks after sanitize. */
export function assertValidResumeHtml(html: string): string {
  const sanitized = sanitizeResumeHtml(html);
  if (sanitized.length < 80) {
    throw new Error("Resume HTML too short");
  }
  const textOnly = sanitized.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (textOnly.length < 40) {
    throw new Error("Resume HTML has insufficient text content");
  }
  if (/<script/i.test(sanitized)) {
    throw new Error("Resume HTML must not contain scripts");
  }
  return sanitized;
}

/** Ensure we have a full document wrapper for iframe/PDF. */
export function wrapResumeDocument(html: string): string {
  const body = sanitizeResumeHtml(html);
  if (/<html[\s>]/i.test(body)) {
    return body;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Resume</title>
</head>
<body>
${body}
</body>
</html>`;
}
