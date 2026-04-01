import { hashPassword } from "@/lib/server/auth";
import { fail, ok } from "@/lib/server/http";
import { sanitizeText } from "@/lib/server/sanitize";
import { connectMongo } from "@/lib/server/mongodb";
import { UserModel } from "@/lib/server/models";

export async function POST(request: Request) {
  await connectMongo();
  const body = await request.json();
  const email = sanitizeText(body.email).toLowerCase();
  const password = sanitizeText(body.password);
  const user = await UserModel.findOne({ email });
  if (!user) return fail("User not found", 404);

  user.passwordHash = await hashPassword(password);
  await user.save();
  return ok({ reset: true });
}
