import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { ReportModel } from "@/lib/server/models";

export async function GET() {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const reports = await ReportModel.find({ userId: auth.sub }).sort({ generatedAt: -1 }).lean();
  return ok(
    reports.map((r) => ({
      id: String(r._id),
      title: r.title,
      generated_at: r.generatedAt,
      file_path: r.filePath,
    })),
  );
}
