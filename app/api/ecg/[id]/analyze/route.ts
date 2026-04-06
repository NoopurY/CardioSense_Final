import { inferArrhythmiaRemote } from "@/lib/server/ml";
import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { ECGRecordModel, PredictionModel } from "@/lib/server/models";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const { id } = await ctx.params;

  const record = await ECGRecordModel.findOne({ _id: id, userId: auth.sub });
  if (!record) return fail("Record not found", 404);
  const inference = await inferArrhythmiaRemote(record.signal);

  const prediction = await PredictionModel.create({
    ecgRecordId: record._id,
    predictedAt: new Date(),
    ...inference,
  });
  return ok(prediction);
}
