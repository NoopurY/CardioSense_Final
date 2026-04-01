import { hashPassword, verifyPassword } from "@/lib/server/auth";
import { fail, ok, requireUser } from "@/lib/server/http";
import { sanitizeText } from "@/lib/server/sanitize";
import { connectMongo } from "@/lib/server/mongodb";
import { UserModel } from "@/lib/server/models";

export async function PUT(request: Request) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  const body = await request.json();
  const current = sanitizeText(body.current_password);
  const next = sanitizeText(body.new_password);

  const user = await UserModel.findOne({ _id: auth.sub });
  if (!user) return fail("User not found", 404);
  if (!user.passwordHash || !(await verifyPassword(current, user.passwordHash))) return fail("Current password incorrect", 400);

  user.passwordHash = await hashPassword(next);
  await user.save();
  return ok({ updated: true });
}
