/** Curated majors + certification suggestions for the resume builder. */

export const CERT_OTHER = "Other — type your own";
export const MAJOR_OTHER = "Other — type your own";

export const CERTS_MARKETING = [
  "Google Analytics Certification",
  "HubSpot Inbound Marketing",
  "Meta Blueprint",
  "Google Ads Certification",
  "HubSpot Content Marketing",
  "SEMrush SEO Toolkit",
] as const;

export const CERTS_CIS = [
  "CompTIA A+/Security+",
  "AWS Cloud Practitioner",
  "Microsoft Azure Fundamentals",
  "Google IT Support",
  "Certified ScrumMaster (CSM)",
] as const;

export const CERTS_BUSINESS = [
  "PMP (Project Management Professional)",
  "Lean Six Sigma (White/Yellow/Green Belt)",
  "Certified Business Analysis Professional (CBAP)",
] as const;

export const CERTS_FINANCE = [
  "Bloomberg Market Concepts",
  "CFA Level I (in progress)",
  "QuickBooks Certification",
] as const;

type CertCategory = "marketing" | "cis" | "business" | "finance";

const CERTS_BY_CATEGORY: Record<CertCategory, readonly string[]> = {
  marketing: CERTS_MARKETING,
  cis: CERTS_CIS,
  business: CERTS_BUSINESS,
  finance: CERTS_FINANCE,
};

/** Exact dropdown major → cert category (only majors that drive certs). */
const MAJOR_TO_CATEGORY: Record<string, CertCategory> = {
  Marketing: "marketing",
  "Computer Information Systems": "cis",
  "Computer Science": "cis",
  "Information Technology": "cis",
  "Data Analytics": "cis",
  "Business Administration": "business",
  Management: "business",
  Finance: "finance",
  Accounting: "finance",
};

/**
 * Common majors for the Education dropdown.
 * Values that map to certs must match MAJOR_TO_CATEGORY keys exactly.
 */
export const RESUME_MAJORS: string[] = [
  "Accounting",
  "Biology",
  "Business Administration",
  "Communications",
  "Computer Information Systems",
  "Computer Science",
  "Data Analytics",
  "Economics",
  "Education",
  "Electrical Engineering",
  "Finance",
  "Information Technology",
  "Management",
  "Marketing",
  "Mechanical Engineering",
  "Nursing",
  "Political Science",
  "Psychology",
];

/** Keyword fallback for custom "Other" free-text majors only. */
const KEYWORD_FALLBACK: { keywords: string[]; category: CertCategory }[] = [
  {
    keywords: ["marketing", "advertising", "digital media", "public relations"],
    category: "marketing",
  },
  {
    keywords: [
      "cis",
      "computer information",
      "information systems",
      "information technology",
      "computer science",
      "software",
      "cyber",
      "data analytic",
      "data science",
    ],
    category: "cis",
  },
  {
    keywords: ["business", "management", "mba", "operations", "entrepreneur"],
    category: "business",
  },
  {
    keywords: ["finance", "accounting", "financial"],
    category: "finance",
  },
];

export function isListedMajor(major: string): boolean {
  return RESUME_MAJORS.includes(major);
}

/** Returns curated cert labels for a major (no Other). Empty if no match. */
export function certsForMajor(major: string): string[] {
  const trimmed = major.trim();
  if (!trimmed) return [];

  const exact = MAJOR_TO_CATEGORY[trimmed];
  if (exact) return [...CERTS_BY_CATEGORY[exact]];

  // Custom Other text — keyword fallback
  const m = trimmed.toLowerCase();
  for (const row of KEYWORD_FALLBACK) {
    if (row.keywords.some((k) => m.includes(k))) {
      return [...CERTS_BY_CATEGORY[row.category]];
    }
  }
  return [];
}
