/**
 * Sends one email through Resend's HTTP API. Needs RESEND_API_KEY and EMAIL_FROM
 * (an address on a domain verified in Resend). Without them nothing is sent and
 * the caller is told so. It never throws: an email is never worth failing an order.
 */
export type Email = { to: string; subject: string; text: string; html: string; replyTo?: string };

export type SendResult = { sent: true; id: string } | { sent: false; reason: string };

export function mailConfig(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const from = env.EMAIL_FROM?.trim() ?? "";
  return apiKey && from ? { apiKey, from } : null;
}

export async function sendEmail(
  email: Email,
  options: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {},
): Promise<SendResult> {
  const config = mailConfig(options.env);
  if (!config) return { sent: false, reason: "not_configured" };
  try {
    const response = await (options.fetchImpl ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: config.from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: unknown; message?: unknown };
    if (!response.ok) return { sent: false, reason: String(body.message ?? `http_${response.status}`) };
    return { sent: true, id: String(body.id ?? "") };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "send_failed" };
  }
}
