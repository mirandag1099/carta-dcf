import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ParsedInputs } from "./engine";
import { extractFinancials } from "./pdfExtract.server";

// Reads a standardized annual-report PDF and returns the inputs the DCF engine
// needs. Extraction is deterministic (label + column matching on the PDF text
// layer) — no API key or external service required. The contract here
// (input { pdfBase64, fileName }, output { inputs, companyName, warnings }) is
// what the Dropzone calls, so it stays unchanged.
export const extractFinancialsFromPdf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const schema = z.object({
      pdfBase64: z.string().min(1),
      fileName: z.string().min(1),
    });
    return schema.parse(input);
  })
  .handler(async ({ data }) => {
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(Buffer.from(data.pdfBase64, "base64"));
    } catch {
      throw new Error("Could not decode the uploaded PDF.");
    }
    if (bytes.length === 0) throw new Error("The uploaded PDF is empty.");

    let f: Awaited<ReturnType<typeof extractFinancials>>;
    try {
      f = await extractFinancials(bytes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Extraction failed: ${msg}`);
    }

    const inputs: ParsedInputs = {
      fileName: data.fileName,
      valuationDate: f.valuationDate,
      anchorYear: f.anchorYear,
      // Balance sheet (weights + equity bridge) uses the latest actual year.
      bridgeYear: f.anchorYear,
      // Year-end convention: forecast the five years after the anchor (2026–2030).
      forecastYears: [
        f.anchorYear + 1,
        f.anchorYear + 2,
        f.anchorYear + 3,
        f.anchorYear + 4,
        f.anchorYear + 5,
      ],
      convention: "year-end",
      anchorRevenue: f.anchorRevenue,
      // Forecast drivers are the analyst's inputs — left blank (the report is
      // historical only), so the forecast stays locked until they're entered.
      revenueGrowth: null,
      gpMargin: null,
      operatingMargin: null,
      ebitdaMargin: null,
      capexPctRevenue: null,
      nwcPctRevenue: null,
      taxRate: f.taxRate,
      leveredBeta: null,
      riskFree: null,
      erp: null,
      smallStockPremium: 0,
      companySpecificPremium: 0,
      pretaxCostOfDebt: null,
      cash: f.cash,
      shortTermDebt: f.shortTermDebt,
      longTermDebt: f.longTermDebt,
      totalEquity: f.totalEquity,
    };

    return {
      inputs,
      companyName: f.companyName,
      warnings: f.warnings,
      validation: f.validation,
      historical: f.historical,
    };
  });
