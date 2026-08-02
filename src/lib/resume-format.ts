/** Join non-empty trimmed parts with a separator (no stray "—" / "," / "·"). */
export function joinNonEmpty(
  parts: Array<string | null | undefined>,
  sep: string
): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(sep);
}

export function formatPlace(
  location: string | null | undefined,
  state?: string | null
): string {
  return joinNonEmpty([location, state], ", ");
}

export function hasText(v: string | null | undefined): boolean {
  return Boolean(v?.trim());
}

/** Display LinkedIn without forcing browser https selection chrome. */
export function displayLinkedIn(url: string | null | undefined): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
  return raw.replace(/^https?:\/\//i, "");
}

type ExpLike = { company?: string | null };
type TailoredLike = {
  experience: Array<{ company: string; [key: string]: unknown }>;
};

/** If Claude left company blank, copy from intake at the same index. */
export function backfillExperienceCompanies<T extends TailoredLike>(
  tailored: T,
  intakeExperience: ExpLike[] | null | undefined
): T {
  const intake = Array.isArray(intakeExperience) ? intakeExperience : [];
  return {
    ...tailored,
    experience: (tailored.experience ?? []).map((e, i) => {
      if (hasText(e.company)) return e;
      const fromIntake = intake[i]?.company;
      if (typeof fromIntake === "string" && fromIntake.trim()) {
        return { ...e, company: fromIntake.trim() };
      }
      return e;
    }),
  };
}
