import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { ECGRecordModel, PredictionModel } from "@/lib/server/models";

export async function GET() {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  const userRecordIds = (await ECGRecordModel.find({ userId: auth.sub }).select("_id").lean()).map((r) => r._id);
  const predictions = await PredictionModel.find({ ecgRecordId: { $in: userRecordIds } }).sort({ predictedAt: -1 }).lean();
  return ok(predictions);
}
