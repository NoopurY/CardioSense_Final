import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { PredictionModel } from "@/lib/server/models";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const { id } = await ctx.params;

  const prediction = await PredictionModel.findById(id).lean();
  if (!prediction) return fail("Prediction not found", 404);
  return ok(prediction);
}
