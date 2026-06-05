import { toCanvas } from "html-to-image";
import jsPDF from "jspdf";

const MARGIN = 28; // pt
const GAP = 10; // pt between sections
const HEADER_SPACE = 28; // pt reserved above first section on page 1

export async function exportDashboardToPdf(
  el: HTMLElement,
  fileName = "carta-dcf-valuation.pdf",
  title?: string,
): Promise<void> {
  const sections = Array.from(
    el.querySelectorAll<HTMLElement>("[data-pdf-section]"),
  );
  if (sections.length === 0) return;

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const pageBottom = pageH - MARGIN;

  // Title on page 1
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(20, 20, 20);
  pdf.text(title || "Carta DCF Valuation", MARGIN, MARGIN + 4);
  pdf.setDrawColor(220);
  pdf.line(MARGIN, MARGIN + 12, pageW - MARGIN, MARGIN + 12);

  let cursorY = MARGIN + HEADER_SPACE;

  for (const section of sections) {
    const canvas = await toCanvas(section, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });
    const scale = contentW / canvas.width;
    const renderedH = canvas.height * scale;
    const availableH = pageBottom - cursorY;

    // Fits on current page
    if (renderedH <= availableH) {
      const img = canvas.toDataURL("image/jpeg", 0.92);
      pdf.addImage(img, "JPEG", MARGIN, cursorY, contentW, renderedH);
      cursorY += renderedH + GAP;
      continue;
    }

    // Doesn't fit; if page has content, go to new page and retry once
    if (cursorY > MARGIN + HEADER_SPACE) {
      pdf.addPage();
      cursorY = MARGIN;
      const fullPageH = pageBottom - cursorY;
      if (renderedH <= fullPageH) {
        const img = canvas.toDataURL("image/jpeg", 0.92);
        pdf.addImage(img, "JPEG", MARGIN, cursorY, contentW, renderedH);
        cursorY += renderedH + GAP;
        continue;
      }
    }

    // Section itself is taller than a page — slice it across pages.
    const ctx = canvas.getContext("2d")!;
    const slicePxPerPage = Math.floor((pageBottom - MARGIN) / scale);
    let y = 0;
    let firstSlice = true;
    while (y < canvas.height) {
      if (!firstSlice) {
        pdf.addPage();
        cursorY = MARGIN;
      }
      const h = Math.min(slicePxPerPage, canvas.height - y);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = h;
      const sctx = slice.getContext("2d")!;
      sctx.fillStyle = "#ffffff";
      sctx.fillRect(0, 0, canvas.width, h);
      sctx.putImageData(ctx.getImageData(0, y, canvas.width, h), 0, 0);
      const img = slice.toDataURL("image/jpeg", 0.92);
      pdf.addImage(img, "JPEG", MARGIN, cursorY, contentW, h * scale);
      cursorY += h * scale + GAP;
      y += h;
      firstSlice = false;
    }
  }

  pdf.save(fileName);
}
