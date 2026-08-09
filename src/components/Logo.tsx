import Link from "next/link";

type SizeToken = "sm" | "md" | "lg";

type Props = {
  href?: string | null;
  size?: SizeToken | number;
  withByline?: boolean;
  /** When true, applies the marketing -10deg tilt. Default true. */
  rotated?: boolean;
  className?: string;
};

const WIDTH: Record<SizeToken, number> = {
  sm: 120,
  md: 200,
  lg: 280,
};

function resolveWidth(size: SizeToken | number): number {
  return typeof size === "number" ? size : WIDTH[size];
}

export function Logo({
  href = "/",
  size = "md",
  withByline = false,
  rotated = true,
  className = "",
}: Props) {
  const width = resolveWidth(size);
  const bylineSize = Math.max(10, Math.round(width * 0.05));
  // On very narrow screens, clamp marketing "lg" so the oval doesn't overflow.
  const responsiveWidthClass =
    typeof size === "string" && size === "lg"
      ? "max-[400px]:[&_.logo-oval]:!w-[min(280px,78vw)] max-[400px]:[&_.logo-oval]:!h-auto"
      : typeof size === "string" && size === "sm"
        ? "max-sm:[&_.logo-oval]:!w-[96px]"
        : "";

  const inner = (
    <span
      className={`inline-flex flex-col items-center ${responsiveWidthClass} ${className}`}
      style={{ gap: Math.max(6, Math.round(width * 0.032)) }}
    >
      <div
        className="logo-oval shrink-0"
        style={{
          width,
          aspectRatio: "240 / 96",
          height: "auto",
          transform: rotated ? "rotate(-10deg)" : undefined,
          transformOrigin: "center center",
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 240 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="block overflow-visible"
          preserveAspectRatio="xMidYMid meet"
        >
          <ellipse
            cx="120"
            cy="48"
            rx="110"
            ry="38"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="2.75"
          />
          <text
            x="120"
            y="49"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            style={{
              fontFamily: "var(--font-fredoka), system-ui, sans-serif",
              fontWeight: 600,
              fontSize: "34px",
              letterSpacing: "-0.015em",
            }}
            transform="translate(120, 48) scale(1.12, 1) translate(-120, -48)"
          >
            COURSEWORK
          </text>
        </svg>
      </div>
      {withByline && (
        <span
          className="font-normal tracking-[0.06em] text-white/65"
          style={{
            fontSize: bylineSize,
            fontFamily: "var(--font-body), system-ui, sans-serif",
          }}
        >
          by CoreMax
        </span>
      )}
    </span>
  );

  if (!href) {
    return (
      <span aria-label="Coursework by CoreMax" className="inline-block">
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label="Coursework by CoreMax"
      className="inline-block shrink-0"
    >
      {inner}
    </Link>
  );
}
