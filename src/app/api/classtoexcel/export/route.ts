import { NextResponse } from "next/server";
import {
  PaywallError,
  assertCanUseClassToExcel,
  incrementClassToExcelUsage,
} from "@/lib/billing";
import {
  buildWorkbookFromClasses,
  workbookToBuffer,
  xlsxResponse,
} from "@/lib/classtoexcel";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let billing;
    try {
      billing = await assertCanUseClassToExcel(supabase, user.id, user.email);
    } catch (err) {
      if (err instanceof PaywallError) {
        return NextResponse.json(
          { error: "PAYWALL_REQUIRED", feature: err.feature },
          { status: 402 }
        );
      }
      throw err;
    }

    const body = (await request.json()) as { classIds?: unknown };
    const classIds = Array.isArray(body.classIds)
      ? body.classIds.filter(
          (id): id is string => typeof id === "string" && id.length > 0
        )
      : [];

    if (classIds.length === 0) {
      return NextResponse.json({ error: "classIds required" }, { status: 400 });
    }

    const { workbook, downloadName } = await buildWorkbookFromClasses(
      supabase,
      user.id,
      classIds
    );

    await incrementClassToExcelUsage(supabase, billing);

    const fileBody = await workbookToBuffer(workbook);
    return xlsxResponse(fileBody, downloadName);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    console.error("classtoexcel/export:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
