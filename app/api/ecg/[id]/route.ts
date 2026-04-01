import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { ECGRecordModel, PredictionModel } from "@/lib/server/models";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const { id } = await ctx.params;

  const record = await ECGRecordModel.findOne({ _id: id, userId: auth.sub }).lean();
  if (!record) return fail("Record not found", 404);
  return ok(record);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const { id } = await ctx.params;

  await PredictionModel.deleteMany({ ecgRecordId: id });
  await ECGRecordModel.deleteOne({ _id: id, userId: auth.sub });
  return ok({ deleted: true });
}
