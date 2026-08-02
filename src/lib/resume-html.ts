import sanitizeHtml from "sanitize-html";

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
  "charset",
];

/**
 * Harden CSS for resume <style> blocks / inline style attributes.
 * Keeps @page and local typography; strips remote/exfil vectors.
 */
export function sanitizeResumeCss(css: string): string {
  let out = css;

  // @import (any form) — remote stylesheet load
  out = out.replace(/@import\b[^;]*;?/gi, "");

  // url(...) — resume CSS must not fetch remote/data resources
  out = out.replace(
    /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (_full, _q: string, raw: string) => {
      const value = raw.trim();
      if (
        /^(https?:|data:|javascript:|vbscript:|file:)/i.test(value) ||
        value.startsWith("//")
      ) {
        return "none";
      }
      // Drop remaining url() — resume styles shouldn't need local assets either
      return "none";
    }
  );

  // Legacy IE / expression XSS vectors
  out = out.replace(/expression\s*\([^)]*\)/gi, "none");
  out = out.replace(/-moz-binding\s*:[^;}]*/gi, "");
  out = out.replace(/behavior\s*:[^;}]*/gi, "");

  // @namespace can pull external resources in some engines
  out = out.replace(/@namespace\b[^;]*;?/gi, "");

  return out;
}

function hardenStyleBlocks(html: string): string {
  return html.replace(
    /<style(\b[^>]*)>([\s\S]*?)<\/style>/gi,
    (_full, attrs: string, css: string) =>
      `<style${attrs}>${sanitizeResumeCss(css)}</style>`
  );
}

/** Sanitize Claude (or user-edited) resume HTML for safe iframe/PDF/DOCX use. */
export function sanitizeResumeHtml(raw: string): string {
  const cleaned = sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": ALLOWED_ATTR.filter(
        (a) => a !== "href" && a !== "target" && a !== "rel"
      ),
      a: ["href", "target", "rel", "class", "id", "style"],
      meta: ["charset"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
    },
    allowVulnerableTags: true, // keep <style>; we harden CSS ourselves
    disallowedTagsMode: "discard",
    transformTags: {
      "*": (tagName, attribs) => {
        if (attribs.style) {
          attribs.style = sanitizeResumeCss(attribs.style);
        }
        for (const key of Object.keys(attribs)) {
          if (/^on/i.test(key)) delete attribs[key];
        }
        return { tagName, attribs };
      },
    },
  });
  return hardenStyleBlocks(cleaned).trim();
}

/** Basic structural checks after sanitize. */
export function assertValidResumeHtml(html: string): string {
  const sanitized = sanitizeResumeHtml(html);
  if (sanitized.length < 80) {
    throw new Error("Resume HTML too short");
  }
  const textOnly = sanitized
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (textOnly.length < 40) {
    throw new Error("Resume HTML has insufficient text content");
  }
  if (/<script/i.test(sanitized)) {
    throw new Error("Resume HTML must not contain scripts");
  }
  if (/@import\b/i.test(sanitized)) {
    throw new Error("Resume HTML must not contain CSS @import");
  }
  if (/url\s*\(\s*['"]?\s*(https?:|\/\/|data:)/i.test(sanitized)) {
    throw new Error("Resume HTML must not contain external CSS urls");
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
