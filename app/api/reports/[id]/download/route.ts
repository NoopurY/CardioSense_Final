import fs from "node:fs/promises";
import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { ReportModel } from "@/lib/server/models";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const { id } = await ctx.params;

  const report = await ReportModel.findOne({ _id: id, userId: auth.sub });
  if (!report) return fail("Report not found", 404);
  if (!report.filePath) return fail("Report file missing", 404);

  const file = await fs.readFile(report.filePath);
  return new Response(file, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cardiosense-report-${id}.pdf"`,
    },
  });
}
