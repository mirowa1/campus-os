/**
 * Zero-dependency resume HTML sanitizer.
 *
 * Avoids jsdom / htmlparser2 / isomorphic-dompurify — those pull ESM-only
 * packages that break under Vercel's Lambda Node (ERR_REQUIRE_ESM).
 *
 * Scope: Claude-generated + contentEditable resume HTML (allowlisted tags).
 */

const ALLOWED_TAGS = new Set([
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
]);

const VOID_TAGS = new Set(["br", "hr", "meta"]);

const ALLOWED_ATTR = new Set([
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
]);

const FORBIDDEN_BLOCKS = [
  "script",
  "iframe",
  "object",
  "embed",
  "link",
  "form",
  "input",
  "textarea",
  "button",
  "svg",
  "math",
  "base",
  "noscript",
  "template",
];

/**
 * Harden CSS for resume <style> blocks / inline style attributes.
 * Keeps @page and local typography; strips remote/exfil vectors.
 */
export function sanitizeResumeCss(css: string): string {
  let out = css;

  out = out.replace(/@import\b[^;]*;?/gi, "");

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
      return "none";
    }
  );

  out = out.replace(/expression\s*\([^)]*\)/gi, "none");
  out = out.replace(/-moz-binding\s*:[^;}]*/gi, "");
  out = out.replace(/behavior\s*:[^;}]*/gi, "");
  out = out.replace(/@namespace\b[^;]*;?/gi, "");

  return out;
}

function stripForbiddenBlocks(html: string): string {
  let out = html;
  for (const tag of FORBIDDEN_BLOCKS) {
    out = out.replace(
      new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"),
      ""
    );
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }
  return out;
}

function isSafeHref(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^(https?:|mailto:)/i.test(v)) return true;
  if (/^(javascript:|data:|vbscript:)/i.test(v)) return false;
  // relative / fragment / protocol-relative blocked
  if (v.startsWith("//")) return false;
  return false;
}

function sanitizeOpenTag(rawTag: string): string {
  const match = rawTag.match(/^<\/?([a-zA-Z0-9:-]+)([^>]*)\/?>$/);
  if (!match) return "";
  const isClose = rawTag.startsWith("</");
  const name = match[1].toLowerCase();
  if (!ALLOWED_TAGS.has(name)) return "";
  if (isClose) return `</${name}>`;

  const attrChunk = match[2] || "";
  const attrs: string[] = [];
  const attrRe =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(attrChunk))) {
    const key = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (/^on/i.test(key)) continue;
    if (!ALLOWED_ATTR.has(key)) continue;
    if (key === "href") {
      if (!isSafeHref(value)) continue;
      attrs.push(`href="${value.replace(/"/g, "&quot;")}"`);
      continue;
    }
    if (key === "style") {
      attrs.push(`style="${sanitizeResumeCss(value).replace(/"/g, "&quot;")}"`);
      continue;
    }
    if (key === "target") {
      if (value === "_blank" || value === "_self") {
        attrs.push(`target="${value}"`);
      }
      continue;
    }
    if (key === "rel") {
      // force noopener when target=_blank later; allow limited rel tokens
      const cleaned = value
        .split(/\s+/)
        .filter((t) => /^(noopener|noreferrer|nofollow)$/i.test(t))
        .join(" ");
      if (cleaned) attrs.push(`rel="${cleaned}"`);
      continue;
    }
    attrs.push(`${key}="${value.replace(/"/g, "&quot;")}"`);
  }

  if (name === "a" && attrs.some((a) => a.startsWith("target=\"_blank\""))) {
    if (!attrs.some((a) => a.startsWith("rel="))) {
      attrs.push('rel="noopener noreferrer"');
    }
  }

  const selfClose = VOID_TAGS.has(name);
  return `<${name}${attrs.length ? " " + attrs.join(" ") : ""}${
    selfClose ? " />" : ">"
  }`;
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
  let html = stripForbiddenBlocks(raw);

  // Drop HTML comments (can hide payloads)
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Rebuild from tags + text; drop disallowed tags (keep inner text for most)
  html = html.replace(/<\/?[a-zA-Z][^>]*>/g, (tag) => {
    const nameMatch = tag.match(/^<\/?([a-zA-Z0-9:-]+)/);
    const name = nameMatch?.[1]?.toLowerCase() ?? "";
    if (!ALLOWED_TAGS.has(name)) {
      // strip tag, keep children/text that follow
      return "";
    }
    return sanitizeOpenTag(tag);
  });

  html = hardenStyleBlocks(html);
  return html.trim();
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
