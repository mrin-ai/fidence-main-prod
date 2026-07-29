import { sendEmail } from "@/lib/email/resend";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function emailShell(body: string) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:Inter,Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
            <tr>
              <td style="font-size:13px;font-weight:600;letter-spacing:0.04em;color:#0066ff;padding-bottom:16px;">
                PAYAGENT
              </td>
            </tr>
            <tr>
              <td>${body}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendInvoiceShareEmail(input: {
  to: string;
  replyTo?: string;
  companyName: string;
  clientName: string;
  reference: string;
  amountLabel: string;
  paymentUrl: string;
  message?: string;
}) {
  const subject = `Invoice ${input.reference} from ${input.companyName}`;
  const safeMessage = input.message?.trim()
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#374151;">${escapeHtml(input.message.trim())}</p>`
    : "";

  const html = emailShell(`
    <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;">Invoice ${escapeHtml(input.reference)}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#4b5563;">
      ${escapeHtml(input.companyName)} sent you an invoice
      ${input.clientName ? ` for <strong>${escapeHtml(input.clientName)}</strong>` : ""}.
    </p>
    ${safeMessage}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;border-radius:10px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px;">
          <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Amount due</div>
          <div style="font-size:24px;font-weight:700;color:#111827;">${escapeHtml(input.amountLabel)}</div>
        </td>
      </tr>
    </table>
    <a href="${escapeHtml(input.paymentUrl)}"
       style="display:inline-block;background:#0066ff;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 18px;border-radius:8px;">
      Pay invoice
    </a>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;">
      Or open this link:<br />
      <a href="${escapeHtml(input.paymentUrl)}" style="color:#0066ff;word-break:break-all;">${escapeHtml(input.paymentUrl)}</a>
    </p>
  `);

  const text = [
    `Invoice ${input.reference} from ${input.companyName}`,
    input.message?.trim() ? `\n${input.message.trim()}\n` : "",
    `Amount due: ${input.amountLabel}`,
    `Pay here: ${input.paymentUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
    replyTo: input.replyTo,
  });
}

export async function sendInvoicePaidEmail(input: {
  to: string;
  reference: string;
  clientName: string;
  amountLabel: string;
  paymentUrl?: string;
}) {
  const subject = `Payment received for invoice ${input.reference}`;
  const html = emailShell(`
    <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;">Payment received</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#4b5563;">
      ${escapeHtml(input.clientName || "Your client")} paid invoice
      <strong>${escapeHtml(input.reference)}</strong>.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ecfdf5;border-radius:10px;margin-bottom:8px;">
      <tr>
        <td style="padding:16px;">
          <div style="font-size:12px;color:#047857;margin-bottom:4px;">Amount paid</div>
          <div style="font-size:24px;font-weight:700;color:#065f46;">${escapeHtml(input.amountLabel)}</div>
        </td>
      </tr>
    </table>
  `);

  const text = [
    `Payment received for invoice ${input.reference}`,
    `Client: ${input.clientName || "Client"}`,
    `Amount paid: ${input.amountLabel}`,
    input.paymentUrl ? `Payment link: ${input.paymentUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
  });
}
