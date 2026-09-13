import { NextResponse } from "next/server";
import {
  FREE_ASSISTANT_MESSAGE_LIMIT,
  getAssistantMessagesRemaining,
  getBillingProfile,
  hasActiveSubscription,
} from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Light meta for the widget (class names + free-tier remaining). */
export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "SESSION_EXPIRED",
          message: "Your session expired. Refresh the page or sign in again.",
        },
        { status: 401 }
      );
    }

    const billing = await getBillingProfile(supabase, user.id, user.email);
    const { data: classes } = await supabase
      .from("classes")
      .select("name")
      .eq("user_id", user.id)
      .order("name", { ascending: true })
      .limit(8);

    return NextResponse.json({
      classNames: (classes ?? []).map((c) => c.name as string),
      messagesRemaining: getAssistantMessagesRemaining(billing),
      freeLimit: FREE_ASSISTANT_MESSAGE_LIMIT,
      isPro: hasActiveSubscription(billing),
    });
  } catch (err) {
    console.error("[assistant/meta]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
