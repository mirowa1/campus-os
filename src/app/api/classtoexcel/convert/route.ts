import { NextRequest, NextResponse } from "next/server";
import {
  PaywallError,
  assertCanUseClassToExcel,
  incrementClassToExcelUsage,
} from "@/lib/billing";
import {
  buildWorkbookFromFile,
  workbookToBuffer,
  xlsxResponse,
} from "@/lib/classtoexcel";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
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

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error:
            "ANTHROPIC_API_KEY is not set. Add it to .env.local to parse syllabi.",
        },
        { status: 503 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { workbook, downloadName } = await buildWorkbookFromFile(
      buffer,
      file.type || "",
      file.name
    );

    await incrementClassToExcelUsage(supabase, billing);

    const body = await workbookToBuffer(workbook);
    return xlsxResponse(body, downloadName);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Conversion failed";
    console.error("classtoexcel/convert:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
