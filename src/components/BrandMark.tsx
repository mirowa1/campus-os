import Link from "next/link";

type Props = {
  href?: string;
  size?: "sm" | "md";
  className?: string;
};

const sizeClass = {
  sm: {
    brand: "text-lg leading-none sm:text-xl",
    product: "text-[0.65rem] leading-tight tracking-wide",
  },
  md: {
    brand: "text-xl leading-none sm:text-2xl",
    product: "text-xs leading-tight tracking-wide sm:text-sm",
  },
} as const;

/** CoreMax primary mark + Coursework subtitle (Docs-by-Notion style stack). */
export function BrandMark({ href = "/", size = "sm", className = "" }: Props) {
  const s = sizeClass[size];
  const inner = (
    <span className={`inline-flex flex-col ${className}`}>
      <span className={`font-display tracking-tight text-[var(--ink)] ${s.brand}`}>
        CoreMax
      </span>
      <span
        className={`mt-0.5 font-medium uppercase text-[var(--muted)] ${s.product}`}
      >
        Coursework
      </span>
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
