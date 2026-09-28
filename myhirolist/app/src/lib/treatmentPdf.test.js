import { test } from "node:test";
import assert from "node:assert/strict";

import { buildTreatmentHistoryPdf, treatmentHistoryPdfFilename } from "./treatmentPdf.js";

const atNoon = () => new Date(2026, 8, 29, 12);

test("treatment history exports a readable PDF grouped by dog", () => {
  const dogs = [{ id: "eg", name: "Eg" }, { id: "ernest", name: "Ernest" }];
  const history = [
    { dogId: "eg", category: "Heartworm", product: "ProHeart", givenAt: "2026-08-20" },
    { dogId: "eg", category: "Flea & tick", product: "Bravecto", givenAt: "2026-09-20" },
    { dogId: "ernest", category: "Intestinal worms", product: "Drontal", givenAt: "2026-07-01" },
  ];

  const pdf = new TextDecoder().decode(buildTreatmentHistoryPdf(dogs, history, atNoon()));

  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.ok(pdf.endsWith("%%EOF"));
  assert.ok(pdf.includes("Dog treatment history"));
  assert.ok(pdf.includes("Eg"));
  assert.ok(pdf.includes("Ernest"));
  assert.ok(pdf.includes("20 Sep 2026 - Flea & tick"));
  assert.ok(pdf.indexOf("Bravecto") < pdf.indexOf("ProHeart"), "newest treatment is listed first");
  assert.equal(treatmentHistoryPdfFilename(atNoon()), "dog-treatment-history-2026-09-29.pdf");
});

test("long treatment history creates a multipage PDF", () => {
  const dogs = [{ id: "eg", name: "Eg" }];
  const history = Array.from({ length: 80 }, (_, index) => ({
    dogId: "eg",
    category: "Heartworm",
    product: `Product ${index + 1}`,
    givenAt: `2026-08-${String((index % 28) + 1).padStart(2, "0")}`,
  }));

  const pdf = new TextDecoder().decode(buildTreatmentHistoryPdf(dogs, history, atNoon()));
  const pageCount = Number(/\/Type \/Pages \/Kids \[[^\]]+\] \/Count (\d+)/.exec(pdf)?.[1]);
  assert.ok(pageCount > 1);
  assert.ok(pdf.includes(`Page ${pageCount} of ${pageCount}`));
});
