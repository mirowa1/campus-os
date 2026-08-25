import { Resend } from "resend";

const DEFAULT_FROM = "CoreMax <noreply@coremaxsystems.com>";

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  /** Optional plain-text fallback for clients that do not render HTML. */
  text?: string;
  /** Optional override; defaults to CoreMax noreply. */
  from?: string;
  replyTo?: string;
};

/**
 * Send an email via Resend. Never throws — callers get a success/error result.
 *
 * @example
 * ```ts
 * import { sendEmail } from "@/lib/email";
 *
 * const result = await sendEmail({
 *   to: "student@gsu.edu",
 *   subject: "You're confirmed",
 *   html: "<p>Thanks for signing up for Coursework by CoreMax.</p>",
 *   text: "Thanks for signing up for Coursework by CoreMax.",
 * });
 *
 * if (!result.success) {
 *   console.error("Email failed:", result.error);
 * }
 * ```
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY is not configured");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: params.from ?? DEFAULT_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.text !== undefined ? { text: params.text } : {}),
      ...(params.replyTo !== undefined ? { replyTo: params.replyTo } : {}),
    });

    if (error) {
      console.error("[email] Resend send failed:", error);
      return {
        success: false,
        error: error.message || "Failed to send email",
      };
    }

    if (!data?.id) {
      console.error("[email] Resend returned no email id:", data);
      return { success: false, error: "Resend returned no email id" };
    }

    return { success: true, id: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] Unexpected send error:", err);
    return { success: false, error: message };
  }
}
