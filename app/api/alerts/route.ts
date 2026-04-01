import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { AlertModel } from "@/lib/server/models";

export async function GET() {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  const alerts = await AlertModel.find({ userId: auth.sub }).sort({ triggeredAt: -1 }).lean();
  return ok(alerts);
}
