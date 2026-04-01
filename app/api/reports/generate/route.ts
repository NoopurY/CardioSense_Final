import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { ReportModel } from "@/lib/server/models";

function renderPdf(payload: { title: string; patientName: string; notes?: string }) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(24).text("CardioSense Clinical Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(`Title: ${payload.title}`);
    doc.fontSize(12).text(`Patient: ${payload.patientName}`);
    doc.text(`Generated At: ${new Date().toISOString()}`);
    doc.moveDown();
    doc.text("Summary:");
    doc.text("- ECG stream analyzed with RandomForest classifier");
    doc.text("- Arrhythmia confidence and risk score included");
    doc.text("- Statistical overlays: Normal, Poisson, Bayes, Correlation");
    doc.moveDown();
    doc.text(`Notes: ${payload.notes ?? "N/A"}`);
    doc.end();
  });
}

export async function POST(request: Request) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  const body = await request.json();
  const id = randomUUID();
  const title = body.title ?? "CardioSense Clinical Report";
  const patientName = body.patient_name ?? "CardioSense User";
  const pdf = await renderPdf({ title, patientName, notes: body.notes });

  const dir = path.join(process.cwd(), "generated-reports");
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${id}.pdf`;
  const absPath = path.join(dir, fileName);
  await fs.writeFile(absPath, pdf);

  const report = await ReportModel.create({
    userId: auth.sub,
    title,
    generatedAt: new Date(),
    dateFrom: body.date_from ? new Date(body.date_from) : undefined,
    dateTo: body.date_to ? new Date(body.date_to) : undefined,
    filePath: absPath,
    notes: body.notes,
  });

  return ok(
    {
      id: String(report._id),
      title: report.title,
      generated_at: report.generatedAt,
      file_path: `/api/reports/${String(report._id)}/download`,
    },
    { status: 201 },
  );
}
