import { NextRequest, NextResponse } from "next/server";
import { buildAssistantContext } from "@/lib/assistant-context";
import {
  PaywallError,
  assertCanUseAssistant,
  getAssistantMessagesRemaining,
  hasActiveSubscription,
  incrementAssistantMessagesUsed,
} from "@/lib/billing";
import {
  chatWithCourseworkAssistant,
  type AssistantChatTurn,
} from "@/lib/claude";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE_LEN = 2000;
const MAX_HISTORY = 12;

function normalizeHistory(raw: unknown): AssistantChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: AssistantChatTurn[] = [];
  for (const item of raw.slice(-MAX_HISTORY)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (
      (role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.trim()
    ) {
      out.push({ role, content: content.slice(0, MAX_MESSAGE_LEN) });
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
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

    let billing;
    try {
      billing = await assertCanUseAssistant(supabase, user.id, user.email);
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
            "ANTHROPIC_API_KEY is not set. Add it to .env.local to use the assistant.",
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as {
      message?: unknown;
      history?: unknown;
    };

    const message =
      typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return NextResponse.json(
        { error: `Message must be ${MAX_MESSAGE_LEN} characters or fewer` },
        { status: 400 }
      );
    }

    const history = normalizeHistory(body.history);
    const messages: AssistantChatTurn[] = [
      ...history,
      { role: "user", content: message },
    ];

    const context = await buildAssistantContext(supabase, user.id);
    const reply = await chatWithCourseworkAssistant({
      contextJson: JSON.stringify(context),
      todayYmd: context.today,
      messages,
    });

    if (!hasActiveSubscription(billing)) {
      await incrementAssistantMessagesUsed(supabase, billing);
      billing = {
        ...billing,
        assistant_messages_used: (billing.assistant_messages_used ?? 0) + 1,
      };
    }

    return NextResponse.json({
      reply,
      messagesRemaining: getAssistantMessagesRemaining(billing),
    });
  } catch (err) {
    console.error("[assistant/chat]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Assistant request failed",
      },
      { status: 500 }
    );
  }
}
