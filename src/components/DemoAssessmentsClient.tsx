"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AssessmentsPanel,
  type AssessmentsPanelItem,
} from "@/components/AssessmentsPanel";
import { DemoAssistantWidget } from "@/components/DemoAssistantWidget";
import { buildDemoAssistantScript } from "@/lib/demo-assessments-data";
import type { ClassRow } from "@/lib/types";

const CTA_DELAY_MS = 3500;
const ASSISTANT_STAGGER_MS = 1500;

function buildSignupHref(searchParams: URLSearchParams): string {
  const params = new URLSearchParams();
  params.set("intent", "upgrade");
  params.set("next", "/checkout");
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
  ] as const) {
    const v = searchParams.get(key);
    if (v) params.set(key, v);
  }
  return `/signup?${params.toString()}`;
}

type Props = {
  items: AssessmentsPanelItem[];
  classes: Pick<ClassRow, "id" | "name" | "code">[];
};

export function DemoAssessmentsClient({ items, classes }: Props) {
  const searchParams = useSearchParams();
  const [ctaVisible, setCtaVisible] = useState(false);
  const [assistantVisible, setAssistantVisible] = useState(false);
  const assistantScheduled = useRef(false);

  const signupHref = useMemo(
    () => buildSignupHref(searchParams),
    [searchParams]
  );

  const script = useMemo(() => buildDemoAssistantScript(items), [items]);

  const scheduleAssistant = useCallback(() => {
    if (assistantScheduled.current) return;
    assistantScheduled.current = true;
    window.setTimeout(() => setAssistantVisible(true), ASSISTANT_STAGGER_MS);
  }, []);

  const showCta = useCallback(() => {
    setCtaVisible((was) => {
      if (!was) scheduleAssistant();
      return true;
    });
  }, [scheduleAssistant]);

  useEffect(() => {
    const t = window.setTimeout(showCta, CTA_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [showCta]);

  return (
    <>
      <AssessmentsPanel
        items={items}
        classes={classes}
        readOnly
        onFilterInteraction={showCta}
      />

      {ctaVisible && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 pb-24 sm:pb-5 sm:pr-24">
          <Link
            href={signupHref}
            className="pointer-events-auto btn btn-primary inline-flex max-w-lg items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base shadow-lg shadow-black/40"
          >
            See your semester like this →
          </Link>
        </div>
      )}

      {assistantVisible && (
        <DemoAssistantWidget
          signupHref={signupHref}
          userMessage={script.userMessage}
          assistantMessage={script.assistantMessage}
        />
      )}
    </>
  );
}
