export function sanitizeStackgridHtml(html: string): string {
  return html
    .replace(/\sas="[^"]*"/g, "")
    .replace(/\sparentsize="[^"]*"/g, "")
    .replace(/\s_constraints="[^"]*"/g, "")
    .replace(/\srotation="[^"]*"/g, "")
    .replace(/\sshadows=""/g, "")
    .replace(/<figure\s+as="figure"/g, "<figure")
    .replace(/<cal-inline[^>]*>[\s\S]*?<\/cal-inline>/g, "")
    .replace(/<slot><\/slot>/g, "");
}
