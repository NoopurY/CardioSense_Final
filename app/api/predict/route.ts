import { inferArrhythmiaRemote } from "@/lib/server/ml";
import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { PredictionModel } from "@/lib/server/models";

export async function POST(request: Request) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const body = await request.json();
  const signal: number[] = Array.isArray(body.signal) ? (body.signal as unknown[]).map((x) => Number(x)) : [];
  const inference = await inferArrhythmiaRemote(signal);

  const prediction = await PredictionModel.create({
    ecgRecordId: body.ecg_record_id ?? "adhoc",
    predictedAt: new Date(),
    ...inference,
  });

  return ok(prediction);
}
