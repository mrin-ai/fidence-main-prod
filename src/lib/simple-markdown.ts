function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(text: string) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-primary underline-offset-4 hover:underline">$1</a>',
  );
  return html;
}

export function renderSimpleMarkdown(source: string) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    if (/^```/.test(line.trim())) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        `<pre class="overflow-x-auto rounded-xl border border-border/60 bg-muted/40 p-4 font-mono text-xs leading-relaxed"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
      );
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const content = inlineMarkdown(line.replace(/^#{1,6}\s+/, ""));
      const tag = `h${Math.min(level, 6)}`;
      const className =
        level === 1
          ? "text-2xl font-semibold tracking-tight"
          : level === 2
            ? "mt-8 text-xl font-semibold tracking-tight"
            : "mt-6 text-lg font-semibold";
      blocks.push(`<${tag} class="${className}">${content}</${tag}>`);
      index += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push('<hr class="my-8 border-border/60" />');
      index += 1;
      continue;
    }

    if (/^\|.+\|$/.test(line.trim())) {
      const tableLines: string[] = [];
      while (index < lines.length && /^\|.+\|$/.test(lines[index].trim())) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      const rows = tableLines
        .filter((row) => !/^\|[\s\-:|]+\|$/.test(row))
        .map((row) =>
          row
            .slice(1, -1)
            .split("|")
            .map((cell) => cell.trim()),
        );
      if (rows.length > 0) {
        const [head, ...body] = rows;
        blocks.push(
          `<div class="overflow-x-auto"><table class="w-full border-collapse text-sm"><thead><tr>${head.map((cell) => `<th class="border border-border/60 bg-muted/40 px-3 py-2 text-left font-medium">${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td class="border border-border/60 px-3 py-2 align-top text-muted-foreground">${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
        );
      }
      continue;
    }

    if (/^[-*]\s/.test(line.trim())) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s/.test(lines[index].trim())) {
        items.push(inlineMarkdown(lines[index].trim().replace(/^[-*]\s+/, "")));
        index += 1;
      }
      blocks.push(
        `<ul class="list-disc space-y-2 pl-5 text-muted-foreground">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !/^#{1,6}\s/.test(lines[index]) &&
      !/^```/.test(lines[index].trim()) &&
      !/^---+$/.test(lines[index].trim()) &&
      !/^\|.+\|$/.test(lines[index].trim()) &&
      !/^[-*]\s/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push(
      `<p class="leading-7 text-muted-foreground">${inlineMarkdown(paragraphLines.join(" "))}</p>`,
    );
  }

  return blocks.join("\n");
}
