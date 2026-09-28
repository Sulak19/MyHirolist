const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT = 50;
const TOP = 790;
const BOTTOM = 52;

function safeText(value) {
  return String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function pdfText(value) {
  return safeText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function dateLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return safeText(value) || "Date not recorded";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
}

function dateKey(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function line(text, size = 11, options = {}) {
  return { text: safeText(text), size, font: options.bold ? "F2" : "F1", indent: options.indent || 0, gapAfter: options.gapAfter || 0 };
}

function lineHeight(item) {
  return item.size + 4 + item.gapAfter;
}

function reportBlocks(dogs, history, now) {
  const blocks = [
    [line("Dog treatment history", 20, { bold: true, gapAfter: 4 })],
    [line(`Generated ${dateLabel(dateKey(now))}`, 10, { gapAfter: 12 })],
  ];

  for (const dog of Array.isArray(dogs) ? dogs : []) {
    const entries = (Array.isArray(history) ? history : [])
      .filter((entry) => entry?.dogId === dog?.id)
      .sort((a, b) => String(b?.givenAt ?? "").localeCompare(String(a?.givenAt ?? "")));

    blocks.push([line(dog?.name || "Unnamed dog", 15, { bold: true, gapAfter: 5 })]);
    if (entries.length === 0) {
      blocks.push([line("No recorded treatments.", 10, { indent: 10, gapAfter: 10 })]);
      continue;
    }

    for (const entry of entries) {
      blocks.push([
        line(`${dateLabel(entry.givenAt)} - ${entry.category || "Treatment"}`, 11, { bold: true, indent: 10 }),
        line(`Product: ${entry.product || "Not recorded"}`, 10, { indent: 10, gapAfter: 7 }),
      ]);
    }
  }

  if (!Array.isArray(dogs) || dogs.length === 0) {
    blocks.push([line("No dogs or treatment history found.", 11)]);
  }
  return blocks;
}

function paginate(blocks) {
  const pages = [[]];
  let y = TOP;
  for (const block of blocks) {
    const height = block.reduce((sum, item) => sum + lineHeight(item), 0);
    if (y - height < BOTTOM && pages.at(-1).length > 0) {
      pages.push([]);
      y = TOP;
    }
    for (const item of block) {
      pages.at(-1).push({ ...item, y });
      y -= lineHeight(item);
    }
  }
  return pages;
}

function pageStream(lines, pageNumber, pageCount) {
  const commands = lines.map((item) =>
    `BT /${item.font} ${item.size} Tf ${LEFT + item.indent} ${item.y} Td (${pdfText(item.text)}) Tj ET`
  );
  commands.push(`BT /F1 9 Tf ${LEFT} 28 Td (Page ${pageNumber} of ${pageCount}) Tj ET`);
  return commands.join("\n");
}

function assemblePdf(pages) {
  const objects = [];
  const regularFontId = 3 + pages.length * 2;
  const boldFontId = regularFontId + 1;
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`;

  pages.forEach((lines, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const stream = pageStream(lines, index + 1, pages.length);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  objects[regularFontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[boldFontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = output.length;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    output += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(output);
}

export function buildTreatmentHistoryPdf(dogs, history, now = new Date()) {
  return assemblePdf(paginate(reportBlocks(dogs, history, now)));
}

export function treatmentHistoryPdfFilename(now = new Date()) {
  return `dog-treatment-history-${dateKey(now)}.pdf`;
}

export function downloadTreatmentHistoryPdf(dogs, history, now = new Date()) {
  const blob = new Blob([buildTreatmentHistoryPdf(dogs, history, now)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = treatmentHistoryPdfFilename(now);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
