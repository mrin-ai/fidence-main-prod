import { Resend } from "resend";

let client: Resend | null = null;

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!client) {
    client = new Resend(apiKey);
  }

  return client;
}

export function getResendFromAddress() {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error(
      "RESEND_FROM_EMAIL is not configured (e.g. PayAgent <invoices@yourdomain.com>)",
    );
  }
  return from;
}

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}) {
  const resend = getResendClient();
  const from = getResendFromAddress();

  const result = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });

  if (result.error) {
    throw new Error(result.error.message || "Failed to send email");
  }

  return result.data;
}
