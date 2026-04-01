import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { AlertModel } from "@/lib/server/models";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const { id } = await ctx.params;

  const alert = await AlertModel.findOne({ _id: id, userId: auth.sub });
  if (!alert) return fail("Alert not found", 404);
  alert.isAcknowledged = true;
  alert.acknowledgedAt = new Date();
  await alert.save();
  return ok(alert);
}
